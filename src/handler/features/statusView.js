const { getUserStatusViewMode } = require('../../database/database');

const userStatusTrackers = new Map(); // userId => Map(statusId => timestamp)

const statusEmojis = ['❤️', '💚', '🔥'];
const statusStaticEmoji = '💚';
const STATUS_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// 🧹 Cleanup expired status IDs every hour
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
// ⏱️ Random delay function
function getRandomDelay(minMs = 5000, maxMs = 60000) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

// 📦 Get or create tracker for user
function getUserTracker(userId) {
    if (!userStatusTrackers.has(userId)) {
        userStatusTrackers.set(userId, new Map());
    }
    return userStatusTrackers.get(userId);
}

// 🚀 MAIN FUNCTION
async function handleStatusUpdate(sock, msg, userId) {
    try {
          // 🛑 CRITICAL FILTERS
        if (!msg.message) return;
        if (msg.key.fromMe) return;
        if (msg.message?.reactionMessage) return;
        const viewedStatusMap = getUserTracker(userId);

        const key = msg?.key;
        const remoteJid = key?.remoteJid;
        const id = key?.id;

        let participant = key?.participant || msg?.participant;

        // ❌ Not a status
        if (remoteJid !== 'status@broadcast') return;

        // ❌ No ID
        if (!id) return;

        // ❌ Already viewed
        const uniqueKey = `${participant}_${id}`;

        if (viewedStatusMap.has(uniqueKey)) {
            console.log('🔁 Already processed:', uniqueKey);
            return;
        }

        // ❌ Invalid participant or self
        if (!participant || msg.key.fromMe) return;

        const mode = await getUserStatusViewMode(userId);

        // ❌ Disabled
        if (mode === 0) {
            console.log('❌ Status viewing disabled');
            return;
        }
        const delay = getRandomDelay();
        console.log(`⏱️ Waiting ${delay / 1000}s before viewing status...`);
        await new Promise(res => setTimeout(res, delay));

        // 👀 VIEW STATUS
        await sock.readMessages([key]);
        viewedStatusMap.set(uniqueKey, Date.now());

        console.log(`👀 Viewed status from ${participant}`);

        // ❤️ REACT TO STATUS
        if (mode === 2) {
            // random or static
            const emoji =
                statusEmojis[Math.floor(Math.random() * statusEmojis.length)];
                // OR use static:
                // const emoji = statusStaticEmoji;

            try {
                await sock.sendMessage(
                    'status@broadcast',
                    {
                        react: {
                            key: key,
                            text: emoji,
                        },
                    },
                    {
                        statusJidList: [participant], // ✅ VERY IMPORTANT
                    }
                );

                console.log(`❤️ Reacted to ${participant} with ${emoji}`);
            } catch (err) {
                console.error('❌ Reaction failed:', err.message);
            }
        }
    } catch (err) {
        console.error('🛑 Error in handleStatusUpdate:', err);
    }
}

module.exports = { handleStatusUpdate };