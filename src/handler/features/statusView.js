const { getUserStatusViewMode } = require('../../database/database');

const viewedStatusMap = new Map(); // Map to store id => timestamp
const statusEmojis = ['❤️', '💚', '🔥', '🥳', '😍', '🤩', '🙌', '💯'];
const statusStaticEmoji = '💚';
const STATUS_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Periodically clean expired IDs every hour
setInterval(() => {
    const now = Date.now();
    for (const [userId, map] of userStatusTrackers.entries()) {
        for (const [id, timestamp] of map.entries()) {
            if (now - timestamp > STATUS_EXPIRY_MS) {
                map.delete(id);
                console.log(`🧹 Deleted expired status ID: ${id} for user ${userId}`);
            }
        }
    }
}, 60 * 60 * 1000);

const userStatusTrackers = new Map(); // userId => Map

function getUserTracker(userId) {
    if (!userStatusTrackers.has(userId)) {
        userStatusTrackers.set(userId, new Map());
    }
    return userStatusTrackers.get(userId);
}


async function handleStatusUpdate(sock, msg, userId) {
    try {
        const viewedStatusMap = getUserTracker(userId); // ✅ per-user tracker
        const key = msg?.key;
        const remoteJid = key?.remoteJid;
        const id = key?.id;
        let participant = key?.participant;

        if (remoteJid !== 'status@broadcast') {
            //console.log('⏭️ Skipping non-status message.');
            return;
        }

        if (!id) {
            console.warn('⚠️ Missing status ID, skipping.');
            return;
        }

        if (viewedStatusMap.has(id)) {
            console.log('🔁 Already viewed status:', id);
            return;
        }

        const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
        if (!participant) {
            participant = botJid; // fallback
        }

        if (participant === botJid) {
            console.log('⏭️ Skipping self-status.');
            return;
        }

        const mode = await getUserStatusViewMode(userId);
        if (mode === 0) {
            console.log('❌ Status viewing disabled for user.');
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        await sock.readMessages([key]);
        viewedStatusMap.set(id, Date.now()); // Save with timestamp
        console.log(`👀 Viewed status from ${participant}`);

        if (mode === 2) {
            const emoji = statusStaticEmoji;

            if (!participant || typeof participant !== 'string') {
                console.warn('⚠️ Invalid participant. Skipping reaction.');
                return;
            }

            try {
                await sock.sendMessage(
                    remoteJid,
                    {
                        react: {
                            key,
                            text: emoji,
                        },
                    },
                    {
                        statusJidList: [participant, sock.user.id],
                    }
                );
                console.log(`❤️ Reacted to status from ${participant} with ${emoji}`);
            } catch (err) {
                console.error('❌ Failed to send reaction:', err.message);
            }
        }
    } catch (err) {
        console.error('🛑 Error in handleStatusUpdate:', err);
    }
}

module.exports = { handleStatusUpdate };
