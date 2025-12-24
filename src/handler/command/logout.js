// src/handler/command/logout.js
const sendToChat = require('../../utils/sendToChat');
const { isBotOwner } = require('../../database/database');

async function confirmAction(sock, from, question, allowedUserJid) {
    const jid = allowedUserJid;
    await sendToChat(sock, from, { message: question });

    return new Promise((resolve) => {
        const listener = async ({ messages }) => {
            const msg = messages[0];
            if (!msg?.key?.remoteJid || msg.key.remoteJid !== from) return;

            const sender = msg.key.participant || msg.key.remoteJid;
            if (sender !== jid) return; // ✅ Ignore other users

            const response =
                (msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                '').toLowerCase().trim();

            if (['yes', 'y', '1'].includes(response)) {
                sock.ev.off('messages.upsert', listener);
                resolve(true);
            } else if (['no', 'n', '0'].includes(response)) {
                sock.ev.off('messages.upsert', listener);
                resolve(false);
            }
        };

        sock.ev.on('messages.upsert', listener);

        // Auto-remove listener after 30 seconds
        setTimeout(() => {
            sock.ev.off('messages.upsert', listener);
            resolve(false);
        }, 30000);
    });
}

async function logoutCommand(authId, sock, msg) {
    const from = msg.key.remoteJid;
    const botId = sock.user.id.split(':')[0].split('@')[0];
    const botLid = sock.user.lid.split(':')[0].split('@')[0];
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderId = sender.split('@')[0];
    const name = sock.user?.name;

    try {
        if (!msg.key.fromMe && !isBotOwner(senderId, botId, botLid)) {
            await sendToChat(sock, from, {
                message: `🖥️ *ACCESS DENIED*\n\n> **Reason:** Insufficient privilege\n> **Required:** Root Access (Owner)\n\n⛔ Only *${name}* can perform this action.`
            });
            return false;
        }

        // Styled confirmation
        const confirmation = await confirmAction(
            sock,
            from,
            `🖥️ *SYSTEM PROTOCOL ENGAGED*\n\n` +
            `> **Operation:** Logout Request Detected\n` +
            `> **Impact:**\n` +
            `   • Terminate active session\n` +
            `   • Clear authentication keys\n` +
            `   • Require re-link to resume\n\n` +
            `⚠️ *Proceed with caution.*\n` +
            `Reply with:\n` +
            '`yes` → Continue\n' +
            '`no` → Cancel',
            sender
        );

        if (!confirmation) {
            await sendToChat(sock, from, {
                message: `🖥️ *SYSTEM NOTICE*\n\n` +
                         `> **Action:** Logout aborted by user\n` +
                         `> **Status:** Current session remains active\n` +
                         `> **Bot State:** Fully operational`
            });
            return false;
        }

        // Styled logout process
        await sendToChat(sock, from, {
            message:
                `🖥️ *LOGOUT SEQUENCE INITIATED*\n\n` +
                `> **Status:** Disconnecting from WhatsApp...\n` +
                `> **Action:** Removing session from memory\n` +
                `> **Next Step:** Redeploy from dashboard to restore service\n\n` +
                `✅ *Logout completed successfully.*`
        });

        await new Promise(resolve => setTimeout(resolve, 1500));
        const { handleLogout } = require('../../main/main');
        // In src/handler/command/logout.js
        const result = await handleLogout(sock, authId, botId); // Changed parameter order  
        if (!result.success) throw new Error(result.message || 'Failed to complete logout');

        return true;
    } catch (error) {
        console.error('Logout error:', error);
        await sendToChat(sock, from, {
            message: `🖥️ *SYSTEM ERROR*\n\n` +
                     `❌ *Logout failed: ${error.message}*\n` +
                     `> **Status:** Session remains active\n` +
                     `> **Recommendation:** Try again or contact support`
        });
        return false;
    }
}

module.exports = { logoutCommand };
