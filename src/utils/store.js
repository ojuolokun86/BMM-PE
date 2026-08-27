const fs = require('fs')
const path = require('path')
const { saveChatbotMessages, mergeChatbotHistory, mergeChatbotMemory } = require('../database/database')
const STORE_FILE = path.join(process.cwd(), 'data', 'store.json')

// This cache supports Baileys getMessage; SQLite is the durable chatbot history.
const MAX_MESSAGES = 120

function messageTimestamp(message) {
    const timestamp = message?.messageTimestamp
    return typeof timestamp === 'object'
        ? Number(timestamp.low || timestamp.value || 0)
        : Number(timestamp || 0)
}

function messageText(message) {
    return message?.message?.conversation
        || message?.message?.extendedTextMessage?.text
        || message?.message?.imageMessage?.caption
        || message?.message?.videoMessage?.caption
        || ''
}

// Try to read config from settings
// try {
//     const settings = require('../settings.js')
//     if (settings.maxStoreMessages && typeof settings.maxStoreMessages === 'number') {
//         MAX_MESSAGES = settings.maxStoreMessages
//     }
// } catch (e) {
//     // Use default if settings not available
// }

const store = {
    messages: {},
    contacts: {},
    chats: {},
    jidAliases: new Map(),

    normalizeJid(jid) {
        let current = jid
        const visited = new Set()
        while (current && this.jidAliases.has(current) && !visited.has(current)) {
            visited.add(current)
            current = this.jidAliases.get(current)
        }
        return current
    },

    registerJidMapping({ lid, pn } = {}) {
        if (!lid || !pn) return
        const existingLidMessages = this.messages[lid]
        if (existingLidMessages?.length) {
            this.addMessages(existingLidMessages.map(message => ({
                ...message,
                key: { ...message.key, remoteJid: pn }
            })))
        }
        delete this.messages[lid]
        mergeChatbotHistory(lid, pn)
        mergeChatbotMemory(lid, pn)
        this.jidAliases.set(lid, pn)
        this.jidAliases.set(pn, pn)
    },

    readFromFile(filePath = STORE_FILE) {
        try {
            if (fs.existsSync(filePath)) {
                const size = fs.statSync(filePath).size
                if (size > 5 * 1024 * 1024) {
                    console.warn(`Store file too large (${size} bytes). Skipping load to reduce memory.`)
                    return
                }

                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
                this.contacts = data.contacts || {}
                this.chats = data.chats || {}
                this.messages = {}
                this.cleanupData()
            }
        } catch (e) {
            console.warn('Failed to read store file:', e.message)
        }
    },

    writeToFile(filePath = STORE_FILE) {
        try {
            fs.mkdirSync(path.dirname(filePath), { recursive: true })
            const data = JSON.stringify({
                contacts: this.contacts,
                chats: this.chats,
                messages: {}
            })
            fs.writeFileSync(filePath, data)
        } catch (e) {
            console.warn('Failed to write store file:', e.message)
        }
    },

    cleanupData() {
        // Convert old format messages to new format if needed
        if (this.messages) {
            Object.keys(this.messages).forEach(jid => {
                if (typeof this.messages[jid] === 'object' && !Array.isArray(this.messages[jid])) {
                    // Old format - convert to new format
                    const messages = Object.values(this.messages[jid])
                    this.messages[jid] = messages.slice(-MAX_MESSAGES)
                }
            })
        }
    },

    addMessages(messages, { decodeJid } = {}) {
        const normalize = (jid) => this.normalizeJid(typeof decodeJid === 'function' ? decodeJid(jid) : jid)
        const historyRows = []
        for (const msg of messages || []) {
            const rawJid = msg?.key?.remoteJid
            if (!rawJid || rawJid === 'status@broadcast') continue
            const jid = normalize(rawJid)
            const text = messageText(msg)
            if (text.trim() && !jid.endsWith('@g.us')) {
                historyRows.push({
                    chatId: jid,
                    messageId: msg.key.id,
                    role: msg.key.fromMe ? 'assistant' : 'user',
                    content: text,
                    timestamp: messageTimestamp(msg)
                })
            }
            const chatMessages = this.messages[jid] || []
            if (!chatMessages.some(existing => existing.key?.id === msg.key.id)) {
                chatMessages.push(msg)
            }
            chatMessages.sort((left, right) => messageTimestamp(left) - messageTimestamp(right))
            this.messages[jid] = chatMessages.slice(-MAX_MESSAGES)
        }
        if (historyRows.length) saveChatbotMessages(historyRows)
    },

    bind(ev, { decodeJid } = {}) {
        const normalize = (jid) => {
            if (!jid) return jid
            return typeof decodeJid === 'function' ? decodeJid(jid) : jid
        }

        ev.on('messages.upsert', ({ messages }) => {
            messages.forEach(msg => {
                if (!msg.key?.remoteJid) return
                const jid = normalize(msg.key.remoteJid)
                if (jid === 'status@broadcast') return

                if (!msg.key.fromMe) {
                    const isGroup = jid.endsWith('@g.us')
                    const senderJid = isGroup ? msg.key.participant : jid
                    const senderId = normalize(senderJid)
                    if (senderId) {
                        const existing = this.contacts[senderId]
                        const name = msg.pushName || ''
                        if (!existing) {
                            this.contacts[senderId] = { id: senderId, name }
                        } else if (name && (!existing.name || existing.name !== name)) {
                            this.contacts[senderId] = { ...existing, id: senderId, name }
                        }
                    }
                }
                this.addMessages([msg], { decodeJid })
            })
        })

        ev.on('messaging-history.set', ({ messages, chats, contacts }) => {
            this.addMessages(messages, { decodeJid })
            ;(chats || []).forEach(chat => {
                const id = normalize(chat.id)
                if (id) this.chats[id] = { id, subject: chat.subject || '' }
            })
            ;(contacts || []).forEach(contact => {
                if (contact.id) this.contacts[normalize(contact.id)] = contact
            })
        })

        ev.on('lid-mapping.update', (mapping) => {
            this.registerJidMapping(mapping)
        })

        ev.on('contacts.update', (contacts) => {
            contacts.forEach(contact => {
                if (contact.id) {
                    const id = normalize(contact.id)
                    this.contacts[id] = {
                        id,
                        name: contact.notify || contact.name || ''
                    }
                }
            })
        })

        ev.on('chats.set', (payload) => {
            this.chats = {}
            const chats = Array.isArray(payload) ? payload : (payload?.chats || [])
            chats.forEach(chat => {
                const id = normalize(chat.id)
                this.chats[id] = { id, subject: chat.subject || '' }
            })
        })
    },

    async loadMessage(jid, id) {
        const canonicalJid = this.normalizeJid(jid)
        return this.messages[canonicalJid]?.find(m => m.key.id === id) || null
    },

    async loadMessages(jid, count = 30) {
        const canonicalJid = this.normalizeJid(jid)
        return (this.messages[canonicalJid] || []).slice(-Math.max(0, count))
    },

    // Get store statistics
    getStats() {
        let totalMessages = 0
        let totalContacts = Object.keys(this.contacts).length
        let totalChats = Object.keys(this.chats).length
        
        Object.values(this.messages).forEach(chatMessages => {
            if (Array.isArray(chatMessages)) {
                totalMessages += chatMessages.length
            }
        })
        
        return {
            messages: totalMessages,
            contacts: totalContacts,
            chats: totalChats,
            maxMessagesPerChat: MAX_MESSAGES
        }
    }
}

module.exports = store