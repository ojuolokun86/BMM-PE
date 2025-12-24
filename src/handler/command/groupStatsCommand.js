const { getGroupStats, getGroupDailyStats, loadGroupStatsFromDB, loadGroupDailyStatsFromDB } = require('../features/groupStats');

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function handleGroupStatsCommand(sock, remoteJid, botInstance) {
    await loadGroupStatsFromDB(remoteJid);
    await loadGroupDailyStatsFromDB(remoteJid);

    const groupMetadata = await sock.groupMetadata(remoteJid);
    const totalMembers = groupMetadata.participants.length;
    const stats = getGroupStats(remoteJid);
    const dailyStats = getGroupDailyStats(remoteJid);

    // Build last 30 days
    const now = new Date();
    const days = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }
    const dailyCounts = days.map(day => ({
        day,
        count: dailyStats[day] || 0
    }));

    // 30-day stats
    const total30 = dailyCounts.reduce((a, b) => a + b.count, 0);
    const avg30 = Math.round(total30 / 30);
    const peakDay = dailyCounts.reduce((a, b) => (b.count > a.count ? b : a));
    const quietDay = dailyCounts.reduce((a, b) => (b.count < a.count ? b : a));

    // Active/inactive by 30 days
    const nowMs = Date.now();
    const activeThreshold = 30 * 24 * 60 * 60 * 1000;
    const activeMembers = [];
    const inactiveMembers = [];
    const allStats = [];

    for (const participant of groupMetadata.participants) {
        const userId = participant.id.split('@')[0];
        const stat = stats[userId] || { name: participant.notify || userId, messageCount: 0, lastMessageTime: 0 };
        allStats.push({
            userId,
            jid: participant.id,
            name: stat.name,
            messageCount: stat.messageCount,
            lastMessageTime: stat.lastMessageTime
        });
        if (stat.lastMessageTime && nowMs - stat.lastMessageTime <= activeThreshold) {
            activeMembers.push({ ...stat, jid: participant.id, userId });
        } else {
            inactiveMembers.push({ ...stat, jid: participant.id, userId });
        }
    }

    // Sort by message count
    activeMembers.sort((a, b) => b.messageCount - a.messageCount);
    inactiveMembers.sort((a, b) => b.messageCount - a.messageCount);

    // Top 10
    const top10 = allStats
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, 10);

    // Format output with stylish font
    const groupName = groupMetadata.subject;
    const groupId = groupMetadata.id || remoteJid;
    const ownerId = groupMetadata.owner || groupMetadata.participants.find(p => p.admin === 'superadmin')?.id || groupMetadata.participants[0].id;
    const ownerTag = ownerId ? `@${ownerId.split('@')[0]}` : 'Unknown';

    let text = `╭━━━『 *📊 GROUP STATS* 』━━━╮\n`;
    text += `\n*👥 Group:* ${groupName}`;
    text += `\n*🆔 ID:* ${groupId}`;
    text += `\n*👑 Owner:* ${ownerTag}`;
    text += `\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    text += `╭━━━『 *GENERAL INFO* 』━━━╮\n`;
    text += `• 👥 Total Members: *${totalMembers}*\n`;
    text += `• 🟢 Active (30d): *${activeMembers.length}*\n`;
    text += `• 🔴 Inactive (30d): *${inactiveMembers.length}*\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    text += `╭━━━『 *🏆 TOP 10 ACTIVE* 』━━━╮\n`;
    text += top10.length
        ? top10.map((u, i) => ` ${i + 1}. @${u.userId} ─ *${u.messageCount}* msgs`).join('\n') + '\n'
        : '  None\n';
    text += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    text += `╭━━━『 *📈 30-DAY STATS* 』━━━╮\n`;
    text += `• Total: *${total30}* msgs\n`;
    text += `• Avg/Day: *${avg30}*\n`;
    text += `• 📅 Peak: *${dayNames[new Date(peakDay.day).getDay()]}* (${peakDay.count})\n`;
    text += `• 😴 Quietest: *${dayNames[new Date(quietDay.day).getDay()]}* (${quietDay.count})\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    text += `╭━━━『 *✅ ACTIVE (30d)* 』━━━╮\n`;
    text += activeMembers.length
        ? activeMembers.map((u, i) => ` ${i + 1}. @${u.userId} ─ ${u.messageCount} msgs`).join('\n') + '\n'
        : '  None\n';
    text += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    text += `╭━━━『 *⚠️ INACTIVE (30d)* 』━━━╮\n`;
    text += inactiveMembers.length
        ? inactiveMembers.map((u, i) => ` ${i + 1}. @${u.userId} ─ ${u.messageCount} msgs`).join('\n') + '\n'
        : '  None\n';
    text += `╰━━━━━━━━━━━━━━━━━━━━━━╯`;

    const mentions = [
        ...top10.map(u => u.jid),
        ...activeMembers.map(u => u.jid),
        ...inactiveMembers.map(u => u.jid)
    ];

    await sock.sendMessage(remoteJid, {
        text,
        mentions: [...mentions, ownerId]
    });
}

// Returns detailed inactive members array, same as used in stats display
function getInactiveMembersDetailed(stats, thresholdDays, excludeJids = []) {
    const now = Date.now();
    const threshold = now - thresholdDays * 24 * 60 * 60 * 1000;
    return Object.entries(stats)
        .filter(([userId, stat]) =>
            !excludeJids.includes(userId) &&
            stat.lastMessageTime &&
            stat.lastMessageTime < threshold
        )
        .map(([userId, stat]) => ({
            userId,
            messageCount: stat.messageCount,
            lastMessageTime: stat.lastMessageTime
        }));
}
module.exports = {
    handleGroupStatsCommand,
    getInactiveMembersDetailed
};

async function handleListInactiveCommand(sock, remoteJid, inactivityDays = 30) {
    await loadGroupStatsFromDB(remoteJid);
    const metadata = await sock.groupMetadata(remoteJid);

    // Build exclude list (admins and bot)
    const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
    const botId = sock.user?.lid?.split(':')[0] || sock.user?.id?.split(':')[0];
    const botJid = `${botId}@s.whatsapp.net`;
    const excludeJids = admins.concat([botJid]);

    // Get stats and inactive members
    const stats = getGroupStats(remoteJid);
    const { getInactiveMembersDetailed } = require('./groupStatsCommand');
    const inactiveArr = getInactiveMembersDetailed(stats, inactivityDays, excludeJids);

    // Map bareId to full JID for mentions
    function bareId(jid) { return jid.split('@')[0]; }
    const participantBareMap = {};
    for (const p of metadata.participants) participantBareMap[bareId(p.id)] = p.id;

    // Only mention those still in the group
    const validInactive = inactiveArr
        .filter(u => participantBareMap[u.userId])
        .map(u => ({
            ...u,
            fullJid: participantBareMap[u.userId]
        }));

    if (!validInactive.length) {
        await sock.sendMessage(remoteJid, { text: "✅ No inactive members found in this group." });
        return;
    }

    const mentionList = validInactive.map((u, i) => {
        const lastActive = u.lastMessageTime
            ? new Date(u.lastMessageTime).toLocaleDateString()
            : "never";
        return `${i + 1}. @${bareId(u.fullJid)} (${u.messageCount} msgs, last active: ${lastActive})`;
    }).join('\n');
    const mentions = validInactive.map(u => u.fullJid);

    await sock.sendMessage(remoteJid, {
        text: `⚠️ *Inactive Members (${inactivityDays}+ days):*\n\n${mentionList}`,
        mentions
    });
}

module.exports.handleListInactiveCommand = handleListInactiveCommand;
