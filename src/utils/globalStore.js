// utils/globalStore.js
const { saveMediaToDisk, saveTextToDisk, getMediaFromDisk, getTextFromDisk } = require('./diskStore');

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
// Add these helper functions at the top of globalStore.js
function getObjectSize(obj) {
  return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

// Add these methods to the exports
function getStoreStats() {
  let mediaSize = 0;
  let textSize = 0;
  
  // Calculate media store size
  for (const [key, value] of mediaStore.entries()) {
    mediaSize += getObjectSize(key) + getObjectSize(value);
  }
  
  // Calculate text store size
  for (const [key, value] of textStore.entries()) {
    textSize += getObjectSize(key) + getObjectSize(value);
  }
  
  return {
    media: {
      count: mediaStore.size,
      size: mediaSize,
      formatted: formatBytes(mediaSize)
    },
    text: {
      count: textStore.size,
      size: textSize,
      formatted: formatBytes(textSize)
    },
    total: {
      count: mediaStore.size + textStore.size,
      size: mediaSize + textSize,
      formatted: formatBytes(mediaSize + textSize)
    }
  };
}


// MEDIA
// Update saveMediaToStore and getMediaFromStore to handle senderJid
async function saveMediaToStore(messageId, buffer, type, caption, deletedBy) {
  try {
    // Save to disk first
    const mediaInfo = await saveMediaToDisk(messageId, buffer, type, caption, deletedBy);
    if (!mediaInfo) return null;

    // Then save to memory
    mediaStore.set(messageId, {
      buffer,
      type,
      caption,
      deletedBy,
      timestamp: Date.now()
    });

    return mediaInfo;
  } catch (error) {
    console.error('Error saving media to store:', error);
    return null;
  }
}

function getBotInstanceCount() {
  const count = Object.keys(botInstances).length;
  console.log(`[BOT INSTANCE] Current botInstances: ${count}`, Object.keys(botInstances));
  return count;
}

function getMediaFromStore(messageId) {
  const ram = mediaStore.get(messageId);
  if (ram) return ram;

  const disk = getMediaFromDisk(messageId);
  if (!disk) return null;

  // optional: re-cache in RAM
  mediaStore.set(messageId, {
    buffer: disk.buffer,
    timestamp: Date.now()
  });

  return disk;
}

function deleteMediaFromStore(messageId) {
  mediaStore.delete(messageId);
}

// TEXT
async function saveTextToStore(messageId, content, deletedBy) {
  try {
    // Create the text data object
    const textData = {
      messageId,
      content,
      deletedBy,
      timestamp: Date.now()
    };

    // Save to memory
    textStore.set(messageId, textData);
    
    // Save to disk
    await saveTextToDisk(messageId, content, deletedBy);
    
    return textData;
  } catch (error) {
    console.error('Error in saveTextToStore:', error);
    return null;
  }
}

async function getTextFromStore(messageId) {
  try {
    // Check in-memory store first
    if (textStore.has(messageId)) {
      return textStore.get(messageId);
    }
    
    // If not in memory, try to load from disk
    const textData = await getTextFromDisk(messageId);
    if (textData) {
      // Cache in memory for future access
      textStore.set(messageId, textData);
    }
    return textData || null;
  } catch (error) {
    console.error('Error getting text from store:', error);
    return null;
  }
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
  getBotInstanceCount,
  getStoreStats,
  mediaStore,
  textStore,
};
