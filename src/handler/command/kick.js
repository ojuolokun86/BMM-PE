const { getInactiveMembers, loadGroupStatsFromDB, groupStats, getGroupStats } = require('../features/groupStats');
const { getGroupAdmins } = require('./groupCommand');
const sendToChat = require('../../utils/sendToChat');

const KICK_DELAY_MS = 1500;
const CONFIRM_TIMEOUT_MS = 60000;

// Track ongoing kick operations per group
const kickOperations = {};

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
 * Extract target JID from reply or mention
 */
function extractTargetJid(msg) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (ctx?.participant) return ctx.participant;
    if (ctx?.mentionedJid?.length) return ctx.mentionedJid[0];
    return null;
}

/**
 * Main kick command handler
 */
async function kickCommand(sock, msg, command, args, from) {
    const groupId = from;
    const senderId = msg.key.participant || msg.participant || msg.key.remoteJid;
    const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0] || '';
    const subCmd = (args[0] || '').toLowerCase();

    // Only allow in groups
    if (!groupId.endsWith('@g.us')) {
        await sock.sendMessage(groupId, { text: "❌ This command can only be used in groups." }, { quoted: msg });
        return;
    }

    // Only allow admins to use the command
    if (!(await checkIfAdmin(sock, groupId, senderId))) {
        await sock.sendMessage(groupId, { text: "❌ Only group admins can use this command." }, { quoted: msg });
        return;
    }
    // Bot must be admin
    if (!(await checkIfAdmin(sock, groupId, botLid))) {
        await sock.sendMessage(groupId, { text: "❌ I must be admin to kick members." }, { quoted: msg });
        return;
    }

    // .kick exit: cancel ongoing operation
    if (subCmd === 'exit') {
        const op = kickOperations[groupId];
        if (op && op.admin === senderId && op.kicking) {
            op.stopRequested = true;
            await sock.sendMessage(groupId, { text: "⏹️ Kick operation will be stopped after the current member." }, { quoted: msg });
        } else {
            await sock.sendMessage(groupId, { text: "ℹ️ No kick operation in progress or you are not the admin who started it." }, { quoted: msg });
        }
        return;
    }

    // Helper: unified confirmation flow for both "members" and "inactive"
    async function confirmAndKick(toKick, mentionList, mentions, confirmText) {
        const confMsg = await sock.sendMessage(groupId, {
            text: confirmText + `\n\n${mentionList}\n\n*Reply to this message* with:\n- "yes" to confirm\n- "no" to cancel\n\n_You have 60 seconds. Only the admin who issued the command can confirm._\n\n*To stop the operation while it's running, send:*\n.kick exit`,
            mentions
        }, { quoted: msg });

        const confMsgId = confMsg?.key?.id;
        let timeoutHandle;

        // Clean up any previous op for this group
        if (kickOperations[groupId]) {
            kickOperations[groupId].stopRequested = true;
        }

        // Set up operation state
        kickOperations[groupId] = {
            admin: senderId,
            kicking: false,
            stopRequested: false
        };

        // Listener for confirmation reply
        const listener = async (ev) => {
            const reply = ev.messages?.[0];
            if (!reply) return;
            const replyFrom = reply.key.remoteJid;
            const replySender = reply.key.participant || reply.key.remoteJid;
            if (replyFrom !== groupId || replySender !== senderId) return;

            const context = reply.message?.extendedTextMessage?.contextInfo;
            const isReplyToConf = context?.stanzaId === confMsgId;
            if (!isReplyToConf) return;

            const body = reply.message?.conversation || reply.message?.extendedTextMessage?.text || '';
            const text = body.trim().toLowerCase();

            if (text === 'yes' && !kickOperations[groupId].kicking) {
                clearTimeout(timeoutHandle);
                kickOperations[groupId].kicking = true;

                await sock.sendMessage(groupId, {
                    text: `Kicking ${toKick.length} members:\n${mentionList}`,
                    mentions
                }, { quoted: reply });

                for (const id of toKick) {
                    if (kickOperations[groupId].stopRequested) {
                        await sock.sendMessage(groupId, { text: "⏹️ Kick operation stopped by admin.", mentions }, { quoted: reply });
                        sock.ev.off('messages.upsert', listener);
                        delete kickOperations[groupId];
                        return;
                    }
                    await sock.groupParticipantsUpdate(groupId, [id], "remove");
                    await new Promise(res => setTimeout(res, KICK_DELAY_MS));
                }

                await sock.sendMessage(groupId, {
                    text: `✅ Kicked ${toKick.length} members.`,
                    mentions
                }, { quoted: reply });

                sock.ev.off('messages.upsert', listener);
                delete kickOperations[groupId];

            } else if (text === 'no' && !kickOperations[groupId].kicking) {
                clearTimeout(timeoutHandle);
                sock.ev.off('messages.upsert', listener);
                delete kickOperations[groupId];
                await sock.sendMessage(groupId, { text: "❌ Kick operation cancelled." }, { quoted: reply });
            }
        };

        sock.ev.on('messages.upsert', listener);

        timeoutHandle = setTimeout(() => {
            sock.ev.off('messages.upsert', listener);
            delete kickOperations[groupId];
            sock.sendMessage(groupId, { text: "⏰ Kick operation timed out." }, { quoted: confMsg });
        }, CONFIRM_TIMEOUT_MS);
    }

    // .kick members (confirmation)
    if (subCmd === 'members') {
        const admins = await getGroupAdmins(sock, groupId);
        const metadata = await sock.groupMetadata(groupId);
        const toKick = metadata.participants
            .filter(p => !admins.includes(p.id) && p.id !== botLid)
            .map(p => p.id);

        if (toKick.length === 0) {
            await sock.sendMessage(groupId, { text: "No non-admin members to kick." }, { quoted: msg });
            return;
        }

        const mentions = toKick.map(id => id);
        const mentionList = toKick.map((id, i) => `${i + 1}. @${id.split('@')[0]}`).join('\n');
        await confirmAndKick(
            toKick,
            mentionList,
            mentions,
            `⚠️ *Kick All Members Confirmation*\n\nThe following members will be kicked:`
        );
        return;
    }

    // .kick inactive (confirmation)
    const { getInactiveMembersDetailed } = require('./groupStatsCommand');
    console.log(getInactiveMembersDetailed);

    if (subCmd === 'inactive') {
        await loadGroupStatsFromDB(groupId);
        const metadata = await sock.groupMetadata(groupId);
        const admins = await getGroupAdmins(sock, groupId);
        const botId = sock.user?.lid?.split(':')[0] || sock.user?.id?.split(':')[0];
        const botJid = `${botId}@s.whatsapp.net`;
        const excludeJids = admins.concat([botJid]);
    
        const stats = getGroupStats(groupId);
    
        // Use the same days threshold as your list command
        const inactivityDays = 30;
        const { getInactiveMembersDetailed } = require('./groupStatsCommand');
        const inactiveArr = getInactiveMembersDetailed(stats, inactivityDays, excludeJids);
    
        // Map bareId to full JID for current group participants
        function bareId(jid) { return jid.split('@')[0]; }
        const participantBareMap = {};
        for (const p of metadata.participants) participantBareMap[bareId(p.id)] = p.id;
    
        // Only kick those still in the group
        const validInactive = inactiveArr
            .filter(u => participantBareMap[u.userId])
            .map(u => ({
                ...u,
                fullJid: participantBareMap[u.userId]
            }));
    
        if (!validInactive.length) {
            await sock.sendMessage(groupId, { text: "✅ No inactive members found to kick." }, { quoted: msg });
            return;
        }
    
        const mentionList = validInactive.map((u, i) => {
            const lastActive = u.lastMessageTime
                ? new Date(u.lastMessageTime).toLocaleDateString()
                : "never";
            return `${i + 1}. @${bareId(u.fullJid)} (last active: ${lastActive})`;
        }).join('\n');
        const mentions = validInactive.map(u => u.fullJid);
    
        await confirmAndKick(
            mentions,
            mentionList,
            mentions,
            `⚠️ *Kick Inactive Members Confirmation*\n\nThe following members have been inactive for ${inactivityDays}+ days:`
        );
        return;
    }


    // Otherwise: .kick @user or .kick (reply)
    const targetJid = extractTargetJid(msg);
    if (!targetJid) {
        // Show help message if no target found and not a bulk command
        await sock.sendMessage(groupId, {
            text:
`*Kick Command Usage*

1. *Kick a user (mention or reply):*
   \`\`\`
   .kick @user
   .kick   (as a reply to a user)
   \`\`\`
   - Instantly kicks the mentioned or replied user.

2. *Kick all non-admin members (with confirmation):*
   \`\`\`
   .kick members
   \`\`\`
   - Bot will ask for confirmation. Reply to the bot's confirmation message with "yes" or "no" within 60 seconds.
   - While kicking, send \`.kick exit\` to stop the operation immediately.

3. *Kick inactive members (with confirmation):*
   \`\`\`
   .kick inactive
   \`\`\`
   - Bot will ask for confirmation and mention all inactive members to be kicked.
   - While kicking, send \`.kick exit\` to stop the operation immediately.

*Note:*
- Only group admins can use this command.
- The bot must be admin.
- All affected members will be mentioned in the kick message.
`
        }, { quoted: msg });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(groupId, [targetJid], 'remove');
        await sock.sendMessage(groupId, {
            text: `🚫 Kicked user: @${targetJid.split('@')[0]}`,
            mentions: [targetJid]
        }, { quoted: msg });
    } catch (err) {
        await sock.sendMessage(groupId, {
            text: `❌ Failed to kick user: @${targetJid.split('@')[0]}`,
            mentions: [targetJid]
        }, { quoted: msg });
    }
}

module.exports = { kickCommand , checkIfAdmin };