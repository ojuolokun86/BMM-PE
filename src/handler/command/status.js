const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');

// Simple random ID generator
function getRandomId(length = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({length}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

async function downloadStatus(sock, msg, isOwner, from, prefix) {
    const sender = msg.key.remoteJid;
    try {
        // Check if the message is a reply to a status
        if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            return await sock.sendMessage(from, { 
                text: `❌ Please reply to a status with *${prefix}dstatus* to download it`
            }, { quoted: msg });
        }

        const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
        const quotedKey = msg.message.extendedTextMessage.contextInfo.participant || 
                         msg.message.extendedTextMessage.contextInfo.remoteJid;
        
        // Get sender info for the status with better name resolution
        let statusSender = 'Unknown';
        let statusMention = '';
        try {
            // Try to get the contact's name from the message
            const contact = await sock.onWhatsApp(quotedKey);
            if (contact && contact[0]?.exists) {
                // Try to get the pushname (display name) first
                const user = await sock.fetchStatus(quotedKey);
                if (user?.status) {
                    statusSender = user.status;
                } else {
                    // Fallback to contact name or number
                    statusSender = contact[0]?.name || quotedKey.split('@')[0];
                }
                // Create mention
                const mention = `@${quotedKey.split('@')[0]}`;
                statusMention = `👤 *From:* ${statusSender} (${mention})\n`;
            }
        } catch (e) {
            console.error('Error getting contact info:', e);
            // If we can't get the name, just use the number
            const mention = `@${quotedKey.split('@')[0]}`;
            statusMention = `👤 *From:* ${mention}\n`;
        }

        // Check if the quoted message is a status
        if (!quotedMsg.statusPsaMessage && !quotedMsg.videoMessage && !quotedMsg.imageMessage) {
            return await sock.sendMessage(from, { 
                text: '❌ The replied message is not a valid status'
            }, { quoted: msg });
        }

        await sock.sendMessage(from, { 
            text: '⬇️ Downloading status, please wait...' 
        }, { quoted: msg });

        // Determine the media type and get caption if exists
        let mediaType = 'unknown';
        let mediaMessage = null;
        let caption = '';
        
        if (quotedMsg.videoMessage) {
            mediaType = 'video';
            mediaMessage = quotedMsg.videoMessage;
            caption = quotedMsg.videoMessage.caption || '';
        } else if (quotedMsg.imageMessage) {
            mediaType = 'image';
            mediaMessage = quotedMsg.imageMessage;
            caption = quotedMsg.imageMessage.caption || '';
        } else if (quotedMsg.statusPsaMessage) {
            mediaType = 'status';
            mediaMessage = quotedMsg.statusPsaMessage;
            caption = quotedMsg.statusPsaMessage.caption || '';
        }

        if (!mediaMessage) {
            throw new Error('Could not process this status type');
        }

        // Download the media directly to buffer
        const buffer = await downloadMediaMessage(
            { 
                key: { 
                    remoteJid: 'status@broadcast', 
                    id: msg.key.id 
                }, 
                message: { 
                    [mediaType === 'status' ? 'extendedTextMessage' : mediaType + 'Message']: mediaMessage 
                } 
            },
            'buffer',
            { },
            {
                logger: console,
                reuploadRequest: sock.updateMediaMessage,
            }
        );

        if (!buffer) {
            throw new Error('Failed to download status');
        }

        // Prepare caption with status info and mention
        const statusCaption = `⬇️ *Status Downloaded*\n` +
            statusMention +
            `📅 *Date:* ${new Date().toLocaleString()}\n` +
            `🔄 *Type:* ${mediaType.toUpperCase()}\n` +
            (caption ? `\n💬 *Caption:*\n${caption}\n` : '');

        // Send the media directly using sock.sendMessage
        const messageOptions = {
            caption: statusCaption,
            quoted: msg,
            mentions: [quotedKey] // Mention the original poster
        };

        if (mediaType === 'video') {
            await sock.sendMessage(sender, { 
                video: buffer,
                mimetype: 'video/mp4',
                ...messageOptions
            });
        } else {
            await sock.sendMessage(sender, { 
                image: buffer,
                mimetype: 'image/jpeg',
                ...messageOptions
            });
        }

    } catch (error) {
        console.error('Error downloading status:', error);
        await sock.sendMessage(from, { 
            text: `❌ Error: ${error.message || 'Failed to download status'}`
        }, { quoted: msg });
    }
}

module.exports = {
    downloadStatus,
    getRandomId
};
