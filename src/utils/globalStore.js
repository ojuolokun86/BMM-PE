// utils/globalStore.js

const botInstances = {};
const botStartTimes = {}; // { botId: timestamp_ms }
const mediaStore = new Map(); // { messageId: { buffer, caption, type, timestamp } }
const textStore = new Map();  // { messageId: { content, timestamp, deletedBy } }
let globalPresenceType = null;
let presenceTypeStore = {};
let globalDisappearingDuration = 0; // default: Off
let disappearingChats = new Set();


const MAX_MEDIA_FILES = 100;
const MAX_TEXT_FILES = 200;
const EXPIRATION_TIME = 30 * 60 * 1000; // 30  minutes

// MEDIA
// Update saveMediaToStore and getMediaFromStore to handle senderJid
function saveMediaToStore(messageId, buffer, type, caption, deletedBy) {
  mediaStore.set(messageId, {
    buffer,
    type,
    caption,
    deletedBy,
    timestamp: Date.now()
  });
}

function getBotInstanceCount() {
  const count = Object.keys(botInstances).length;
  console.log(`[BOT INSTANCE] Current botInstances: ${count}`, Object.keys(botInstances));
  return count;
}

function getMediaFromStore(messageId) {
  return mediaStore.get(messageId);
}

function deleteMediaFromStore(messageId) {
  mediaStore.delete(messageId);
}

// TEXT
function saveTextToStore(messageId, content, deletedBy) {
  textStore.set(messageId, {
    content,
    deletedBy,
    timestamp: Date.now()
  });
}

function getTextFromStore(messageId) {
  return textStore.get(messageId);
}

function deleteTextFromStore(messageId) {
  textStore.delete(messageId);
}

// Auto-cleanup
setInterval(() => {
  const now = Date.now();

  for (const [id, data] of mediaStore.entries()) {
    if (now - data.timestamp > EXPIRATION_TIME) mediaStore.delete(id);
  }

  for (const [id, data] of textStore.entries()) {
    if (now - data.timestamp > EXPIRATION_TIME) textStore.delete(id);
  }

  if (mediaStore.size > MAX_MEDIA_FILES) {
    const extra = mediaStore.size - MAX_MEDIA_FILES;
    const oldest = [...mediaStore.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < extra; i++) mediaStore.delete(oldest[i][0]);
  }

  if (textStore.size > MAX_TEXT_FILES) {
    const extra = textStore.size - MAX_TEXT_FILES;
    const oldest = [...textStore.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < extra; i++) textStore.delete(oldest[i][0]);
  }
}, 60 * 1000); // Every minute

module.exports = {
  botInstances,
  botStartTimes,
  globalPresenceType,
  presenceTypeStore,
  globalDisappearingDuration,
  disappearingChats,

  // Media
  mediaStore,
  saveMediaToStore,
  getMediaFromStore,
  deleteMediaFromStore,

  // Text
  saveTextToStore,
  getTextFromStore,
  deleteTextFromStore,
  getBotInstanceCount
};
