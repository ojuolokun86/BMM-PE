const moment = require('moment-timezone');
const supabase = require('../../supabaseClient');
const { checkIfAdmin } = require('./kick');
const { callAI } = require('../../utils/aiProviderManager');
const { getTimezone } = require('./timeCommand');
const { buildFallbackCongratulationTemplate } = require('./congratulateTemplates');

function normalizeLeague(name) {
  if (!name) return 'Unknown League';
  return name
    .toLowerCase()
    .replace(/season\s*\d+/i, '')
    .replace(/\d+$/, '')
    .trim()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function buildCurrentDateString() {
  const timezone = getTimezone('Nigeria') || 'UTC';
  return moment().tz(timezone).format('YYYY-MM-DD');
}

function isSameDayUTC(entryDate, targetDateString) {
  if (!entryDate) return false;
  const timezone = getTimezone('Nigeria') || 'UTC';
  return moment(entryDate).tz(timezone).format('YYYY-MM-DD') === targetDateString;
}

function parseCongratulationCommand(args, msg) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  const userJid = mentioned && mentioned.length > 0 ? mentioned[0] : null;

  if (!userJid) {
    return { ok: false, error: 'Mention a user.' };
  }

  const input = args.slice(1).join(' ');
  if (!input || !input.includes(',')) {
    return { ok: false, error: 'Invalid format.' };
  }

  const commaIndex = input.indexOf(',');
  const league = input.slice(0, commaIndex).trim();
  const team = input.slice(commaIndex + 1).trim();

  if (!league || !team) {
    return { ok: false, error: 'Invalid format.' };
  }

  return { ok: true, userJid, league, team };
}

async function generateCongratulationText({ userJid, league, team, previousTrophies, newTotal, override = false }) {
  const prompt = `You are writing a short, warm WhatsApp congratulations message for a football trophy winner. Keep it natural and celebratory. Do NOT invent numbers, do not change the facts below. Use these exact facts only: user handle = @${userJid.split('@')[0]}, league = ${league}, team = ${team}, previous trophies = ${previousTrophies}, new total trophies = ${newTotal}. The message must mention the user handle, include the league and team, and say the total trophies clearly. Keep it under 120 words, in a friendly and exciting tone.`;

  try {
    const aiResult = await callAI(`congratulate:${userJid}:${league}:${team}`, [{ role: 'user', content: prompt }]);
    if (aiResult && aiResult.success && aiResult.text) {
      const clean = String(aiResult.text).trim();
      if (clean) {
        return clean;
      }
    }
  } catch (error) {
    console.error('[CONGRATULATE] AI wording failed, using fallback template:', error.message);
  }

  return buildFallbackCongratulationTemplate({ userJid, league, team, previousTrophies, newTotal, override });
}

async function congratulateCommand(sock, msg, chatId, sender, args, prefix) {
  try {
    let community = null;

    try {
      const { data: communityMeta, error: rpcError } = await supabase.rpc('get_community_from_group', { group_jid: chatId });
      if (!rpcError && communityMeta && communityMeta.community_jid) {
        community = {
          communityJid: communityMeta.community_jid,
          communityName: communityMeta.community_name || 'Unknown Community'
        };
      }
    } catch (rpcError) {
      console.log('[CONGRATULATE] RPC fallback used:', rpcError.message || rpcError);
    }

    if (!community) {
      try {
        const groupMeta = await sock.groupMetadata(chatId);
        if (!groupMeta.linkedParent) {
          return sock.sendMessage(chatId, { text: '❌ This command works only inside a *community group*.' });
        }

        const parentMeta = await sock.groupMetadata(groupMeta.linkedParent);
        community = {
          communityJid: groupMeta.linkedParent,
          communityName: parentMeta.subject || 'Unknown Community'
        };
      } catch (error) {
        return sock.sendMessage(chatId, { text: '❌ This command works only inside a *community group*.' });
      }
    }

    const isAdmin = await checkIfAdmin(sock, chatId, sender);
    if (!isAdmin) {
      return sock.sendMessage(chatId, {
        text: '❌ Only admins can use this command.'
      });
    }

    const parseResult = parseCongratulationCommand(args, msg);
    if (!parseResult.ok) {
      const usageText = parseResult.error === 'Mention a user.'
        ? '❌ Mention a user.\n\nUsage:\n.congratulate @user League name, Team'
        : '❌ Invalid format.\n\nUsage:\n.congratulate @user Championship, Queen Park Rangers';
      return sock.sendMessage(chatId, { text: usageText });
    }

    const { userJid, league, team } = parseResult;
    const normalizedLeague = normalizeLeague(league);
    const normalizedTeam = String(team).trim();

    const { data: historyRows = [], error: historyError } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)
      .eq('user_jid', userJid)
      .order('created_at', { ascending: true });

    if (historyError) {
      throw historyError;
    }

    const totalTrophies = historyRows.reduce((sum, record) => sum + Number(record.trophies || 0), 0);
    const todayDate = buildCurrentDateString();
    const todayMatch = historyRows.find((entry) => {
      const sameLeague = normalizeLeague(entry.league) === normalizedLeague;
      const sameTeam = String(entry.team || '').trim().toLowerCase() === normalizedTeam.toLowerCase();
      return sameLeague && sameTeam && isSameDayUTC(entry.created_at, todayDate);
    });

    if (todayMatch) {
      const previousTrophies = Math.max(totalTrophies - 1, 0);
      const newTotal = previousTrophies + 1;
      const message = await generateCongratulationText({
        userJid,
        league: normalizedLeague,
        team: normalizedTeam,
        previousTrophies,
        newTotal,
        override: false
      });

      return sock.sendMessage(chatId, {
        text: `${message}\n\n🏟️ ${normalizedLeague}\n⚽ ${normalizedTeam}\n\n🏆 Your new total is ${newTotal} trophies!`,
        mentions: [userJid]
      });
    }

    const warningText = `⚠️ HALL OF FAME CHECK\n\n@${userJid.split('@')[0]} currently has ${totalTrophies} trophies recorded in the Hall of Fame, but I couldn't find a new Hall of Fame entry for today.\n\n🏟️ League: ${normalizedLeague}\n⚽ Team: ${normalizedTeam}\n\nPlease update the Hall of Fame first.\n\nReply *continue* to proceed with the congratulations anyway.`;

    const sent = await sock.sendMessage(chatId, {
      text: warningText,
      mentions: [userJid]
    });

    const menuMsgId = sent.key.id;

    const listener = async (m) => {
      try {
        const reply = m.messages?.[0];
        if (!reply) return;

        const replyFrom = reply.key.remoteJid;
        const replySender = reply.key.participant || reply.key.remoteJid;
        const context = reply.message?.extendedTextMessage?.contextInfo;
        const isReply = context?.stanzaId === menuMsgId;

        if (replyFrom !== chatId || replySender !== sender || !isReply) return;

        const body = reply.message?.conversation || reply.message?.extendedTextMessage?.text || '';
        const normalizedReply = body.trim().toLowerCase();

        if (normalizedReply !== 'continue') {
          await sock.sendMessage(chatId, {
            text: '❌ Override cancelled. No congratulations sent.'
          });
          sock.ev.off('messages.upsert', listener);
          return;
        }

        const previousTrophies = Math.max(totalTrophies - 1, 0);
        const newTotal = totalTrophies;
        const message = await generateCongratulationText({
          userJid,
          league: normalizedLeague,
          team: normalizedTeam,
          previousTrophies,
          newTotal,
          override: true
        });

        await sock.sendMessage(chatId, {
          text: `${message}\n\n🏟️ ${normalizedLeague}\n⚽ ${normalizedTeam}\n\n🏆 Your new total is ${newTotal} trophies!`,
          mentions: [userJid]
        });

        sock.ev.off('messages.upsert', listener);
      } catch (error) {
        console.error('[CONGRATULATE] admin override error:', error);
        sock.ev.off('messages.upsert', listener);
      }
    };

    sock.ev.on('messages.upsert', listener);

    setTimeout(() => {
      sock.ev.off('messages.upsert', listener);
    }, 180000);

    return;
  } catch (error) {
    console.error('[CONGRATULATE] command error:', error);
    return sock.sendMessage(chatId, {
      text: '❌ Failed to process congratulations.'
    });
  }
}

module.exports = {
  congratulateCommand
};
