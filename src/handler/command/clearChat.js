const { isBotOwner } = require('../../database/database');
const { checkIfAdmin } = require('./kick');

/**
 * Clear all messages in a DM chat
 */
async function clearDmChat(sock, jid) {
    let success = false;
    let deletedCount = 0;
    try {
        // Try to get store from different possible locations
        const store = sock.store || (sock.ev && sock.ev.store) || (sock.ev && sock.ev.socket && sock.ev.socket.store);
        
        if (!store) {
            console.error('❌ Message store not available on socket');
            return false;
        }
        if (!store.messages) {
            console.error('❌ Messages store not initialized');
            return;
        }
        
        // Get messages for the chat
        if (!store.messages[jid]) {
            console.log('No messages found in store for', jid);
            return false;
        }
        
        // Get all message objects from the store
        const allMessages = [];
        const storeMessages = store.messages[jid];
        
        // Safely extract message objects
        if (storeMessages) {
            if (typeof storeMessages === 'object' && !Array.isArray(storeMessages)) {
                for (const [id, msg] of Object.entries(storeMessages)) {
                    if (msg && typeof msg === 'object' && msg.key && typeof msg.key === 'object' && msg.key.id) {
                        allMessages.push(msg);
                    }
                }
            } else if (Array.isArray(storeMessages)) {
                allMessages.push(...storeMessages.filter(msg => 
                    msg && 
                    typeof msg === 'object' && 
                    msg.key && 
                    typeof msg.key === 'object' && 
                    msg.key.id
                ));
            }
        }
        
        if (!allMessages.length) {
            console.log('No valid messages to delete');
            return false;
        }
        
        console.log(`Found ${allMessages.length} valid messages to delete`);
        
        // Process and delete messages
        for (const msg of allMessages) {
            try {
                if (!msg || !msg.key || !msg.key.id) {
                    console.warn('⚠️ Invalid message format:', msg);
                    continue;
                }
                
                // Try to delete the message
                await sock.sendMessage(jid, { 
                    delete: { 
                        id: msg.key.id, 
                        remoteJid: jid, 
                        fromMe: msg.key.fromMe || false 
                    } 
                });
                
                console.log(`🗑️ Deleted DM msg: ${msg.key.id}`);
                deletedCount++;
                await new Promise(res => setTimeout(res, 1500));
            } catch (err) {
                console.error(`⚠️ Failed to delete message:`, err);
            }
        }
        
        if (deletedCount > 0) {
            success = true;
            console.log(`✅ Successfully deleted ${deletedCount} messages from DM`);
        }
    } catch (err) {
        console.error('❌ Failed to clear DM chat:', err);
    }
}


/**
 * Clear all messages in a group (delete for everyone, batch of 50).
 */
async function clearGroupChat(sock, groupJid, msg) {
    let success = false;
    let deletedCount = 0;
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
        const isAdmin = await checkIfAdmin(sock, groupJid, senderId);
        const isBotAdmin = await checkIfAdmin(sock, groupJid, botLid);
        
        if (!isBotAdmin) {
            return await sock.sendMessage(groupJid, {
                text: "❌ I need to be an admin to clear messages in this group."
            }, { quoted: msg });
        }

        // Try to get store from different possible locations
        const store = sock.store || (sock.ev && sock.ev.store) || (sock.ev && sock.ev.socket && sock.ev.socket.store);
        
        if (!store) {
            return await sock.sendMessage(groupJid, {
                text: "❌ Message store not available. Please try again."
            }, { quoted: msg });
        }
        if (!store.messages) {
            return await sock.sendMessage(groupJid, {
                text: "❌ Message store not initialized. Please try again later."
            }, { quoted: msg });
        }
        
        // Get messages for the group
        if (!store.messages[groupJid]) {
            return await sock.sendMessage(groupJid, {
                text: "❌ No messages found in the chat history."
            }, { quoted: msg });
        }

        // Get all message objects from the store
        const allMessages = [];
        const storeMessages = store.messages[groupJid];
        
        // Safely extract message objects
        if (storeMessages) {
            if (typeof storeMessages === 'object' && !Array.isArray(storeMessages)) {
                for (const [id, msg] of Object.entries(storeMessages)) {
                    if (msg && typeof msg === 'object' && msg.key && typeof msg.key === 'object' && msg.key.id) {
                        allMessages.push(msg);
                    }
                }
            } else if (Array.isArray(storeMessages)) {
                allMessages.push(...storeMessages.filter(msg => 
                    msg && 
                    typeof msg === 'object' && 
                    msg.key && 
                    typeof msg.key === 'object' && 
                    msg.key.id
                ));
            }
        }
        
        if (!allMessages.length) {
            return await sock.sendMessage(groupJid, {
                text: "❌ No valid messages to delete in this chat."
            }, { quoted: msg });
        }
        
        console.log(`Found ${allMessages.length} valid messages to delete in group`);
        
        let deletedCount = 0;
        const messagesToDelete = allMessages;
        const DELAY = 1500;

        // Delete messages in reverse order (newest first)
        for (let i = messagesToDelete.length - 1; i >= 0; i--) {
            const msg = messagesToDelete[i];
            try {
                if (!msg || !msg.key || !msg.key.id) {
                    console.warn('⚠️ Invalid message format in group:', msg);
                    continue;
                }
                
                await sock.sendMessage(groupJid, { 
                    delete: { 
                        id: msg.key.id, 
                        remoteJid: groupJid, 
                        fromMe: msg.key.fromMe || false,
                        participant: msg.key.participant || undefined
                    } 
                });
                
                console.log(`🗑️ Deleted group msg: ${msg.key.id}`);
                deletedCount++;
                await new Promise(res => setTimeout(res, DELAY));
            } catch (err) {
                console.error(`⚠️ Failed to delete group message:`, err);
            }
        }

        if (deletedCount > 0) {
            success = true;
            await sock.sendMessage(groupJid, {
                text: `✅ Cleared ${deletedCount} messages from this group!`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(groupJid, {
                text: "❌ No messages were deleted. The chat might be empty or an error occurred."
            }, { quoted: msg });
        }

    } catch (err) {
        console.error("❌ Error in clearGroupChat:", err);
        await sock.sendMessage(groupJid, {
            text: "❌ Failed to clear group chat. Try again."
        }, { quoted: msg });
    }
}


/**
 * Dispatcher function: decides DM vs Group
 */
async function clearChat(sock, from, msg) {
    try {
        const sender = msg.key.participant || msg.key.remoteJid;
        const botId = sock.user.id.split(':')[0].split('@')[0];
        const botLid = sock.user.lid.split(':')[0].split('@')[0];
        const senderId = sender.split(':')[0].split('@')[0];

        if (from.endsWith('@g.us')) {
            console.log('clearChat: group detected');
            const success = await clearGroupChat(sock, from, msg);
            if (success) {
                await sock.sendMessage(from, {
                    text: "✅ Group chat cleared successfully!"
                }, { quoted: msg });
            }
        } else {
            console.log('clearChat: DM detected');
            if (!msg.key.fromMe && !isBotOwner(senderId, botId, botLid)) {
                return await sock.sendMessage(from, {
                    text: "❌ This command can only be used by the bot owner."
                }, { quoted: msg });
            }
            const success = await clearDmChat(sock, from);
            if (success) {
                await sock.sendMessage(from, {
                    text: "✅ Chat cleared successfully!"
                }, { quoted: msg });
            }
        }
    } catch (error) {
        console.error('Error in clearChat:', error);
        await sock.sendMessage(from, {
            text: "❌ An error occurred while trying to clear the chat."
        }, { quoted: msg });
    }
}

module.exports = {
    clearChat
};
