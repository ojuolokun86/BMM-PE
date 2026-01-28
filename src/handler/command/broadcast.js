const { broadcastToAllGroups, broadcastToAllContacts, broadcastToGroupMembers, getUserGroupsWithNumbers } = require('../features/broadcast');
const { isBotOwner } = require('../../database/database');

const menu = `
📢 *Broadcast Menu*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Reply with an option number:

> [1] ▸ Broadcast to **all groups I’m in**
> [2] ▸ Broadcast to **all contacts in my DM**
> [3] ▸ Broadcast to **all members of a target group**

⚠️ *This only works in the bot owner’s DM.*
⚠️ *This command is not recommended for large groups or Sending to all contacts.*
⚠️ *It may result in your account being banned.*
━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

async function broadcastCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const senderId = sender?.split('@')[0];

  // Only allow in bot owner’s DM
  if (!from.endsWith('@s.whatsapp.net') && !from.endsWith('@lid')) {
    return sock.sendMessage(from, { text: '❌ This command only works in DM.' }, { quoted: msg });
  }
  if (!isBotOwner(senderId, botId, botLid)) {
    return sock.sendMessage(from, { text: '❌ Only the bot owner can use this command.' }, { quoted: msg });
  }

  // Send menu and set up listener
  const sentMenu = await sock.sendMessage(from, { text: menu }, { quoted: msg });
  const menuMsgId = sentMenu.key.id;

  const listener = async (m) => {
    const reply = m.messages?.[0];
    if (!reply) return;

    const replyFrom = reply.key.remoteJid;
    const replySender = reply.key.participant || reply.key.remoteJid;
    if (replyFrom !== from || replySender !== sender) return;

    const context = reply.message?.extendedTextMessage?.contextInfo;
    const isReplyToMenu = context?.stanzaId === menuMsgId;
    if (!isReplyToMenu) return;

    const body = reply.message?.conversation || reply.message?.extendedTextMessage?.text || '';
    const option = parseInt(body.trim());

    if (isNaN(option) || ![1, 2, 3].includes(option)) {
      await sock.sendMessage(from, { text: '❌ Invalid option. Reply with 1, 2, or 3.' });
      sock.ev.off('messages.upsert', listener);
      return;
    }

    if (option === 3) {
      // Show groups with numbers
      const groups = await getUserGroupsWithNumbers(sock);
      if (groups.length === 0) {
        await sock.sendMessage(from, { text: '❌ You are not in any groups.' });
        sock.ev.off('messages.upsert', listener);
        return;
      }
      const list = groups.map(g => `> [${g.number}] ${g.subject}`).join('\n');
      const prompt = await sock.sendMessage(from, {
        text: `� *Select a group:*\n\n${list}\n\nReply with the group number.`
      }, { quoted: msg });

      const groupListener = async (m2) => {
        const r2 = m2.messages?.[0];
        if (!r2) return;
        if (r2.key.remoteJid !== from || (r2.key.participant || r2.key.remoteJid) !== sender) return;
        const ctx2 = r2.message?.extendedTextMessage?.contextInfo;
        if (ctx2?.stanzaId !== prompt.key.id) return;
        const num = parseInt((r2.message?.conversation || r2.message?.extendedTextMessage?.text || '').trim());
        const chosen = groups.find(g => g.number === num);
        if (!chosen) {
          await sock.sendMessage(from, { text: '❌ Invalid group number.' });
          sock.ev.off('messages.upsert', groupListener);
          sock.ev.off('messages.upsert', listener);
          return;
        }
        // Ask for message
        const msgPrompt = await sock.sendMessage(from, {
          text: `✅ Group selected: *${chosen.subject}*\n\nNow reply with the message you want to broadcast to all members of this group.`
        }, { quoted: msg });

        const msgListener = async (m3) => {
          const r3 = m3.messages?.[0];
          if (!r3) return;
          if (r3.key.remoteJid !== from || (r3.key.participant || r3.key.remoteJid) !== sender) return;
          const ctx3 = r3.message?.extendedTextMessage?.contextInfo;
          if (ctx3?.stanzaId !== msgPrompt.key.id) return;
          const broadcastText = r3.message?.conversation || r3.message?.extendedTextMessage?.text || '';
          if (!broadcastText.trim()) {
            await sock.sendMessage(from, { text: '❌ Message cannot be empty.' });
            sock.ev.off('messages.upsert', msgListener);
            sock.ev.off('messages.upsert', groupListener);
            sock.ev.off('messages.upsert', listener);
            return;
          }
          await sock.sendMessage(from, { text: '🚀 Starting broadcast to group members...' });
          const result = await broadcastToGroupMembers(sock, chosen.jid, broadcastText, {
            delayMinMs: 5_000,
            delayMaxMs: 10_000,
            excludeJids: [sock.user.id]
          });
          const summary = `✅ *Broadcast Complete*\n\n📊 Total members: ${result.total}\n✅ Sent: ${result.sent}\n❌ Failed: ${result.failed}`;
          await sock.sendMessage(from, { text: summary });
          sock.ev.off('messages.upsert', msgListener);
          sock.ev.off('messages.upsert', groupListener);
          sock.ev.off('messages.upsert', listener);
        };
        sock.ev.on('messages.upsert', msgListener);
      };
      sock.ev.on('messages.upsert', groupListener);
      sock.ev.off('messages.upsert', listener);
      return;
    }

    // For options 1 and 2, ask for message directly
    const msgPrompt = await sock.sendMessage(from, {
      text: option === 1
        ? '📢 Reply with the message to broadcast to **all groups you’re in**.'
        : '📢 Reply with the message to broadcast to **all contacts in your DM**.'
    }, { quoted: msg });

    const msgListener = async (m2) => {
      const r2 = m2.messages?.[0];
      if (!r2) return;
      if (r2.key.remoteJid !== from || (r2.key.participant || r2.key.remoteJid) !== sender) return;
      const ctx2 = r2.message?.extendedTextMessage?.contextInfo;
      if (ctx2?.stanzaId !== msgPrompt.key.id) return;
      const broadcastText = r2.message?.conversation || r2.message?.extendedTextMessage?.text || '';
      if (!broadcastText.trim()) {
        await sock.sendMessage(from, { text: '❌ Message cannot be empty.' });
        sock.ev.off('messages.upsert', msgListener);
        sock.ev.off('messages.upsert', listener);
        return;
      }
      await sock.sendMessage(from, { text: '🚀 Starting broadcast...' });
      const result = option === 1
        ? await broadcastToAllGroups(sock, broadcastText, { delayMinMs: 5_000, delayMaxMs: 10_000, excludeJids: [sock.user.id] })
        : await broadcastToAllContacts(sock, broadcastText, { delayMinMs: 5_000, delayMaxMs: 10_000, excludeJids: [sock.user.id] });
      const summary = `✅ *Broadcast Complete*\n\n📊 Total targets: ${result.total}\n✅ Sent: ${result.sent}\n❌ Failed: ${result.failed}`;
      await sock.sendMessage(from, { text: summary });
      sock.ev.off('messages.upsert', msgListener);
      sock.ev.off('messages.upsert', listener);
    };
    sock.ev.on('messages.upsert', msgListener);
  };

  sock.ev.on('messages.upsert', listener);
}

module.exports = broadcastCommand;
