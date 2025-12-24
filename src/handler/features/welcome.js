const { getWelcomeSettings } = require('../../database/welcomeDb');
const sendToChat = require('../../utils/sendToChat');

async function handleGroupParticipantsUpdate(sock, update) {
    const groupId = update.id;
    const botId = sock.user.id.split(':')[0];

    const settings = getWelcomeSettings(groupId, botId);
    const groupMetadata = await sock.groupMetadata(groupId);
    const groupName = groupMetadata.subject;
    const groupDesc = groupMetadata.desc || "No description provided.";
    const membersCount = groupMetadata.participants.length;

    // Find owner & admins
    const ownerId = groupMetadata.owner || groupMetadata.participants.find(p => p.admin === 'superadmin')?.id;
    const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
    const adminMentions = admins.map(a => `@${a.split('@')[0]}`).join(', ');
    const ownerMention = ownerId ? `@${ownerId.split('@')[0]}` : 'Unknown';

    for (const participant of update.participants) {
        const username = participant.split('@')[0];

        // ✅ Robotic Welcome Message
        if (update.action === 'add' && settings.welcome) {
            const welcomeMsg = `🤖 *SYSTEM ALERT: NEW MEMBER DETECTED!*

Greetings, @${username}. You have entered *${groupName}*.

📜 *Group Description:*  
_${groupDesc}_  

⚠️ For questions, contact:  
👑 *Group Owner:* ${ownerMention}  
🛡️ *Admins:* ${adminMentions || 'None'}  

✅ You are now member number *${membersCount}*.  
Proceed with respect. Follow the rules. Engage logically.  
Welcome to the network.`;

            await sendToChat(sock, groupId, {
                message: welcomeMsg,
                mentions: [participant, ...(ownerId ? [ownerId] : []), ...admins]
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

            await sendToChat(sock, groupId, {
                message: randomGoodbye,
                mentions: [participant]
            });
        }
    }
}

module.exports = handleGroupParticipantsUpdate;
