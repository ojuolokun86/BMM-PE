const sendToChat = require('../../utils/sendToChat');
const { quotedInfo } = require('../../utils/sendToChat');
const { isBotOwner } = require('../../database/database');

const disappearingOptions = {
  0: 0,         // Off
  1: 86400,     // 24 hours
  2: 604800,    // 7 days
  3: 7776000    // 90 days
};

const disappearingMenu = `
🕒 *Disappearing Messages Settings*
Reply with a number (0–3) to set duration:
0. ❌ Off
1. ⏱️ 24 Hours
2. 🗓️ 7 Days
3. 📆 90 Days
`;

async function setDisappearingCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const quote = quotedInfo();
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const senderId = sender?.split('@')[0];
  const name = sock.user?.name;
  if (!msg.key.fromMe && !isBotOwner(senderId, botId, botLid)) {
    return await sendToChat(sock, from, {
      message: `❌ Only *${name}* can configure Disappearing settings.`
    });
  }

  const sentMenu = await sock.sendMessage(from, { text: disappearingMenu }, { quoted: quote });
  const menuMsgId = sentMenu.key.id;

  const listener = async (m) => {
    const reply = m.messages?.[0];
    if (!reply) return;

    const replyFrom = reply.key.remoteJid;
    const replySender = reply.key.participant || reply.key.remoteJid;
    const context = reply.message?.extendedTextMessage?.contextInfo;

    if (replyFrom !== from || replySender !== sender) return;
    if (!context || context.stanzaId !== menuMsgId) return;

    const body = reply.message?.conversation || reply.message?.extendedTextMessage?.text || '';
    const option = parseInt(body.trim());

    if (isNaN(option) || !disappearingOptions.hasOwnProperty(option)) {
      await sendToChat(sock, from, { message: '❌ Invalid option. Use 0–3.' });
      sock.ev.off('messages.upsert', listener);
      return;
    }

    const duration = disappearingOptions[option];
    try {
      await sock.sendMessage(from, {
        disappearingMessagesInChat: duration
      });

      const readable = formatDuration(duration);

      await sendToChat(sock, from, {
        message: `✅ Disappearing messages set to *${readable}*`
      });
    } catch (err) {
      await sendToChat(sock, from, {
        message: `❌ Error setting disappearing messages:\n${err.message}`
      });
    }

    sock.ev.off('messages.upsert', listener);
  };

  sock.ev.on('messages.upsert', listener);
}

function formatDuration(seconds) {
  switch (seconds) {
    case 0: return 'Off';
    case 86400: return '24 Hours';
    case 604800: return '7 Days';
    case 7776000: return '90 Days';
    default: return `${seconds} seconds`;
  }
}

module.exports = setDisappearingCommand;
