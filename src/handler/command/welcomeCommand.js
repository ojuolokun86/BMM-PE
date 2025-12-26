const { getWelcomeSettings, setWelcomeEnabled, setGoodbyeEnabled } = require('../../database/welcomeDb');
const { checkIfAdmin } = require('./kick');
const menu = (welcome, goodbye) => `
👋 Welcome & Goodbye Messages

Here’s how things look right now 👇
• Welcome: ${welcome ? 'ON 🟢' : 'OFF 🔴'}
• Goodbye: ${goodbye ? 'ON 🟢' : 'OFF 🔴'}

What do you want to change?
Reply with:
1️⃣ Turn welcome on/off
2️⃣ Turn goodbye on/off
3️⃣ Turn both on/off

Just send the number 🙂
`;

async function welcomeCommand(sock, msg) {
  const groupId = msg.key.remoteJid;
  const botId = sock.user.id.split(':')[0];
  const senderId = msg.key.participant || msg.participant || msg.key.remoteJid;
  const settings = getWelcomeSettings(groupId, botId);
  const admin = await checkIfAdmin(sock, groupId, senderId);

  if (!msg.key.remoteJid.endsWith('@g.us')) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ This command can only be used in a group.'
    });
    return;
  }

  if (!admin) {
    await sock.sendMessage(groupId, { text: "❌ Only group admins can use this command." }, { quoted: msg });
    return;
  }

  const sentMenu = await sock.sendMessage(groupId, { text: menu(settings.welcome, settings.goodbye), quoted: msg });
  const menuMsgId = sentMenu.key.id;

  const listener = async (m) => {
    const reply = m.messages?.[0];
    if (!reply) return;
    const quotedId = reply.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (quotedId !== menuMsgId) return;

    const text = reply.message?.conversation || reply.message?.extendedTextMessage?.text || '';
    const input = text.trim();

    if (input === '1') {
      setWelcomeEnabled(groupId, botId, !settings.welcome);
      await sock.sendMessage(groupId, { text: `Welcome message is now ${!settings.welcome ? 'ON' : 'OFF'}.` });
    } else if (input === '2') {
      setGoodbyeEnabled(groupId, botId, !settings.goodbye);
      await sock.sendMessage(groupId, { text: `Goodbye message is now ${!settings.goodbye ? 'ON' : 'OFF'}.` });
    } else if (input === '3') {
      setWelcomeEnabled(groupId, botId, !settings.welcome);
      setGoodbyeEnabled(groupId, botId, !settings.goodbye);
      await sock.sendMessage(groupId, { text: `Welcome and Goodbye messages are now ${!settings.welcome && !settings.goodbye ? 'ON' : 'OFF'}.` });
    } else {
      await sock.sendMessage(groupId, { text: '❌ Invalid option.' });
    }
    sock.ev.off('messages.upsert', listener);
  };

  sock.ev.on('messages.upsert', listener);
}

module.exports = welcomeCommand;