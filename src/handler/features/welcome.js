const { getWelcomeSettings } = require('../../database/welcomeDb');
const { getGroupMetadataCached } = require('../../index')
const { showFame, showStats } = require('../command/hallOfFame');
const { getGroupProfilePicBuffer, getContextInfo } = require('../../utils/groupImagePreview');


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
We're glad to have you join us.

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

        /* ================= GREETING ================= */
        if (update.action === 'add' && settings.greet) {
            const username = participantId.split('@')[0];
            const groupPicBuffer = await getGroupProfilePicBuffer(sock, groupId);
            const stats = await showStats(sock, groupId, true)
            // const adminMentions = admins.map(a => `@${a.split('@')[0]}`).join(', ');

            
            // Create impressive greeting message
            let greetingMessage = `🌟 *Welcome to the Community!* 🌟\n\n`;
            greetingMessage += `👋 Hello @${username}!\n\n`;
            greetingMessage += `Welcome to this legendary football community.\n\n`;
            greetingMessage += `Can you compete with the legends here?\n`;
            greetingMessage += `Let's find out...\n\n`;
            greetingMessage += `🏆 Here are the *ALL-TIME* winners in this community:\n\n`;
            
            // Call existing showStats function to get the stats display
            greetingMessage += stats.text + '\n\n';
            greetingMessage += `• *Owner:* ${ownerMention}  \n`;
            greetingMessage += `• *Admins:* ${adminMentions || 'None'}  \n\n`;
            greetingMessage += '📌 *Group Rules*\n';
            greetingMessage += '1️⃣ No cheating  \n';
            greetingMessage += '2️⃣ No insults or hate  \n';
            greetingMessage += '3️⃣ No spamming  \n';
            greetingMessage += '4️⃣ Respect everyone  \n\n';
            greetingMessage += '⚠️ Breaking rules may result in removal. \n\n';

            greetingMessage += `🌟 Welcome to our community! Let's build our legacy together! 🏆`;
            
            await sock.sendMessage(groupId, { 
                text: greetingMessage,
                mentions: [
                    participantId,
                    ...(ownerId ? [ownerId] : []),
                    ...admins,
                    ...stats.mentions
                ],
                contextInfo: getContextInfo({
                    title: groupName,
                    body: `Welcome @${username}`,
                    thumbnail: groupPicBuffer
                })
            });
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
