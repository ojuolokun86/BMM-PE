const sendToChat = require('../../utils/sendToChat');
const { isBotOwner } = require('../../database/database');

async function listGroupsCommand(sock, msg) {
    try {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
        const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
        const senderId = sender?.split('@')[0];
        const name = sock.user?.name;

        // Permission check
        if (!msg.key.fromMe && !isBotOwner(senderId, botId, botLid)) {
            return await sendToChat(sock, from, {
                message: `⚠️ [ACCESS DENIED]\n> Only *${name}* can execute this system command.`
            });
        }

        const jid = sock.user?.id;
        const chats = await sock.groupFetchAllParticipating();
        const groups = Object.values(chats);

        if (!groups.length) {
            await sendToChat(sock, jid, { message: `🤖 [SYSTEM LOG]\n> No active groups detected.` });
            return;
        }

        // Robotic formatted group list
        let groupList = `📡 [ACTIVE GROUP NODES]\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
        groups.forEach((g, i) => {
            groupList += `> NODE ${i + 1}\n`;
            groupList += `   ├─ NAME: ${g.subject}\n`;
            groupList += `   └─ ID: ${g.id}\n`;
            groupList += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        });

        groupList += `✅ [SYSTEM REPORT]\n> Total Groups: ${groups.length}\n`;
        groupList += `> OPERATIONAL STATUS: ACTIVE\n`;

        await sendToChat(sock, jid, { message: groupList });

    } catch (err) {
        await sendToChat(sock, sock.user?.id, {
            message: `❌ [SYSTEM FAILURE]\n> Unable to retrieve group matrix.`
        });
        console.error('listGroupsCommand error:', err);
    }
}

module.exports = listGroupsCommand;
