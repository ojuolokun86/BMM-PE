const {
  getAntilinkSettings,
  incrementWarn,
  resetWarn
} = require('../../database/antilinkDb');
const { markMessageAsBotDeleted } = require('../../utils/botDeletedMessages');
const { getAllowedLinks, hasAllowedLink } = require('../../database/linkDb');

const WA_DEFAULT_LINK_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|t\.me\/[^\s]+|bit\.ly\/[^\s]+|[\w-]+\.(com|net|org|info|biz|xyz|live|tv|me|link)(\/\S*)?)/i;
// ✅ Random warning messages for warn-remove
const warningMessages = [
  "⚠️ @user, links are not allowed here. Warning {count}/{limit}. Stop now or face removal!",
  "🚨 ALERT! @user, no links allowed! This is warning {count}/{limit}. One more and you're out!",
  "🔒 Security Notice: @user, link detected. Warning {count}/{limit}. Posting links will get you removed.",
  "❗ @user, links are prohibited. Warning {count}/{limit}. Final warnings lead to a kick.",
  "⚠️ SYSTEM ALERT: @user, you broke the rules. Warning {count}/{limit}. Respect the rules or you’re out!"
];

// ✅ Random messages for when user gets removed//
const removalMessages = [
  "🚫 @user has been removed for repeated link sharing. Rules are rules!",
  "❌ @user was kicked out after {limit} warnings for posting links.",
  "🔴 @user violated group rules and is now removed. No links allowed!",
  "🚫 SECURITY ALERT: @user reached the warning limit and was removed from the group.",
  "⚠️ @user ignored warnings ({limit}) and is now removed. Follow the rules next time."
];

// ✅ Random warning messages for warn only
const simpleWarnMessages = [
  "⚠️ @user, posting links is not allowed here.",
  "🚨 ALERT! @user, no links allowed in this group.",
  "❌ @user, please stop sharing links. It’s against the rules.",
  "🔒 Security Alert: @user, links are prohibited in this group.",
  "⚠️ WARNING: @user, do not share links again."
];

// ✅ Function to pick a random message
function getRandomMessage(arr, userId, count = null, limit = null) {
  let msg = arr[Math.floor(Math.random() * arr.length)];
  msg = msg.replace("@user", `@${userId}`);
  if (count && limit) {
    msg = msg.replace("{count}", count).replace("{limit}", limit);
  }
  return msg;
}

async function detectAndAct({ sock, from, msg}) {
  const groupId = from;
  const botJid = sock.user?.id?.split(':')[0]?.split('@')[0];
  const settings = getAntilinkSettings(groupId, botJid);
  const botId = botJid;
  const userJid = msg.key.participant || msg.participant || msg.participantJid || null;
  if (!userJid) return false;
  const textMsg =
  msg.message?.conversation ||
  msg.message?.extendedTextMessage?.text ||
  msg.message?.imageMessage?.caption ||
  msg.message?.videoMessage?.caption ||
  msg.message?.documentMessage?.caption ||
  '';

  if (settings.mode === 'off') return false;
  
  // Check if message contains any links
  WA_DEFAULT_LINK_REGEX.lastIndex = 0;

if (!WA_DEFAULT_LINK_REGEX.test(textMsg)) return false;
  if (userJid.includes(botJid)) return false;

  // Get allowed links for this group from database
  const allowedLinks = getAllowedLinks(groupId, botId);
  
  // If message contains allowed links, skip
  if (hasAllowedLink(textMsg, allowedLinks)) {
    console.log(`✅ Allowed link detected in group ${groupId} from user ${userJid} - skipping`);
    return false;
  }

  console.log(`📛 Unallowed link detected in group ${groupId} from user ${userJid}`);
  console.log('⚙️ Antilink Settings:', settings);

  if (settings.bypassAdmins) {
    const metadata = await sock.groupMetadata(groupId);
    const isAdmin = metadata.participants?.some(
      p => p.id === userJid && ['admin', 'superadmin'].includes(p.admin)
    );
    if (isAdmin) {
      console.log(`🛡️ Skipped admin: ${userJid}`);
      return false;
    }
  }

  try {
    await sock.sendMessage(groupId, {
      delete: {
        remoteJid: groupId,
        fromMe: false,
        id: msg.key.id,
        participant: userJid
      }
    });
    markMessageAsBotDeleted(msg.key.id);

    if (settings.mode === 'warn-remove') {
      const warnCount = incrementWarn(groupId, botId, userJid, 'Sharing links', 'antilink');
      const warnLimit = settings.warnLimit || 2;

      // Send random warning
      await sock.sendMessage(groupId, {
        text: getRandomMessage(warningMessages, userJid.split('@')[0], warnCount, warnLimit),
        mentions: [userJid]
      });

      // If user reached limit, remove them with random removal message
      if (warnCount >= warnLimit) {
        await sock.groupParticipantsUpdate(groupId, [userJid], 'remove');
        await sock.sendMessage(groupId, {
          text: getRandomMessage(removalMessages, userJid.split('@')[0], null, warnLimit),
          mentions: [userJid]
        });
        resetWarn(groupId, botJid, userJid);
      }
    } else if (settings.mode === 'warn') {
      await sock.sendMessage(groupId, {
        text: getRandomMessage(simpleWarnMessages, userJid.split('@')[0]),
        mentions: [userJid]
      });
    } else if (settings.mode === 'remove') {
      await sock.groupParticipantsUpdate(groupId, [userJid], 'remove');
      await sock.sendMessage(groupId, {
        text: getRandomMessage(removalMessages, userJid.split('@')[0], null, settings.warnLimit || 2),
        mentions: [userJid]
      });
    }

    return true;
  } catch (err) {
    console.error('❌ Error in antilink enforcement:', err.message);
  }

  return false;
}

module.exports = detectAndAct;
