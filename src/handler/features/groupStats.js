const supabase = require('../../supabaseClient');
const groupStats = {}; // { [groupId]: { [userId]: { name, messageCount, lastMessageTime } } }
const groupDailyStats = {}; // { [groupId]: { [YYYY-MM-DD]: count } }
const processedMessages = {}; // { [groupId]: Set(messageId) }

function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
}

// Load all stats for a group from DB into cache
async function loadGroupStatsFromDB(groupId) {
    const { data, error } = await supabase
        .from('group_stats')
        .select('*')
        .eq('group_id', groupId);
    if (error) return;
    groupStats[groupId] = {};
    for (const row of data) {
        groupStats[groupId][row.user_id] = {
            name: row.name,
            messageCount: row.message_count,
            lastMessageTime: new Date(row.last_message_time).getTime()
        };
    }
}

// Load daily stats for a group from DB into cache (last 30 days)
async function loadGroupDailyStatsFromDB(groupId) {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    const sinceStr = since.toISOString().slice(0, 10);
    const { data, error } = await supabase
        .from('group_daily_stats')
        .select('*')
        .eq('group_id', groupId)
        .gte('day', sinceStr);
    if (error) return;
    groupDailyStats[groupId] = {};
    for (const row of data) {
        groupDailyStats[groupId][row.day] = row.message_count;
    }
}

// Increment stat in cache and DB, and update daily stats
async function incrementGroupUserStat(groupId, userId, name, messageId) {
    if (!processedMessages[groupId]) processedMessages[groupId] = new Set();
    if (processedMessages[groupId].has(messageId)) return; // Already counted
    processedMessages[groupId].add(messageId);

    if (!groupStats[groupId]) await loadGroupStatsFromDB(groupId);
    if (!groupStats[groupId]) groupStats[groupId] = {};
    if (!groupStats[groupId][userId]) groupStats[groupId][userId] = { name, messageCount: 0, lastMessageTime: null };
    groupStats[groupId][userId].messageCount += 1;
    groupStats[groupId][userId].lastMessageTime = Date.now();

    // Upsert to DB
    await supabase.from('group_stats').upsert([{
        group_id: groupId,
        user_id: userId,
        name,
        message_count: groupStats[groupId][userId].messageCount,
        last_message_time: new Date(groupStats[groupId][userId].lastMessageTime).toISOString()
    }]);

    // Daily stats
    const todayStr = getTodayStr();
    if (!groupDailyStats[groupId]) groupDailyStats[groupId] = {};
    if (!groupDailyStats[groupId][todayStr]) groupDailyStats[groupId][todayStr] = 0;
    groupDailyStats[groupId][todayStr] += 1;
    await supabase.from('group_daily_stats').upsert([{
        group_id: groupId,
        day: todayStr,
        message_count: groupDailyStats[groupId][todayStr]
    }]);
}

function getGroupStats(groupId) {
    return groupStats[groupId] || {};
}
function getGroupDailyStats(groupId) {
    return groupDailyStats[groupId] || {};
}

// Reset group stats (cache and DB)
async function resetGroupStats(groupId) {
    groupStats[groupId] = {};
    await supabase.from('group_stats').delete().eq('group_id', groupId);
}
/**
 * Returns an array of user IDs who have not sent a message in the last 30 days.
 * Optionally pass an array of user IDs to exclude (e.g., admins/bot).
 */
function getInactiveMembers(groupId, excludeIds = []) {
    if (!groupStats[groupId]) return [];
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const threshold = now - THIRTY_DAYS_MS;
    return Object.entries(groupStats[groupId])
        .filter(([userId, stat]) =>
            (!stat.lastMessageTime || stat.lastMessageTime < threshold) &&
            !excludeIds.includes(userId)
        )
        .map(([userId]) => userId);
}
module.exports = {
    incrementGroupUserStat,
    getGroupStats,
    getGroupDailyStats,
    resetGroupStats,
    loadGroupStatsFromDB,
    loadGroupDailyStatsFromDB,
    groupStats,
    groupDailyStats,
    getInactiveMembers
};