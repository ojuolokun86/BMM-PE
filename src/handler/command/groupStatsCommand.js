const { 
    loadGroupStatsFromDB, 
    loadGroupDailyStatsFromDB,
    cleanupGroupStats,
    getGroupStats,
    getGroupDailyStats
} = require('../features/groupStats');
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function getCommunityStatsScope(sock, groupId, groupMetadata) {
    const communityJid = groupMetadata.linkedParent;
    if (!communityJid) return null;

    const communityMetadata = await sock.groupMetadata(communityJid);
    const participatingGroups = await sock.groupFetchAllParticipating();
    const groupIds = new Set([groupId]);

    for (const [jid, group] of Object.entries(participatingGroups || {})) {
        if (!jid.endsWith('@g.us') || jid === communityJid) continue;
        if (group?.linkedParent === communityJid) groupIds.add(jid);
    }

    const stats = {};
    const dailyStats = {};
    const groupMetadataList = [];

    for (const childGroupId of groupIds) {
        const childMetadata = childGroupId === groupId
            ? groupMetadata
            : await sock.groupMetadata(childGroupId);
        if (childGroupId !== groupId && childMetadata.linkedParent !== communityJid) continue;
        groupMetadataList.push(childMetadata);

        await loadGroupStatsFromDB(childGroupId);
        await loadGroupDailyStatsFromDB(childGroupId);

        for (const [userId, stat] of Object.entries(getGroupStats(childGroupId))) {
            const existing = stats[userId];
            if (!existing) {
                stats[userId] = { ...stat };
                continue;
            }
            existing.messageCount += stat.messageCount;
            if (stat.lastMessageTime > existing.lastMessageTime) {
                existing.lastMessageTime = stat.lastMessageTime;
                existing.name = stat.name || existing.name;
            }
        }

        for (const [day, count] of Object.entries(getGroupDailyStats(childGroupId))) {
            dailyStats[day] = (dailyStats[day] || 0) + count;
        }
    }

    const participants = communityMetadata.participants?.length
        ? communityMetadata.participants
        : groupMetadataList.flatMap(metadata => metadata.participants || [])
            .filter((participant, index, all) => all.findIndex(other => other.id === participant.id) === index);

    return { communityJid, communityMetadata, groupMetadataList, participants, stats, dailyStats };
}

async function handleGroupStatsCommand(sock, remoteJid, botInstance) {
    const sourceMetadata = await sock.groupMetadata(remoteJid);
    const communityScope = await getCommunityStatsScope(sock, remoteJid, sourceMetadata);
    let groupMetadata;
    let participants;
    let stats;
    let dailyStats;

    if (communityScope) {
        groupMetadata = communityScope.communityMetadata;
        participants = communityScope.participants;
        stats = communityScope.stats;
        dailyStats = communityScope.dailyStats;
    } else {
        await loadGroupStatsFromDB(remoteJid);
        await loadGroupDailyStatsFromDB(remoteJid);
        groupMetadata = sourceMetadata;
        participants = groupMetadata.participants;
        await cleanupGroupStats(remoteJid, participants);
        await loadGroupStatsFromDB(remoteJid);
        stats = getGroupStats(remoteJid);
        dailyStats = getGroupDailyStats(remoteJid);
    }

    const totalMembers = participants.length;

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

    for (const participant of participants) {
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
    const ownerId = groupMetadata.owner || participants.find(p => p.admin === 'superadmin')?.id || participants[0]?.id;
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

// Returns all inactive members including those with 0 messages
function getAllInactiveMembers(stats, currentGroupMembers, thresholdDays, excludeJids = []) {
    const now = Date.now();
    const threshold = now - thresholdDays * 24 * 60 * 60 * 1000;
    const currentMemberIds = new Set(currentGroupMembers.map(p => p.id.split('@')[0]));
    
    const inactiveMembers = [];
    
    // Check all current group members
    for (const participant of currentGroupMembers) {
        const userId = participant.id.split('@')[0];
        
        // Skip excluded users (admins, bot)
        if (excludeJids.includes(userId) || excludeJids.includes(participant.id)) {
            continue;
        }
        
        const stat = stats[userId];
        
        // Include user if:
        // 1. User has no stats at all (0 messages)
        // 2. User has stats but last message was before threshold
        if (!stat || (stat.lastMessageTime && stat.lastMessageTime < threshold)) {
            inactiveMembers.push({
                userId,
                messageCount: stat ? stat.messageCount : 0,
                lastMessageTime: stat ? stat.lastMessageTime : null,
                name: stat ? stat.name : participant.notify || userId
            });
        }
    }
    
    return inactiveMembers;
}
module.exports = {
    handleGroupStatsCommand,
    getInactiveMembersDetailed,
    getAllInactiveMembers,
    getCommunityStatsScope
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
