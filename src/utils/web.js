const axios = require('axios');
const { 
  setContenderGroup, 
  getActiveContenderGroups, 
  getContenderGroupStatus, 
  removeContenderGroup 
} = require('../database/database');
const { getBaileys } = require('./baileys');

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://dyn.fly.dev/api/bot/',// localhost
  CHECK_INTERVAL: 10000, // 10 seconds
  WEBSITE_LINK: 'https://dynamicfootball.netlify.app'
};

// Store processed contenders in memory (for duplicate prevention)
const processedContenders = new Set();
const processedHallOfFameMessages = new Set();
const HALL_OF_FAME_API_URL = 'https://dyn-server.fly.dev/api/bot/hall-of-fame';

/**
 * Fetch Hall of Fame ranking from backend API
 */
async function fetchHallOfFameRanking() {
  try {
    console.log('🏆 [HALL OF FAME] Fetching rankings...');
    const response = await axios.get(HALL_OF_FAME_API_URL, {
      timeout: 15000
    });

    if (!response?.data || response.data.success !== true) {
      console.warn('⚠️ [HALL OF FAME] API returned unsuccessful response');
      return { success: false, data: [] };
    }

    return {
      success: true,
      data: Array.isArray(response.data.data) ? response.data.data : []
    };
  } catch (error) {
    const status = error?.response?.status;
    const message = error?.message || 'Request failed';
    console.error('❌ [HALL OF FAME] API error:', status || 'network', message);
    return { success: false, data: [] };
  }
}

function sortHallOfFameUsers(users = []) {
  return [...users].sort((a, b) => {
    const trophyDiff = Number(b?.trophies ?? 0) - Number(a?.trophies ?? 0);
    if (trophyDiff !== 0) return trophyDiff;
    return Number(a?.rank ?? Number.MAX_SAFE_INTEGER) - Number(b?.rank ?? Number.MAX_SAFE_INTEGER);
  });
}

function buildHallOfFameUserText(user, position) {
  const name = String(user?.name || 'Unknown').trim();
  const trophies = Number(user?.trophies ?? 0);
  const awards = Array.isArray(user?.awards) ? user.awards : [];
  const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';

  let text = `${medal} *${name}*\n🏆 Trophies: ${trophies}`;

  if (awards.length > 0) {
    text += '\n\n🏅 Awards won:';
    for (const award of awards) {
      const awardName = award?.award || 'Award';
      const season = award?.season || 'Season';
      text += `\n• ${awardName} - ${season}`;
    }
  }

  return text;
}

function buildHallOfFameText(users = []) {
  if (!users.length) {
    return '👑 No Hall of Fame winners yet.';
  }

  const sortedUsers = sortHallOfFameUsers(users);
  let message = '🏆 *DYNAMIC EFOOTBALL COMMUNITY*\n';
  message += '👑 *HALL OF FAME RANKING*\n\n';

  sortedUsers.forEach((user, index) => {
    const position = index + 1;
    message += `${buildHallOfFameUserText(user, position)}\n\n`;
  });

  return message.trim();
}

async function sendHallOfFameMessage(sock, chatId) {
  try {
    const result = await fetchHallOfFameRanking();

    if (!result.success) {
      await sock.sendMessage(chatId, {
        text: '⚠️ Hall of Fame is temporarily unavailable. Please try again later.'
      });
      return { success: false, status: 'error' };
    }

    const users = sortHallOfFameUsers(result.data);

    if (!users.length) {
      await sock.sendMessage(chatId, {
        text: '👑 No Hall of Fame winners yet.'
      });
      return { success: true, status: 'empty' };
    }

    const dedupeKey = `${chatId}:${users.map(user => `${user.name}:${user.trophies}:${user.rank || 0}`).join('|')}`;
    if (processedHallOfFameMessages.has(dedupeKey)) {
      return { success: false, status: 'duplicate' };
    }

    processedHallOfFameMessages.add(dedupeKey);
    setTimeout(() => {
      processedHallOfFameMessages.delete(dedupeKey);
    }, 60_000);

    const textMessage = buildHallOfFameText(users);
    await sock.sendMessage(chatId, { text: textMessage });

    for (const [index, user] of users.entries()) {
      if (!user?.picture || typeof sock?.sendMessage !== 'function') {
        continue;
      }

      try {
        const imageResponse = await axios.get(user.picture, {
          responseType: 'arraybuffer',
          timeout: 10000
        });

        const imageBuffer = Buffer.from(imageResponse.data);
        const caption = buildHallOfFameUserText(user, index + 1);

        await sock.sendMessage(chatId, {
          image: imageBuffer,
          caption
        });
      } catch (imageError) {
        console.error('❌ [HALL OF FAME] profile image error:', imageError?.message || 'Image fetch failed');
      }
    }

    return { success: true, status: 'sent', count: users.length };
  } catch (error) {
    console.error('❌ [HALL OF FAME] send error:', error?.message || 'Unknown error');
    await sock.sendMessage(chatId, {
      text: '⚠️ Hall of Fame is temporarily unavailable. Please try again later.'
    });
    return { success: false, status: 'error' };
  }
}

/**
 * Fetch new contenders from backend API
 */
async function fetchNewContenders() {
  try {
    console.log(' [CONTENDERS] Fetching new contenders...');
    const response = await axios.get(`${CONFIG.API_BASE_URL}/check-new`, {
      timeout: 10000
    });
    
    return response.data;
  } catch (error) {
    console.error(' [CONTENDERS] Fetch error:', error);
    return { success: false, data: [] };
  }
}

/**
 * Fetch all contenders list
 */
async function fetchAllContenders() {
  try {
    console.log('📋 [CONTENDERS] Fetching all contenders list...');
    
    const response = await axios.get(`${CONFIG.API_BASE_URL}/list-all`, {
      timeout: 10000
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ [CONTENDERS] Fetch all error:', error);
    return { success: false, data: [] };
  }
}

/**
 * Mark contender as sent in backend
 */
async function markContenderAsSent(contenderId) {
  try {
    console.log(`📝 [CONTENDERS] Marking contender ${contenderId} as sent...`);
    
    const response = await axios.post(`${CONFIG.API_BASE_URL}/mark-sent`, 
      { contenderId },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ [CONTENDERS] Mark-sent response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ [CONTENDERS] Mark-sent error:', error);
    return { success: false };
  }
}

/**
 * Get community info for group
 */
async function getCommunityInfo(sock, groupId) {
  try {
    const groupMeta = await sock.groupMetadata(groupId);
    
    if (!groupMeta.linkedParent) {
      return null;
    }
    
    const communityMeta = await sock.groupMetadata(groupMeta.linkedParent);
    
    return {
      communityJid: groupMeta.linkedParent,
      communityName: communityMeta.subject || 'Unknown Community',
      groupName: groupMeta.subject || 'Unknown Group',
      groupOwner: groupMeta.owner || 'Unknown'
    };
  } catch (error) {
    console.error('❌ [CONTENDERS] Community info error:', error);
    return null;
  }
}

/**
 * Send WhatsApp message for contender
 */
async function sendContenderMessage(sock, contender, groupId, communityInfo) {
  try {
    console.log(` [CONTENDERS] Sending message for contender: ${contender.name} to group: ${groupId}`);
    
    // Create message caption with community info
    let caption = `🏆 *BALLON D'OR NOMINATION* 🏆\n\n`;
    caption += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    caption += `⭐ *NOMINEE PROFILE* ⭐\n`;
    caption += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    caption += `👤 *Name:* ${contender.name}\n`;
    caption += `📧 *Nominated email:* ${contender.email}\n`;
    
    // Add community info if available
    if (communityInfo) {   
      caption += `🏘️ *Community:* ${communityInfo.communityName}\n`;
      caption += `👥 *Group:* ${communityInfo.groupName}\n`;
      caption += `👑 *Group Owner:* @${communityInfo.groupOwner.split('@')[0]}\n`;
    }
    
    caption += `🏆 *Trophy Collection:* ${contender.trophies || 0} 🏆\n`;
    caption += `📝 *Achievement Description:* ${contender.description || 'Rising star with exceptional talent'}\n\n`;
    caption += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    caption += `🗳️ *VOTING PORTAL* 🗳️\n`;
    caption += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    caption += `🔗 *Cast Your Vote:* ${CONFIG.WEBSITE_LINK}\n`;
    caption += `⏰ *Voting Deadline:* Limited Time Only!\n`;
    caption += `🎯 *Category:* Ballon d'Or Excellence\n\n`;
    caption += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    caption += `💎 *Every Vote Counts Towards Glory* 💎`;
    
    // Prepare message options
    const messageOptions = {
      text: caption,
      mentions: communityInfo ? [communityInfo.groupOwner] : []
    };
    
    // Add image if available
    if (contender.picture) {
      try {
        console.log(` [CONTENDERS] Processing image for: ${contender.name}`);
        
        // Fetch image
        const imageResponse = await axios.get(contender.picture, {
          responseType: 'arraybuffer',
          timeout: 10000
        });
        
        const imageBuffer = Buffer.from(imageResponse.data);
        
        messageOptions.image = imageBuffer;
        messageOptions.caption = caption;
        
        console.log(` [CONTENDERS] Image added to message for: ${contender.name}`);
      } catch (imageError) {
        console.error(' [CONTENDERS] Image processing error:', imageError);
        // Continue without image if fetch fails
      }
    }
    
    // Send message to target group
    await sock.sendMessage(groupId, messageOptions);
    
    // Mark as sent
    await markContenderAsSent(contender.id);
    
    // Add to processed set to prevent duplicates
    processedContenders.add(contender.id);
    
    console.log(`✅ [CONTENDERS] Successfully sent contender: ${contender.name}`);
    
  } catch (error) {
    console.error(' [CONTENDERS] Send message error:', error);
  }
}

/**
 * Process new contender from backend push notification
 */
async function processNewContender(sock, contender) {
  const { delay } = await getBaileys();
  try {
    console.log(` [CONTENDERS] Processing new contender from backend: ${contender.name}`);
    
    // Skip if already processed
    if (processedContenders.has(contender.id)) {
      console.log(` [CONTENDERS] Skipping already processed contender: ${contender.id}`);
      return { skipped: true, reason: 'Already processed' };
    }
    
    // Handle picture URL - if null, construct one or use default
    let pictureUrl = contender.picture;
    if (!pictureUrl && contender.event_id) {
      // Construct picture URL using event_id or use a default
      pictureUrl = `https://via.placeholder.com/400x400/4CAF50/FFFFFF?text=${encodeURIComponent(contender.name)}`;
      console.log(` [CONTENDERS] Generated placeholder image for: ${contender.name}`);
    } else if (!pictureUrl) {
      // Use a generic placeholder if no event_id
      pictureUrl = `https://via.placeholder.com/400x400/2196F3/FFFFFF?text=${encodeURIComponent(contender.name)}`;
      console.log(` [CONTENDERS] Using generic placeholder image for: ${contender.name}`);
    }
    
    // Update contender with the picture URL
    contender.picture = pictureUrl;
    
    let sentCount = 0;
    
    // Get all active groups from database
    const activeGroups = await getActiveContenderGroups();
    console.log(` [CONTENDERS] Found ${activeGroups.length} active groups from database`);
    
    // Send to all active groups
    for (const group of activeGroups) {
      const groupId = group.group_jid;
      
      console.log(` [CONTENDERS] Processing group: ${groupId} (${group.group_name})`);
      
      try {
        // Get community info for group
        const communityInfo = await getCommunityInfo(sock, groupId);
        
        // Send contender message
        await sendContenderMessage(sock, contender, groupId, communityInfo);
        sentCount++;
        
        console.log(` [CONTENDERS] Sent contender to group: ${groupId}`);
        
        // Small delay between groups to avoid spam
        await delay(2000);
        
      } catch (error) {
        console.error(` [CONTENDERS] Failed to send to group ${groupId}:`, error);
      }
    }
    
    // Mark as processed
    processedContenders.add(contender.id);
    
    console.log(` [CONTENDERS] Contender ${contender.name} processed successfully - sent to ${sentCount} groups`);
    
    return { 
      success: true, 
      sentCount,
      groupsSent: sentCount
    };
    
  } catch (error) {
    console.error(' [CONTENDERS] Process new contender error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start contender checking service (now just for backup)
 */
function startContenderService(sock) {
  console.log(' [CONTENDERS] Contender service ready - waiting for backend calls...');
  console.log(' [CONTENDERS] Backend will call POST /contender/new when ready');
  console.log('⚙️ [CONTENDERS] Contender service ready - waiting for backend calls...');
  console.log('📡 [CONTENDERS] Backend will call POST /contender/new when ready');
  // No polling needed - backend will push to us
  return null;
}

/**
 * Toggle contender monitoring for a group
 */
async function toggleContenderMonitoring(groupId, groupName, enabled = null) {
  try {
    if (enabled === null) {
      // Toggle current state
      const current = await getContenderGroupStatus(groupId);
      enabled = !current.enabled;
    }
    
    // Save to database
    await setContenderGroup(groupId, groupName, enabled);
    
    console.log(`🔄 [CONTENDERS] ${enabled ? 'Enabled' : 'Disabled'} contender monitoring for group: ${groupId}`);
    
    return enabled;
  } catch (error) {
    console.error('❌ [CONTENDERS] Toggle monitoring error:', error);
    return false;
  }
}

/**
 * Get contender monitoring status for a group
 */
async function getContenderStatus(groupId) {
  try {
    const status = await getContenderGroupStatus(groupId);
    return status || { enabled: false, last_toggled: null };
  } catch (error) {
    console.error('❌ [CONTENDERS] Get status error:', error);
    return { enabled: false, last_toggled: null };
  }
}

/**
 * Generate contenders list message
 */
async function generateContendersListMessage() {
  try {
    const response = await fetchAllContenders();
    
    if (!response.success || !response.data || response.data.length === 0) {
      return `📋 *BALLON D'OR CONTENDERS*\n\nNo contenders found.`;
    }
    
    let message = `🏆 *BALLON D'OR CONTENDERS* 🏆\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📋 *NOMINEE ROSTER* 📋\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    response.data.forEach((contender, index) => {
      message += `🎯 *Contender #${index + 1}*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `👤 *Name:* ${contender.name}\n`;
      message += `📧 *Nominated email:* ${contender.email}\n`;
      message += `🏆 *Trophy Collection:* ${contender.trophies || 0} 🏆\n`;
      message += `📝 *Achievement Description:* ${contender.description || 'Rising star with exceptional talent'}\n`;
      message += `📤 *Status:* ${contender.sent ? '✅ Announced' : '⏳ Pending'}\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 *Total Contenders:* ${response.data.length}\n`;
    message += `🏆 *Category:* Ballon d'Or Excellence\n`;
    message += `💎 *Every Nomination Represents Excellence* 💎`;
    
    return message;
  } catch (error) {
    console.error('❌ [CONTENDERS] Generate list error:', error);
    return '❌ Failed to fetch contenders list.';
  }
}

module.exports = {
  fetchNewContenders,
  fetchAllContenders,
  markContenderAsSent,
  sendContenderMessage,
  startContenderService,
  toggleContenderMonitoring,
  getContenderStatus,
  generateContendersListMessage,
  getCommunityInfo,
  processNewContender,
  CONFIG
};