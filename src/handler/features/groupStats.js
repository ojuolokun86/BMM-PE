const supabase = require('../../supabaseClient');
const groupStats = {}; // { [groupId]: { [userId]: { name, messageCount, lastMessageTime } } }
const groupDailyStats = {}; // { [groupId]: { [YYYY-MM-DD]: count } }
const processedMessages = {}; // { [groupId]: Set(messageId) }

function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
}

// Load all stats for a group from DB into cache
async function loadGroupStatsFromDB(groupId) {
    //console.log(`📊 Loading stats for group ${groupId}...`);
    const { data, error } = await supabase
        .from('group_stats')
        .select('*')
        .eq('group_id', groupId);
    if (error) {
        console.error('❌ Error loading group stats:', error);
        return;
    }
    
    //console.log(`📊 Found ${data.length} stat records in DB for group ${groupId}`);
    groupStats[groupId] = {};
    for (const row of data) {
        groupStats[groupId][row.user_id] = {
            name: row.name,
            messageCount: row.message_count,
            lastMessageTime: new Date(row.last_message_time).getTime()
        };
        //console.log(`📊 User ${row.user_id} (${row.name}): ${row.message_count} messages, last: ${row.last_message_time}`);
    }
    
    //console.log(`📊 Loaded ${Object.keys(groupStats[groupId]).length} users into cache for group ${groupId}`);
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
    //console.log(`📊 Incrementing stat for user ${userId} (${name}) in group ${groupId}, message: ${messageId}`);
    
    if (!processedMessages[groupId]) processedMessages[groupId] = new Set();
    if (processedMessages[groupId].has(messageId)) {
        //console.log(`📊 Message ${messageId} already processed, skipping`);
        return; // Already counted
    }
    processedMessages[groupId].add(messageId);

    if (!groupStats[groupId]) await loadGroupStatsFromDB(groupId);
    if (!groupStats[groupId]) groupStats[groupId] = {};
    if (!groupStats[groupId][userId]) groupStats[groupId][userId] = { name, messageCount: 0, lastMessageTime: null };
    
    const oldCount = groupStats[groupId][userId].messageCount;
    groupStats[groupId][userId].messageCount += 1;
    groupStats[groupId][userId].lastMessageTime = Date.now();
    
    //console.log(`📊 User ${userId} message count: ${oldCount} → ${groupStats[groupId][userId].messageCount}`);

    // Upsert to DB
    const { error } = await supabase.from('group_stats').upsert([{
        group_id: groupId,
        user_id: userId,
        name,
        message_count: groupStats[groupId][userId].messageCount,
        last_message_time: new Date(groupStats[groupId][userId].lastMessageTime).toISOString()
    }]);
    
    if (error) {
        console.error('❌ Error upserting group stats:', error);
    } else {
        //console.log(`📊 Successfully updated DB for user ${userId}`);
    }

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

// Clean up users who are no longer in the group
async function cleanupGroupStats(groupId, currentGroupMembers) {
    try {
        // Get current stats for this group
        const stats = getGroupStats(groupId);
        if (!stats || Object.keys(stats).length === 0) {
            //console.log(`📊 No stats found for group ${groupId}`);
            return;
        }

        //console.log(`📊 Current stats in DB: ${Object.keys(stats).length} users`);
        //console.log(`📊 Current group members: ${currentGroupMembers.length} users`);

        // Get current member JIDs (full JIDs like 1234567890@s.whatsapp.net)
        const currentMemberJids = new Set(currentGroupMembers.map(member => member.id));
        
        // Find users in stats who are no longer in the group
        const usersToRemove = Object.keys(stats).filter(userId => {
            // Check both full JID and just the number part
            const userFullJid = `${userId}@s.whatsapp.net`;
            const userLidJid = `${userId}@lid`;
            const isInGroup = currentMemberJids.has(userFullJid) || 
                            currentMemberJids.has(userLidJid) ||
                            currentMemberJids.has(userId);
            
            //console.log(`User ${userId}: inGroup=${isInGroup}, checking ${userFullJid}, ${userLidJid}`);
            return !isInGroup;
        });
        
        //console.log(`🧹 Users to remove: ${usersToRemove.length}`, usersToRemove);
        
        if (usersToRemove.length > 0) {
            //console.log(`🧹 Cleaning up ${usersToRemove.length} users from group stats for ${groupId}`);
            
            // Remove from database
            const { error } = await supabase
                .from('group_stats')
                .delete()
                .eq('group_id', groupId)
                .in('user_id', usersToRemove);
            
            if (error) {
                console.error('❌ Error cleaning up group stats:', error);
                return;
            }
            
            // Remove from cache
            usersToRemove.forEach(userId => {
                delete groupStats[groupId][userId];
            });
            
            //console.log(`✅ Successfully removed ${usersToRemove.length} inactive users from group stats`);
        } else {
            //console.log(`✅ No users need to be removed from group stats`);
        }
    } catch (error) {
        console.error('❌ Error in cleanupGroupStats:', error);
    }
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
    cleanupGroupStats,
    groupStats,
    groupDailyStats,
    getInactiveMembers
};