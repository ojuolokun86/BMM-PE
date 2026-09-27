const {
  getRestartMessagesEnabled,
  setRestartMessagesEnabled,
  isBotOwner
} = require('../../database/database');

async function restartMessageCommand(sock, msg, args = []) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderId = sender?.split('@')[0];
  const senderLid = sender?.includes(':') ? sender.split(':')[1].split('@')[0] : undefined;
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const name = sock.user?.name || 'the bot owner';

  if (!botId) {
    return sock.sendMessage(from, {
      text: '❌ Unable to identify this bot account.'
    }, { quoted: msg });
  }

  if (!msg.key.fromMe && !isBotOwner(senderId, senderLid, botId, botLid)) {
    return sock.sendMessage(from, {
      text: `❌ Only *${name}* can configure restart notifications.`
    }, { quoted: msg });
  }

  const option = args[0]?.toLowerCase();
  if (!option) {
    const status = getRestartMessagesEnabled(botId) ? 'ON' : 'OFF';
    return sock.sendMessage(from, {
      text: `🔄 Restart notification DMs are currently *${status}*. Use .restartmsg on/off to change this.`
    }, { quoted: msg });
  }

  if (!['on', 'off'].includes(option)) {
    return sock.sendMessage(from, {
      text: 'Usage: .restartmsg on/off'
    }, { quoted: msg });
  }

  const enabled = option === 'on';
  setRestartMessagesEnabled(botId, enabled);
  return sock.sendMessage(from, {
    text: enabled
      ? '✅ Restart notification DMs are now ON.'
      : '🔕 Restart notification DMs are now OFF.'
  }, { quoted: msg });
}

module.exports = restartMessageCommand;