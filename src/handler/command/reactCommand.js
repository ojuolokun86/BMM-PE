const { getReactToCommand, setReactToCommand } = require('../../database/database');
const { isBotOwner } = require('../../database/database');

async function reactCommand(sock, msg, textMsg) {
  const userId = sock.user.id.split(':')[0];
  const arg = textMsg.split(' ')[1]?.toLowerCase();
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const senderId = sender?.split('@')[0];
  const name = sock.user?.name;
  if (!msg.key.fromMe && !isBotOwner(senderId, botId, botLid)) {
    return await sock.sendMessage(from, {
      text: `❌ Only *${name}* can configure reaction settings.`
    });
  }

  if (arg === 'on') {
    setReactToCommand(userId, true);
    await sock.sendMessage(from, { text: '✅ Command reaction is now ON.' });
  } else if (arg === 'off') {
    setReactToCommand(userId, false);
    await sock.sendMessage(from, { text: '❌ Command reaction is now OFF.' });
  } else {
    await sock.sendMessage(from, { text: 'Usage: react on/off' });
  }
}

module.exports = reactCommand;