const { broadcastToGroupMembers } = require('../features/broadcast');
const { checkIfAdmin } = require('./groupCommand');

async function broadcastCommand(sock, msg, args, prefix) {
  const chatId = msg?.key?.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderId = sender?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];

  if (!chatId || !chatId.endsWith('@g.us')) {
    return sock.sendMessage(chatId, { text: '❌ This command only works in groups.' }, { quoted: msg });
  }

  const isBotAdmin = await checkIfAdmin(sock, chatId, botLid);
  if (!isBotAdmin) {
    return sock.sendMessage(chatId, { text: '❌ I need to be an admin to broadcast messages.' }, { quoted: msg });
  }

  const text = args.join(' ').trim();
  if (!text) {
    return sock.sendMessage(chatId, {
      text: `📢 *Broadcast Usage*\n\n${prefix}broadcast Your message here\n\nThis will DM your message to every group member with a random 10–20s delay to avoid spam.`
    }, { quoted: msg });
  }

  // Confirmation before starting
  await sock.sendMessage(chatId, {
    text: `🚀 Starting broadcast to all members of this group.\n\nMessage:\n"${text}"\n\n⏳ This may take a while due to delays.`
  }, { quoted: msg });

  const result = await broadcastToGroupMembers(sock, chatId, text, {
    quoted: msg,
    delayMinMs: 10_000,
    delayMaxMs: 20_000,
    excludeJids: [sock.user.id] // exclude bot itself
  });

  const summary = `✅ *Broadcast Complete*\n\n` +
    `📊 Total members: ${result.total}\n` +
    `✅ Sent: ${result.sent}\n` +
    `❌ Failed: ${result.failed}`;

  if (result.failed > 0 && result.failures.length) {
    const failedList = result.failures.slice(0, 5).map(f => `• ${f.jid}: ${f.error}`).join('\n');
    const more = result.failures.length > 5 ? `\n...and ${result.failures.length - 5} more` : '';
    return sock.sendMessage(chatId, { text: `${summary}\n\nFailed details:\n${failedList}${more}` }, { quoted: msg });
  }

  await sock.sendMessage(chatId, { text: summary }, { quoted: msg });
}

module.exports = broadcastCommand;
