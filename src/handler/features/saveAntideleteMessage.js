const { saveMediaToStore, saveTextToStore } = require('../../utils/globalStore');
const { getAntideleteMode, isGroupExcluded } = require('../../database/antideleteDb');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// 🔥 Call this in your msg handler when a new message is received
async function handleIncomingForAntidelete(sock, msg) {
  const { remoteJid: chatId, id: msgId, fromMe } = msg.key;
  const botId = sock.user?.id?.split(':')[0];
  const botLid = sock.user?.lid?.split(':')[0];
  const isGroup = chatId.endsWith('@g.us');

  if (fromMe) return; // Skip messages from bot

  // Find the real sender JID
  let senderJid = null;
  if (isGroup) {
    // In group, participant is always the sender
    senderJid = msg.key.participant;
  } else {
    // In DM, the sender is the chatId (the user chatting with the bot)
    senderJid = chatId;
  }
   let byMe;
        if (isGroup) {
            byMe = msg.key.participant || chatId;
        } else {
            byMe = msg.key.fromMe ? (botLid || botId) : chatId;
        }

  const mode = getAntideleteMode(botId);
  if (chatId == 'status@broadcast') return; // Skip status messages
  if (mode === 'off') return;
  if (isGroupExcluded(botId, chatId)) return;
  if (byMe === botLid || byMe === botId) return; // Skip if deleted by bot itself

  const shouldSave =
    mode === 'both' ||
    (mode === 'group' && isGroup) ||
    (mode === 'chat' && !isGroup);
  // console.log('🔍 Antidelete check:', { mode, isGroup, shouldSave, senderJid });

  if (!shouldSave) return;

  const message = msg.message;
  if (!message) return;

  const type = Object.keys(message)[0];


  
  // Save text
  if (type === 'conversation') {
    const content = message.conversation;
    saveTextToStore(msgId, content, senderJid);
    return;
  }

  if (type === 'extendedTextMessage' && message.extendedTextMessage.text) {
    const content = message.extendedTextMessage.text;
    saveTextToStore(msgId, content, senderJid);
    return;
  }

  // Save media
  const isMedia =
    message?.imageMessage ||
    message?.videoMessage ||
    message?.documentMessage ||
    message?.stickerMessage ||
    message?.audioMessage;

 // Save media (add senderJid)
if (isMedia) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: null });
    const caption = message[type]?.caption || '';
    const cleanType = type.replace('Message', '');
    saveMediaToStore(msgId, buffer, cleanType, caption, senderJid); // <-- add senderJid
  } catch (e) {
    console.error(`❌ Failed to save media for ${msgId}:`, e.message);
  }
}
  //console.log(`✅ Saved ${type} for ${msgId} in ${chatId} from ${senderJid}`);
}

module.exports = handleIncomingForAntidelete;