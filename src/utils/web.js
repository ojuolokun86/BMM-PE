const axios = require('axios');
const { delay } = require('@whiskeysockets/baileys');

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://dyn.fly.dev/api/bot/',//'https://your-app.fly.dev',
  CHECK_INTERVAL: 10000, // 10 seconds
  WEBSITE_LINK: 'https://dynamicfootball.netlify.app'
};

// Store active contender monitoring per group
const activeGroups = new Map(); // groupId => { enabled: boolean, interval: number }
const processedContenders = new Set();

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
    console.log(`📤 [CONTENDERS] Sending message for contender: ${contender.name} to group: ${groupId}`);
    
    // Create message caption with community info
    let caption = `🏆 *BALLON D'OR NOMINATION* 🏆\n\n`;
    caption += `Name: ${contender.name}\n`;
    caption += `Description: ${contender.description || 'No description'}\n`;
    caption += `Nominated by: ${contender.email}\n`;
    
    // Add community info if available
    if (communityInfo) {   
      caption += `Community: ${communityInfo.communityName}\n`;
      caption += `Group: ${communityInfo.groupName}\n`;
      caption += `Owner: @${communityInfo.groupOwner.split('@')[0]}\n`;
    }
    
    caption += `Trophies: ${contender.trophies || 0}\n\n`;
    caption += `Vote now: ${CONFIG.WEBSITE_LINK}`;
    
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
    console.error('❌ [CONTENDERS] Send message error:', error);
  }
}

/**
 * Main function to fetch and send contenders for active groups
 */
async function fetchAndSendContenders(sock) {
  try {
    console.log('🚀 [CONTENDERS] Starting fetch and send cycle...');
    
    // Fetch new contenders
    const response = await fetchNewContenders();
    
    if (!response.success || !response.data || response.data.length === 0) {
      console.log('📭 [CONTENDERS] No new contenders found');
      return;
    }
    
    console.log(`📊 [CONTENDERS] Found ${response.data.length} new contenders`);
    
    // Process each active group
    for (const [groupId, groupConfig] of activeGroups.entries()) {
      if (!groupConfig.enabled) {
        continue;
      }
      
      console.log(`🎯 [CONTENDERS] Processing group: ${groupId}`);
      
      // Get community info
      const communityInfo = await getCommunityInfo(sock, groupId);
      
      // Process each contender
      for (const contender of response.data) {
        // Skip if already processed
        if (processedContenders.has(contender.id)) {
          console.log(`⏭️ [CONTENDERS] Skipping already processed contender: ${contender.id}`);
          continue;
        }
        
        // Skip if no image (API should filter this, but double-check)
        if (!contender.picture) {
          console.log(`⚠️ [CONTENDERS] Skipping contender without image: ${contender.name}`);
          continue;
        }
        
        // Send message
        await sendContenderMessage(sock, contender, groupId, communityInfo);
        
        // Small delay between messages to avoid spam
        await delay(2000);
      }
    }
    
    console.log('✅ [CONTENDERS] Fetch and send cycle completed');
    
  } catch (error) {
    console.error('❌ [CONTENDERS] Fetch and send error:', error);
  }
}

/**
 * Start contender checking service
 */
function startContenderService(sock) {
  console.log('⚙️ [CONTENDERS] Starting contender service...');
  
  // Initial fetch
  fetchAndSendContenders(sock);
  
  // Set up periodic checking
  const interval = setInterval(() => {
    fetchAndSendContenders(sock);
  }, CONFIG.CHECK_INTERVAL);
  
  console.log(`⏰ [CONTENDERS] Service started - checking every ${CONFIG.CHECK_INTERVAL}ms`);
  
  return interval;
}

/**
 * Toggle contender monitoring for a group
 */
function toggleContenderMonitoring(groupId, enabled = null) {
  if (enabled === null) {
    // Toggle current state
    const current = activeGroups.get(groupId);
    enabled = !current?.enabled;
  }
  
  activeGroups.set(groupId, { 
    enabled, 
    interval: CONFIG.CHECK_INTERVAL,
    lastToggled: Date.now()
  });
  
  console.log(`🔄 [CONTENDERS] ${enabled ? 'Enabled' : 'Disabled'} contender monitoring for group: ${groupId}`);
  
  return enabled;
}

/**
 * Get contender monitoring status for a group
 */
function getContenderStatus(groupId) {
  return activeGroups.get(groupId) || { enabled: false, interval: CONFIG.CHECK_INTERVAL };
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
    
    let message = `📋 *BALLON D'OR CONTENDERS*\n\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;
    
    response.data.forEach((contender, index) => {
      message += `${index + 1}. *${contender.name}*\n`;
      message += `   📧 Email: ${contender.email}\n`;
      message += `   🏆 Trophies: ${contender.trophies || 0}\n`;
      message += `   📝 Description: ${contender.description || 'No description'}\n`;
      message += `   ✅ Sent: ${contender.sent ? 'Yes' : 'No'}\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 Total: ${response.data.length} contenders`;
    
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
  fetchAndSendContenders,
  startContenderService,
  toggleContenderMonitoring,
  getContenderStatus,
  generateContendersListMessage,
  getCommunityInfo,
  CONFIG,
  activeGroups
};