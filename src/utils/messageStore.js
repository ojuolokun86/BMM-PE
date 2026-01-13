// e:\Botdevelopment\BMM V3\BMM DEV V3\src\utils\messageStore.js
const NodeCache = require('node-cache');
const { proto } = require('@whiskeysockets/baileys');

// Create a new cache with 5-minute TTL (300 seconds)
const messageCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes in seconds
  checkperiod: 60, // Check for expired items every 60 seconds
  useClones: false, // Better performance, but be careful with object references
  deleteOnExpire: true // Automatically remove expired items
});

class MessageStore {
  constructor() {
    this.bind = this.bind.bind(this);
    this.loadMessage = this.loadMessage.bind(this);
    this.loadMessages = this.loadMessages.bind(this);
    this.saveMessage = this.saveMessage.bind(this);
    this.updateMessage = this.updateMessage.bind(this);
    this.deleteMessage = this.deleteMessage.bind(this);
    this.fetchMessage = this.loadMessage; // Alias for compatibility
  }

  /**
   * Bind to an event emitter
   * @param {EventEmitter} ev - The event emitter to bind to
   */
  bind(ev) {
    ev.on('messages.upsert', ({ messages }) => {
      for (const message of messages) {
        this.saveMessage(message);
      }
    });
    
    ev.on('messages.update', (updates) => {
      for (const update of updates) {
        this.updateMessage(update);
      }
    });
    
    ev.on('messages.delete', (item) => {
      if (item.keys) {
        for (const key of item.keys) {
          this.deleteMessage(key);
        }
      }
    });
  }

  /**
   * Load a single message
   * @param {Object} key - The message key
   * @param {string} key.remoteJid - The JID of the chat
   * @param {string} key.id - The message ID
   * @returns {Promise<proto.IWebMessageInfo>} The message or undefined if not found
   */
    async loadMessage(key, id) {
    // Handle both parameter styles:
    // 1. loadMessage({ remoteJid, id })
    // 2. loadMessage(jid, id)
    if (typeof key === 'string' && id) {
        key = { remoteJid: key, id };
    }
    
    if (!key?.remoteJid || !key?.id) return undefined;
    const cacheKey = this._getCacheKey(key);
    return messageCache.get(cacheKey);
    }

  /**
   * Load multiple messages
   * @param {string} jid - The JID of the chat
   * @param {number} limit - Maximum number of messages to load
   * @returns {Promise<proto.IWebMessageInfo[]>} Array of messages
   */
  async loadMessages(jid, limit) {
    const allMessages = [];
    const keys = messageCache.keys();
    
    for (const key of keys) {
      if (key.startsWith(jid)) {
        const message = messageCache.get(key);
        if (message) {
          allMessages.push(message);
        }
      }
    }
    
    // Sort by message timestamp (newest first)
    allMessages.sort((a, b) => (b.messageTimestamp || 0) - (a.messageTimestamp || 0));
    
    return allMessages.slice(0, limit);
  }

  /**
   * Save a message to the store
   * @param {proto.IWebMessageInfo} message - The message to save
   */
  saveMessage(message) {
    if (!message?.key?.remoteJid || !message?.key?.id) return;
    const cacheKey = this._getCacheKey(message.key);
    messageCache.set(cacheKey, message);
  }

  /**
   * Update an existing message
   * @param {Object} update - The update object
   */
  updateMessage(update) {
    if (!update?.key?.remoteJid || !update?.key?.id) return;
    const cacheKey = this._getCacheKey(update.key);
    const existing = messageCache.get(cacheKey);
    
    if (existing) {
      const updated = { ...existing, ...update };
      messageCache.set(cacheKey, updated);
    }
  }

  /**
   * Delete a message from the store
   * @param {Object} key - The message key
   */
  deleteMessage(key) {
    if (!key?.remoteJid || !key?.id) return;
    const cacheKey = this._getCacheKey(key);
    messageCache.del(cacheKey);
  }

  /**
   * Clear all messages
   */
  clear() {
    messageCache.flushAll();
  }

  /**
   * Generate a cache key from message key
   * @private
   */
  _getCacheKey(key) {
    return `${key.remoteJid}:${key.id}`;
  }
}

// Create a singleton instance
const messageStore = new MessageStore();

module.exports = messageStore;