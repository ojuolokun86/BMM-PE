const { getWelcomeSettings } = require('../../database/welcomeDb');
const { getGroupMetadataCached } = require('../../index')
const { showFame } = require('../command/hallOfFame');
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
    if (!update?.id || !Array.isArray(update.participants)) return;

    const groupId = update.id;
    const botId = sock.user.id.split(':')[0];

    const settings = getWelcomeSettings(groupId, botId);
    if (!settings) return;

    let groupMetadata;
    try {
        groupMetadata = await getGroupMetadataCached(sock, groupId, groupCache);
    } catch {
        console.warn('⚠️ Failed to fetch group metadata');
        return;
    }

    const groupName = groupMetadata.subject;
    const groupDesc = groupMetadata.desc || 'No description provided.';
    const membersCount = groupMetadata.participants.length;

    const ownerId =
        groupMetadata.owner ||
        groupMetadata.participants.find(p => p.admin === 'superadmin')?.id;

    const admins = groupMetadata.participants
        .filter(p => p.admin)
        .map(p => p.id);

    const adminMentions = admins.map(a => `@${a.split('@')[0]}`).join(', ');
    const ownerMention = ownerId ? `@${ownerId.split('@')[0]}` : 'Unknown';

    const actor = update.author || null; // can be null

    for (const participant of update.participants) {
        const participantId = participant.id || participant;
        if (!participantId) continue;

        const username = participantId.split('@')[0];


        /* ================= WELCOME ================= */
        if (update.action === 'add' && settings.welcome) {
            let greeting;

            if (!actor) {
                greeting = `Hello @${username},\nYou joined the group using an invite link or from the community.`;
            } else if (actor === participantId) {
                // This case is rare now, but keep for backward compatibility
                greeting = `Hello @${username},\nYou joined via an invite link.`;
            } else {
                greeting = `Hello @${username},\n@${actor.split('@')[0]} added you to the group.`;
            }

            const groupPicBuffer = await getGroupProfilePicBuffer(sock, groupId);

            const welcomeMsg = `👋 *Welcome to ${groupName}*

${greeting}  
We’re glad to have you join us.

_${groupDesc}_

• *Owner:* ${ownerMention}  
• *Admins:* ${adminMentions || 'None'}

📌 *Group Rules*
1️⃣ No cheating  
2️⃣ No insults or hate  
3️⃣ No spamming  
4️⃣ Respect everyone  

⚠️ Breaking rules may result in removal.

You are member *#${membersCount}*. 🤝`;

            const mentionIds = [
                participantId,
                ...(actor && actor !== participantId ? [actor] : []),
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

            if (settings.showFame) {
                setTimeout(() => showFame(sock, groupId).catch(() => {}), 2000);
            }
        }

        /* ================= GOODBYE ================= */
        if (update.action === 'remove' && settings.goodbye) {
            const remainingCount = groupMetadata.participants.length - 1;
            const isVoluntary = actor === participantId;

            const goodbyeMessage = isVoluntary
                ? `👋 @${username} left the group. Remaining members: *${remainingCount}*.`
                : `🚫 @${username} was removed by an admin. Members left: *${remainingCount}*.`;

            await sock.sendMessage(groupId, {
                text: goodbyeMessage,
                mentions: [participantId].filter(Boolean)
            });
        }
    }
}

module.exports = handleGroupParticipantsUpdate;
