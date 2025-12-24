const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { quotedInfo } = require('../../utils/sendToChat');
const sendToChat = require('../../utils/sendToChat');
const { isBotOwner } = require('../../database/database');

const botPrivacyOptions = {
  0: 'Set Bot Name',
  1: 'Set Bot Profile Picture',
  2: 'Set Bot About (Bio)',
  3: 'Get Blocklist',
  4: 'Get User Profile Picture'
};

const botMenu = `
🤖 [BOT CONFIGURATION MODULE]
Reply with an index to execute a system operation:

0. ✏️ [SET IDENTIFIER] → Modify bot display name
1. 🖼️ [SET AVATAR] → Update operational profile image
2. 📝 [SET STATUS] → Configure system bio descriptor
3. 🚫 [BLOCKLIST REPORT] → Retrieve current access restrictions
4. 👤 [FETCH USER AVATAR] → Acquire user profile image (reply required)

[NOTICE] Unauthorized or invalid responses will be ignored.
`;


async function setBotPrivacyCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const quote = quotedInfo();
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const bot = botId && botLid;
  const ownerName = sock.user.name;
  const senderId = sender?.split('@')[0];
  if (!msg.key.fromMe && !isBotOwner(senderId, botId, botLid)) {
    return await sendToChat(sock, from, {
      message: `❌ Only *${ownerName}* can configure bot privacy settings.`
    });
  }

  const sentMenu = await sock.sendMessage(from, { text: botMenu }, { quoted: quote });
  const menuMsgId = sentMenu.key.id;

  const firstListener = async ({ messages }) => {
    const reply = messages?.[0];
    if (!reply) return;
    if (!bot && !isBotOwner(senderId, botId, botLid)) {
          await sendToChat(sock, from, {
            message: `❌ Only *${ownerName}* can configure bot privacy settings.`
          });
          sock.ev.off('messages.upsert', firstListener);
          return;
        }

    const replyFrom = reply.key.remoteJid;
    const replySender = reply.key.participant || reply.key.remoteJid;
    const context = reply.message?.extendedTextMessage?.contextInfo;

    if (replyFrom !== from || replySender !== sender) return;
    if (!context || context.stanzaId !== menuMsgId) return;

    const body = reply.message?.conversation || reply.message?.extendedTextMessage?.text || '';
    const option = parseInt(body.trim());

    sock.ev.off('messages.upsert', firstListener); // Remove listener once valid option received

    if (isNaN(option) || !botPrivacyOptions.hasOwnProperty(option)) {
      return sendToChat(sock, from, { message: '❌ Invalid option. Use 0–4.' });
    }

    switch (option) {
      case 0: // Set Bot Name
     const prompt = await sock.sendMessage(from, { text: '✏️ Send the new name:' }, { quoted: reply });
      try {
        const name = await waitForNextText(sock, from, sender, prompt.key.id);
        console.log('Setting bot name to:', name);
        if (!name) throw new Error('No name provided');
        await sock.updateProfileName(name);
        await sendToChat(sock, from, { message: `✅ Bot name updated to "${name}"` });
      } catch (e) {
        console.error('Error updating bot name:', e);
        await sendToChat(sock, from, { message: `❌ Failed to update name:\n${e.message}` });
      }
      break;

      case 1: // Set Profile Picture
        await sock.sendMessage(from, { text: '🖼️ Send an image to set as profile picture:' }, { quoted: reply });
        try {
          const imgMsg = await waitForImage(sock, from, sender);
          const buffer = await downloadImage(imgMsg);
          await sock.updateProfilePicture(sock.user.id, buffer);
          await sendToChat(sock, from, { message: '✅ Profile picture updated.' });
        } catch (e) {
          console.error('Error updating profile picture:', e);
          await sendToChat(sock, from, { message: `❌ Failed to update profile picture:\n${e.message}` });
        }
        break;

      case 2: // Set Bot Bio
        const prompts = await sock.sendMessage(from, { text: '📝 Send new bio/status text:' }, { quoted: reply });
        try {
          const bio = await waitForNextText(sock, from, sender, prompts.key.id);
          if (!bio) throw new Error('No bio provided');
          await sock.updateProfileStatus(bio);
          await sendToChat(sock, from, { message: `✅ Bio updated to "${bio}"` });
        } catch (e) {
          await sendToChat(sock, from, { message: `❌ Failed to update bio:\n${e.message}` });
        }
        break;

      case 3: // Get Blocklist
        try {
          const list = await sock.fetchBlocklist();
          const response = list.length ? list.join('\n') : '✅ No blocked contacts.';
          await sendToChat(sock, from, { message: `🚫 *Blocked Contacts:*\n${response}` });
        } catch (e) {
          await sendToChat(sock, from, { message: `❌ Failed to fetch blocklist:\n${e.message}` });
        }
        break;

      case 4: // Get user profile picture
        const targetJid = reply.message?.extendedTextMessage?.contextInfo?.participant;
        if (!targetJid) {
          return sendToChat(sock, from, { message: '❌ Reply to a user’s message to get their profile picture.' });
        }

        try {
          const url = await sock.profilePictureUrl(targetJid, 'image');
          await sock.sendMessage(from, {
            image: { url },
            caption: `🖼️ Profile picture of @${targetJid.split('@')[0]}`,
            mentions: [targetJid]
          }, { quoted: reply });
        } catch (e) {
          await sendToChat(sock, from, {
            message: '❌ Could not fetch profile picture. They may have hidden it.'
          });
        }
        break;

      default:
        await sendToChat(sock, from, { message: '❌ Unknown action.' });
    }
  };

  sock.ev.on('messages.upsert', firstListener);
}

// === Helper Functions ===

const waitForNextText = (sock, jid, sender, excludeMessageId = null) => {
  return new Promise((resolve) => {
    const onMessage = async ({ messages }) => {
      const msg = messages?.[0];
      if (!msg) return;

      const participant = msg.key.participant || msg.key.remoteJid;
      const messageId = msg.key.id;
      const isFromSender = participant === sender;
      const isText = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

      // Skip the message that was just sent as a prompt
      if (excludeMessageId && messageId === excludeMessageId) return;

      if (msg.key.remoteJid === jid && isFromSender && isText) {
        sock.ev.off('messages.upsert', onMessage);
        const text = msg.message.conversation || msg.message.extendedTextMessage.text;
        resolve(text);
      }
    };

    sock.ev.on('messages.upsert', onMessage);
    setTimeout(() => {
      sock.ev.off('messages.upsert', onMessage);
      resolve(null); // Timeout after 60s
    }, 60000);
  });
};



function waitForImage(sock, jid, expectedSender) {
  return new Promise((resolve) => {
    const listener = async ({ messages }) => {
      const msg = messages?.[0];
      if (!msg) return;
      const sender = msg.key.participant || msg.key.remoteJid;
      if (msg.key.remoteJid !== jid || sender !== expectedSender) return;
      if (!msg.message?.imageMessage) return;

      sock.ev.off('messages.upsert', listener);
      console.log('Image received from:', sender, msg.message.imageMessage);
      resolve(msg);
    };
    sock.ev.on('messages.upsert', listener);
  });
}

async function downloadImage(msg) {
  const stream = await downloadMediaMessage(msg, 'buffer', {}, { logger: console });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = setBotPrivacyCommand;
