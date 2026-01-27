const fs = require('fs')
const path = require('path')
const STORE_FILE = path.join(process.cwd(), 'data', 'store.json')

// Config: keep last 20 messages per chat (configurable) - More aggressive for lower RAM
let MAX_MESSAGES = 20

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
                
                // Clean up any existing data to match new format
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

    bind(ev, { decodeJid } = {}) {
        const normalize = (jid) => {
            if (!jid) return jid
            return typeof decodeJid === 'function' ? decodeJid(jid) : jid
        }

        ev.on('messages.upsert', ({ messages }) => {
            messages.forEach(msg => {
                if (!msg.key?.remoteJid) return
                const jid = msg.key.remoteJid
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
                this.messages[jid] = this.messages[jid] || []

                // push new message
                this.messages[jid].push(msg)

                // trim old ones
                if (this.messages[jid].length > MAX_MESSAGES) {
                    this.messages[jid] = this.messages[jid].slice(-MAX_MESSAGES)
                }
            })
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
        return this.messages[jid]?.find(m => m.key.id === id) || null
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