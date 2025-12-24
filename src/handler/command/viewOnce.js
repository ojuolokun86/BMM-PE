const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sendToChat = require('../../utils/sendToChat');
const { getUserPrefix } = require('../../database/database');
const viewOnceMediaStore = {}; // Optionally move to globalStore.js

const SUPPORTED_TYPES = [
  'imageMessage',
  'videoMessage',
  'documentMessage',
  'audioMessage',
  'voiceMessage'
];

/**
 * Store view-once media for later reposting.
 */
const handleViewOnceMessage = async (sock, message) => {
  const remoteJid = message.key.remoteJid;
  const messageId = message.key.id;
  const messageType = Object.keys(message.message?.viewOnceMessage?.message || {})[0];

  if (!messageType || !SUPPORTED_TYPES.includes(messageType)) return;

  try {
    const mediaContent = message.message.viewOnceMessage.message[messageType];
    if (!mediaContent?.directPath || !mediaContent?.mediaKey) return;

    const buffer = await downloadMediaMessage(
      { message: { [messageType]: mediaContent }, key: message.key },
      'buffer',
      { logger: console }
    );

    viewOnceMediaStore[messageId] = {
      buffer,
      mediaType: messageType,
      caption: mediaContent.caption || '',
      senderJid: message.key.participant || message.key.remoteJid,
      timestamp: Date.now(),
      fileName: mediaContent.fileName || 'file',
    };
  } catch (e) {
    console.error('Failed to handle view-once message:', e);
  }
};

/**
 * Detect view-once media in a message or its quoted reply.
 * Returns { mediaType, fullMessage, stored } or null.
 */
function detectViewOnceMedia(message) {
  // 1. Direct viewOnceMessage or viewOnceMessageV2
  const viewOnceMsg =
    message.message?.viewOnceMessage?.message ||
    message.message?.viewOnceMessageV2?.message;
  if (viewOnceMsg) {
    const mediaType = Object.keys(viewOnceMsg).find(key => SUPPORTED_TYPES.includes(key));
    if (mediaType) return { mediaType, fullMessage: message };
  }

  // 2. Direct media message with viewOnce flag (iPhone)
  for (const type of SUPPORTED_TYPES) {
    const media = message.message?.[type];
    if (media && media.viewOnce) return { mediaType: type, fullMessage: message };
  }

  // 3. Quoted message (reply)
  const contextInfo = message.message?.extendedTextMessage?.contextInfo;
  const quotedMsg = contextInfo?.quotedMessage;
  if (quotedMsg) {
    for (const type of SUPPORTED_TYPES) {
      const media = quotedMsg[type];
      if (media && (media.viewOnce || quotedMsg?.viewOnceMessage || quotedMsg?.viewOnceMessageV2)) {
        return { mediaType: type, fullMessage: { message: quotedMsg, key: { ...message.key } } };
      }
      if (
        quotedMsg?.viewOnceMessage?.message?.[type] ||
        quotedMsg?.viewOnceMessageV2?.message?.[type]
      ) {
        return { mediaType: type, fullMessage: { message: quotedMsg, key: { ...message.key } } };
      }
    }
  }

  // 4. Stored view-once media (by stanzaId)
  const quotedId = contextInfo?.stanzaId;
  if (quotedId && viewOnceMediaStore[quotedId]) {
    const stored = viewOnceMediaStore[quotedId];
    return {
      mediaType: stored.mediaType,
      fullMessage: {
        message: { [stored.mediaType]: stored.buffer ? stored.buffer : {} },
        key: { id: quotedId, remoteJid: message.key.remoteJid }
      },
      stored,
    };
  }

  return null;
}
function deepFindSenderJid(fullMessage, stored, originalMsgContext) {
  const viewOnceLayer =
    fullMessage.message?.viewOnceMessage?.message ||
    fullMessage.message?.viewOnceMessageV2?.message;

  const contextInfo =
    viewOnceLayer?.[Object.keys(viewOnceLayer || {})[0]]?.contextInfo;

  // Use participant from original contextInfo (quotedMessage)
  const quotedParticipant =
    originalMsgContext?.quotedMessageContext?.participant ||
    originalMsgContext?.participant;

  return (
    quotedParticipant ||
    contextInfo?.participant ||
    contextInfo?.remoteJid ||
    viewOnceLayer?.contextInfo?.participant ||
    fullMessage.message?.extendedTextMessage?.contextInfo?.participant ||
    fullMessage.key?.participant ||
    stored?.senderJid ||
    fullMessage.key?.remoteJid
  );
}

/**
 * Repost view-once media to chat or DM.
 */
const repostViewOnceMedia = async (sock, detectedMedia, targetJid, caption = null, contextInfo = {}) => {
  try {
    const { fullMessage, mediaType, stored } = detectedMedia;

    // Try to get mediaContent from all possible wrappers
    let mediaContent =
      fullMessage.message?.viewOnceMessage?.message?.[mediaType] ||
      fullMessage.message?.viewOnceMessageV2?.message?.[mediaType] ||
      fullMessage.message?.[mediaType];

    // If still missing directPath or mediaKey, try to dig deeper
    if (
      (!mediaContent?.directPath || !mediaContent?.mediaKey) &&
      (fullMessage.message?.viewOnceMessageV2?.message || fullMessage.message?.viewOnceMessage?.message)
    ) {
      const nested =
        fullMessage.message?.viewOnceMessageV2?.message?.[mediaType] ||
        fullMessage.message?.viewOnceMessage?.message?.[mediaType];
      if (nested) mediaContent = nested;
    }

    // Deep search for senderJid
    let senderJid = deepFindSenderJid(fullMessage, stored, contextInfo);

        // Log for verification
        console.log("📎 Mentioning user JID:", senderJid);

        // if (senderJid && !senderJid.includes('@s.whatsapp.net')) {
        // senderJid = senderJid + '@s.whatsapp.net'; // normalize if needed
        // }
    console.log('🔍 Extracted senderJid for mention:', senderJid);


    // Download buffer if not stored
    let buffer = stored?.buffer;
    let fileName = stored?.fileName || 'file';
    let origCaption = stored?.caption || mediaContent?.caption || '';

    if (!buffer) {
      if (!mediaContent?.directPath || !mediaContent?.mediaKey) {
        await sendToChat(sock, targetJid, { message: '❌ Failed to process the view-once media. It may have expired or been deleted.' });
        return;
      }
      buffer = await downloadMediaMessage(
        { message: { [mediaType]: mediaContent }, key: fullMessage.key },
        'buffer',
        { logger: console }
      );
    }

    let ownerName = 'Unknown';
    try {
      if (sock.user && sock.user.name) ownerName = sock.user.name;
    } catch (e) {}

    const mediaPayload = {
      caption: caption ||
        `🤖 *BMM BOT* 🤖\n\n🔁 Reposted view-once media from @${senderJid?.split('@')[0] || 'unknown'}${
          origCaption ? `\n\n📄 Original Caption: ${origCaption}` : ''
        }\n\n👤 *Owner:* ${ownerName}`,
      mentions: senderJid ? [senderJid] : [],
    };

    // Handle different media types
    if (mediaType === 'imageMessage') {
      mediaPayload.image = buffer;
    } else if (mediaType === 'videoMessage') {
      mediaPayload.video = buffer;
    } else if (mediaType === 'documentMessage') {
      mediaPayload.document = buffer;
      mediaPayload.fileName = fileName;
    } else if (mediaType === 'audioMessage' || mediaType === 'voiceMessage') {
      mediaPayload.audio = buffer;
      mediaPayload.ptt = mediaType === 'voiceMessage';
    } else {
      await sendToChat(sock, targetJid, { message: `❌ Unsupported media type: ${mediaType}.` });
      return;
    }

    await sock.sendMessage(targetJid, mediaPayload);
  } catch (error) {
    await sendToChat(sock, targetJid, { message: '❌ Failed to repost the view-once media. Please try again later.' });
  }
};

/**
 * Main command handler for reposting view-once media.
 * Usage:
 *   - Reply 'vv' to repost to current chat
 *   - Reply 'view' to send to your DM
 */
async function viewOnceCommand(sock, msg, command) {
 
  console.log(`🔍 View-once command detected: ${command}`);

  // Detect view-once media (supports quoted, direct, and stored)
  const detected = detectViewOnceMedia(msg);

  if (!detected) {
    await sendToChat(sock, msg.key.remoteJid, { message: '❌ No view-once media found in the quoted message.' });
    return;
  }

  if (command === 'vv') {
    await repostViewOnceMedia(sock, detected, msg.key.remoteJid, null, msg.message?.extendedTextMessage?.contextInfo);
 } else if (command === 'view') {
  const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  await repostViewOnceMedia(sock, detected, ownerJid, null, msg.message?.extendedTextMessage?.contextInfo);
} else {
    await sendToChat(sock, msg.key.remoteJid, { message: '❌ Unknown view-once command. Use vv or view.' });
    console.log(`❌ Unknown view-once command: ${command}`);
  }
}

module.exports = {
  handleViewOnceMessage,
  repostViewOnceMedia,
  detectViewOnceMedia,
  viewOnceCommand
};

