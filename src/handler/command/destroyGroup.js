const sendToChat = require('../../utils/sendToChat');
const { getGroupAdmins } = require('./groupCommand');
const { isBotOwner } = require('../../database/database');

const CONFIRM_TIMEOUT_MS = 60000; // 1 minute timeout for confirmation

// Track ongoing destroy operations per group
const destroyOperations = {};

/**
 * Check if user is admin in the group
 */
async function checkIfAdmin(sock, groupId, userId) {
    try {
        const fullUserId = userId.includes('@') ? userId : `${userId}@lid`;
        const admins = await getGroupAdmins(sock, groupId);
        return admins.includes(fullUserId);
    } catch (err) {
        console.error(`⚠️ Failed to check admin status in group ${groupId}:`, err);
        return false;
    }
}

/**
 * Destroy group command handler
 */
async function destroyGroupCommand(sock, msg, command, args, from) {
    const groupId = from;
    const senderId = msg.key.participant || msg.participant || msg.key.remoteJid;
    const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0] || '';
    const senderNumber = senderId.split('@')[0];

    // Only allow in groups
    if (!groupId.endsWith('@g.us')) {
        await sendToChat(sock, groupId, { 
            message: "❌ This command can only be used in groups." 
        }, { quoted: msg });
        return;
    }

    // Check if user is admin
    const isAdmin = await checkIfAdmin(sock, groupId, senderId);
    if (!isAdmin) {
        await sendToChat(sock, groupId, { 
            message: "❌ command not accepted \n> sudo need admin previlege." 
        }, { quoted: msg });
        return;
    }

    const isBotAdmin = await checkIfAdmin(sock, groupId, botLid);
    if (!isBotAdmin) {
        await sendToChat(sock, groupId, { 
            message: "❌ I need to be an admin to destroy this group.\n> Admin previlege required." 
        }, { quoted: msg });
        return;
    }

    // Check if there's already a pending destroy operation
    if (destroyOperations[groupId]) {
        await sendToChat(sock, groupId, { 
            message: "⚠️ There's already a pending destroy operation. Please wait for it to complete or timeout." 
        }, { quoted: msg });
        return;
    }

    // Ask for confirmation
    const confirmMessage = {
        text: `⚠️ *DESTROY GROUP CONFIRMATION* ⚠️\n\n` +
              `Are you sure you want to *DESTROY* this group? This action is *IRREVERSIBLE* and will delete the group for all participants.\n\n` +
              `*Reply to this message* with:\n` +
              `- "yes" to confirm\n` +
              `- "no" to cancel\n\n` +
              `_You have 60 seconds to confirm._`,
        mentions: []
    };

    try {
        // First send the message and get its ID
        const message = {
            text: confirmMessage.text,
            mentions: []
        };
        
        // Send the message directly using sock to get the full response
        const sentMsg = await sock.sendMessage(groupId, message, { quoted: msg });
        
        // Get the message ID from the sent message
        const confirmMsgId = sentMsg?.key?.id || 
                           (Array.isArray(sentMsg) ? sentMsg[0]?.key?.id : null);
        
        if (!confirmMsgId) {
            console.error('Failed to get confirmation message ID from response:', sentMsg);
            throw new Error('Failed to get confirmation message ID');
        }
        
        // Store the message ID in the operation data
        destroyOperations[groupId] = {
            senderId,
            confirmMsgId,
            timestamp: Date.now(),
            timeout: setTimeout(() => {
                if (destroyOperations[groupId]) {
                    delete destroyOperations[groupId];
                    sendToChat(sock, groupId, { 
                        message: "⏰ Destroy group operation timed out." 
                    }).catch(console.error);
                }
            }, CONFIRM_TIMEOUT_MS)
        };
        
    } catch (error) {
        console.error('Failed to send confirmation message:', error);
        // If we failed to send the message, clean up any existing operation
        if (destroyOperations[groupId]) {
            clearTimeout(destroyOperations[groupId].timeout);
            delete destroyOperations[groupId];
        }
        return await sendToChat(sock, groupId, { 
            message: `❌ Failed to initialize destroy operation: ${error.message || 'Unknown error'}` 
        }, { quoted: msg });
    }

    // Operation data is now stored in the try block

    // Set up message listener for confirmation
    const listener = async (ev) => {
        const reply = ev.messages?.[0];
        if (!reply) return;

        const replyFrom = reply.key.remoteJid;
        const replySender = reply.key.participant || reply.key.remoteJid;
        
        // Only process messages from the same group and sender
        if (replyFrom !== groupId || replySender !== senderId) return;

        const context = reply.message?.extendedTextMessage?.contextInfo;
        const operation = destroyOperations[groupId];
        if (!operation) return; // No active operation for this group
        
        const isReplyToConfirm = context?.stanzaId === operation.confirmMsgId;
        if (!isReplyToConfirm) return;

        const body = reply.message?.conversation || reply.message?.extendedTextMessage?.text || '';
        const text = body.trim().toLowerCase();

        // Clean up the operation if it exists
        if (destroyOperations[groupId]) {
            clearTimeout(destroyOperations[groupId].timeout);
            delete destroyOperations[groupId];
        }

        // Handle confirmation
        if (text === 'yes') {
            try {
                // Get updated group metadata
                const metadata = await sock.groupMetadata(groupId);
                const participants = metadata.participants;
                const botRawJid = sock.user?.lid;
                const botNumber = botRawJid?.split(':')[0]?.split('@')[0];
                const botJid = `${botNumber}@lid`;
                const intervalMs = 2000;

                let hasErrors = false; // Track if we encounter any critical errors

                // 1. First, demote all admins except the bot
                const adminsToDemote = participants.filter(p => {
                    const pNumber = p.id.split('@')[0];
                    return p.admin && pNumber !== botNumber && !p.id.endsWith('@s.whatsapp.net');
                });
                
                if (adminsToDemote.length > 0) {
                    await sendToChat(sock, groupId, { 
                        message: `⏳ Demoting ${adminsToDemote.length} admin(s)...` 
                    });
                    
                    for (const admin of adminsToDemote) {
                        try {
                            await sock.groupParticipantsUpdate(groupId, [admin.id], 'demote');
                            await sendToChat(sock, groupId, {
                                message: `⬇️ Demoted @${admin.id.split('@')[0]}`,
                                mentions: [admin.id]
                            });
                            await new Promise(resolve => setTimeout(resolve, intervalMs));
                        } catch (error) {
                            console.error(`Failed to demote ${admin.id}:`, error);
                            hasErrors = true;
                            await sendToChat(sock, groupId, {
                                message: `❌ Failed to demote @${admin.id.split('@')[0]}`,
                                mentions: [admin.id]
                            });
                            await new Promise(resolve => setTimeout(resolve, 1500));
                        }
                    }
                }

                // Check if demotion phase had critical errors
                if (hasErrors) {
                    await sendToChat(sock, groupId, {
                        message: '❌ Destroy group operation cancelled due to demotion failures.'
                    });
                    return;
                }
                
                // 2. Remove all members except bot and sender
                const membersToRemove = participants.filter(p => {
                    const pNumber = p.id.split('@')[0];
                    return pNumber !== botNumber && p.id !== senderId;
                });
                
                if (membersToRemove.length > 0) {
                    await sendToChat(sock, groupId, { 
                        message: `⏳ Removing ${membersToRemove.length} member(s)...` 
                    });
                    
                    for (const member of membersToRemove) {
                        try {
                            await sock.groupParticipantsUpdate(groupId, [member.id], 'remove');
                            await sendToChat(sock, groupId, {
                                message: `❌ Removed @${member.id.split('@')[0]}`,
                                mentions: [member.id]
                            });
                            await new Promise(resolve => setTimeout(resolve, intervalMs));
                        } catch (error) {
                            console.error(`Failed to remove ${member.id}:`, error);
                            await sendToChat(sock, groupId, {
                                message: `❌ Failed to remove @${member.id.split('@')[0]}`,
                                mentions: [member.id]
                            });
                            await new Promise(resolve => setTimeout(resolve, 1500));
                        }
                    }
                }
                
                // 3. Finally leave the group
                await sendToChat(sock, groupId, { 
                    message: '👋 Leaving the group now...' 
                });
                
                await sock.groupLeave(groupId);
                
            } catch (error) {
                console.error('Error destroying group:', error);
                await sendToChat(sock, groupId, { 
                    message: `❌ Failed to destroy the group: ${error.message}` 
                }, { quoted: msg });
            }
        } else if (text === 'no') {
            await sendToChat(sock, groupId, { 
                message: "✅ Destroy group operation cancelled." 
            }, { quoted: reply });
        }
    };

    // Add the listener
    sock.ev.on('messages.upsert', listener);

    // Clean up the listener after operation completes or times out
    setTimeout(() => {
        sock.ev.off('messages.upsert', listener);
    }, CONFIRM_TIMEOUT_MS);
}

module.exports = { destroyGroupCommand};