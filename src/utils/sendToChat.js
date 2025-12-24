const fs = require('fs');
const path = require('path');
const { getContextInfo, getForwardedContext } = require('../utils/contextInfo');
const { recordBotActivity } = require('../database/database');

// Load a thumbnail image for rich preview (optional)
const imagePath = path.join(__dirname, '../assets/BMM2.jpg');
let imageBuffer = null;
if (fs.existsSync(imagePath)) {
  imageBuffer = fs.readFileSync(imagePath);
}
//  // Default quoted message
//   const isGroup = chatId.endsWith('@g.us'); // Detect group

// const quoted = {
//   key: {
//     remoteJid: isGroup ? chatId : '0@s.whatsapp.net',
//     fromMe: false,
//     id: 'BAE5F7A9BE3DFA85',
//     participant: isGroup ? '0@s.whatsapp.net' : undefined,
//   },
//   message: {
//     conversation: isGroup ? 'BMM V2 Engine Group' : 'BMM V2 Engine',
//   },
// };


/**
 * send a message with quoted info
 */
function quotedInfo() {
  return {
    key: {
      remoteJid: '0@s.whatsapp.net',
      fromMe: false,
      id: 'BAE5F7A9BE3DFA85',
      participant: '0@s.whatsapp.net',
    },
    message: {
      conversation: 'BMM V2 Engine',
    }
  };
}

/**
 * Send a message (text or media) to a WhatsApp chat with preview, context, and quoted.
 * @param {object} sock - The Baileys socket instance.
 * @param {string} chatId - The WhatsApp chat ID (e.g., 2348012345678@s.whatsapp.net).
 * @param {object} options - Message options.
 *   - message: string (text message)
 *   - media: Buffer|Stream (optional)
 *   - mediaType: 'image'|'video'|'audio'|'document'|'voice' (optional)
 *   - caption: string (optional, for media)
 *   - mentions: array of JIDs (optional)
 */
async function sendToChat(sock, chatId, options = {}) {
  const {
    message,
    media,
    mediaType,
    caption,
    mentions = []
  } = options;


  const quoted = quotedInfo();

  try {
    if (!sock?.sendMessage) throw new TypeError('Invalid Baileys socket');
    if (!chatId?.endsWith('@s.whatsapp.net') && !chatId?.endsWith('@g.us')) throw new Error(`Invalid chatId: "${chatId}"`);
    if (!message && !media) throw new Error('Either "message" or "media" must be provided.');

    let payload;
    if (media) {
      const type = mediaType || 'image';
      payload = {
        [type]: media,
        caption: caption || '',
        mentions,
        ...(type === 'audio' || type === 'voice' ? { ptt: type === 'voice' } : {})
      };
    } else {
      payload = {
        text: message,
        mentions
      };
    }

    // Only add contextInfo if not a mention
    if (!mentions || mentions.length === 0) {
      payload.contextInfo = {
        ...getContextInfo()
      };
    }

    await sock.sendMessage(chatId, payload, { quoted });
    //console.log(`✅ Sent to ${chatId}:`, message || '[media]');
  } catch (err) {
    
    console.error(`❌ sendToChat error for ${chatId}:`, err.message);
  }
}
const { botInstances } = require('./globalStore');
/**
 * Send a message to a user with their name
 */
async function sendToUser(userId, options = {}) {
  const sock = botInstances[userId];
  if (!sock) throw new Error(`User ${userId} not found`);
  const name = sock.contacts?.[userId]?.name || userId;
  options.mentions = [userId];
  await sendToChat(sock, userId, options);
}

module.exports = sendToChat;
module.exports.sendToUser = sendToUser;
module.exports.quotedInfo = quotedInfo;