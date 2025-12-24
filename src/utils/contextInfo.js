const fs = require('fs');
const path = require('path');

const imagePath = path.join(__dirname, '../assets/BMM2.jpg');
let imageBuffer = null;

if (fs.existsSync(imagePath)) {
  imageBuffer = fs.readFileSync(imagePath);
}

/**
 * Returns a standard contextInfo object with externalAdReply.
 * @param {object} options - Optional overrides for title, body, and thumbnail.
 * @returns {object} contextInfo
 */
function getContextInfo(options = {}) {
  const {
    title = '🤖 BMM WhatsApp Bot',
    body = 'Powering smart automation.',
    thumbnail = imageBuffer,
    renderLargerThumbnail = false
  } = options;

  return {
    externalAdReply: {
      title,
      body,
      mediaType: 1,
      showAdAttribution: false,
      renderLargerThumbnail,
      thumbnail
    }
  };
}

/**
 * Returns contextInfo for forwarded messages (e.g., newsletter forwarding)
 * @param {object} options - Optional overrides
 * @returns {object} contextInfo
 */
function getForwardedContext(options = {}) {
  const {
    forwardingScore = 999,
    isForwarded = true,
    newsletterJid = '120363403127154832@newsletter',
    newsletterName = '⚡🤖BMM🤖⚡',
    serverMessageId = -1
  } = options;

  return {
    forwardingScore,
    isForwarded,
    forwardedNewsletterMessageInfo: {
      newsletterJid,
      newsletterName,
      serverMessageId
    }
  };
}

module.exports = {
  getContextInfo,
  getForwardedContext
};

