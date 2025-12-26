const { getWelcomeSettings } = require('../../database/welcomeDb');
const { getGroupMetadataCached } = require('../../index')
const axios = require('axios');

/**
 * Fetch group profile picture as buffer
 */
async function getGroupProfilePicBuffer(sock, groupId) {
    try {
        const url = await sock.profilePictureUrl(groupId, 'image');
        if (!url) return null;

        const res = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(res.data);
    } catch (err) {
        console.warn('⚠️ Could not fetch group profile picture');
        return null;
    }
}

function getContextInfo({
    title,
    body,
    thumbnail,
    renderLargerThumbnail = true
}) {
    return {
        externalAdReply: {
            title,
            body,
            mediaType: 1,
            showAdAttribution: false,
            renderLargerThumbnail,
            thumbnail
        }
    };
}


async function handleGroupParticipantsUpdate(sock, update, groupCache) {
    if (!update?.id) return;

    const groupId = update.id;
    const botId = sock.user.id.split(':')[0];

    const settings = getWelcomeSettings(groupId, botId);
     const groupMetadata = await getGroupMetadataCached(sock, groupId, groupCache);
    const groupName = groupMetadata.subject;
    const groupDesc = groupMetadata.desc || "No description provided.";
    const membersCount = groupMetadata.participants.length;

    // Find owner & admins
    const ownerId = groupMetadata.owner || groupMetadata.participants.find(p => p.admin === 'superadmin')?.id;
    const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
    const adminMentions = admins.map(a => `@${a.split('@')[0]}`).join(', ');
    const ownerMention = ownerId ? `@${ownerId.split('@')[0]}` : 'Unknown';

    for (const participant of update.participants) {
        // Extract the ID from the participant object, which could be a string or an object
        const participantId = participant.id || participant;
        const username = String(participantId).split('@')[0];

        // ✅ Robotic Welcome Message
        if (update.action === 'add' && settings.welcome) {
           const groupPicBuffer = await getGroupProfilePicBuffer(sock, groupId);

    const welcomeMsg = `👋 *Welcome to ${groupName}*

Hello @${username},  
We’re glad to have you join us.

_${groupDesc}_

• *Owner:* ${ownerMention}  
• *Admins:* ${adminMentions || 'None'}

📌 *Group Rules*
1️⃣ No cheating of any kind  
2️⃣ No insults, harassment, or hate speech  
3️⃣ No spamming or irrelevant content  
4️⃣ Respect all members and admins  

⚠️ *Important:*  
Breaking any of these rules may result in *automatic removal* from the group.

You are member *#${membersCount}*.  
Enjoy your stay and keep it respectful 🤝`;


            // Ensure we only pass string IDs in mentions
            const mentionIds = [
            participantId,
            ...(ownerId ? [ownerId] : []),
            ...admins
        ].filter(Boolean);

        await sock.sendMessage(groupId, {
            text: welcomeMsg,
            mentions: mentionIds,
            contextInfo: getContextInfo({
                title: groupName,
                body: `Welcome @${username}`,
                thumbnail: groupPicBuffer
            })
        });
    }

        // ✅ Robotic Goodbye Messages (Random)
        if (update.action === 'remove' && settings.goodbye) {
            const remainingCount = (await sock.groupMetadata(groupId)).participants.length;

            const goodbyeMessages = [
                `🤖 @${username} has been ejected from the system. Remaining nodes: *${remainingCount}*.`,
                `⚠️ ALERT: @${username} disconnected. ${remainingCount} members remain operational.`,
                `🛡️ Security Notice: @${username} exited the network. Active units: *${remainingCount}*.`,
                `❌ Termination Complete: @${username} removed. Current status: *${remainingCount} members online*.`
            ];

            const randomGoodbye = goodbyeMessages[Math.floor(Math.random() * goodbyeMessages.length)];

            await sock.sendMessage(groupId, {
                text: randomGoodbye,
                mentions: [participantId].filter(Boolean) // Ensure we only pass the ID
            });
        }
    }
}

module.exports = handleGroupParticipantsUpdate;
