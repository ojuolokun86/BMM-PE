const { checkIfAdmin } = require('./kick');
const { 
  toggleContenderMonitoring, 
  getContenderStatus, 
  generateContendersListMessage,
  getCommunityInfo 
} = require('../../utils/web');

/**
 * Handle contender commands
 */
async function handleContenderCommand(sock, msg, chatId, sender, args) {
  try {
    // Restrict to specific bot user ID: 2348051891310
    // const botUserId = sock?.user?.id?.split(':')[0]?.split('@')[0];
    // if (botUserId !== '2348051891310') {
    //   return sock.sendMessage(chatId, {
    //     text: '❌ Command not available.'
    //   });
    // }

    const isAdmin = await checkIfAdmin(sock, chatId, sender);
    
    if (!isAdmin) {
      return sock.sendMessage(chatId, {
        text: '❌ Only admins can use this command.'
      });
    }

    const command = args[0]?.toLowerCase();
    
    switch (command) {
      case 'start':
        await handleStartCommand(sock, chatId);
        break;
        
      case 'stop':
        await handleStopCommand(sock, chatId);
        break;
        
      case 'status':
        await handleStatusCommand(sock, chatId);
        break;
        
      case 'list':
        await handleListCommand(sock, chatId);
        break;
        
      default:
        await showHelpMessage(sock, chatId);
        break;
    }
    
  } catch (error) {
    console.error('❌ [CONTENDER CMD] Error:', error);
    sock.sendMessage(chatId, { text: '❌ Failed to execute contender command.' });
  }
}

/**
 * Handle start command
 */
async function handleStartCommand(sock, chatId) {
  try {
    // Get group name for database
    const groupMeta = await sock.groupMetadata(chatId);
    const groupName = groupMeta.subject;
    
    const enabled = await toggleContenderMonitoring(chatId, groupName, true);
    
    if (enabled) {
      // Check if group has community
      const communityInfo = await getCommunityInfo(sock, chatId);
      
      let message = `🏆 *CONTENDER MONITORING STARTED* 🏆\n\n`;
      message += `✅ Ballon d'Or contender monitoring is now **ACTIVE**\n\n`;
      
      if (communityInfo) {
        message += `🏘️ *Community:* ${communityInfo.communityName}\n`;
        message += `👥 *Group:* ${communityInfo.groupName}\n`;
        message += `👤 *Owner:* @${communityInfo.groupOwner.split('@')[0]}\n\n`;
        message += `🎯 New contenders will be posted here automatically!`;
      } else {
        message += `⚠️ *Note:* This group is not part of a community.\n`;
        message += `🎯 Contenders will be posted without community info.`;
      }
      
      await sock.sendMessage(chatId, {
        text: message,
        mentions: communityInfo ? [communityInfo.groupOwner] : []
      });
    } else {
      await sock.sendMessage(chatId, {
        text: '⚠️ Contender monitoring is already enabled for this group.'
      });
    }
  } catch (error) {
    console.error('❌ [CONTENDER CMD] Start error:', error);
    sock.sendMessage(chatId, { text: '❌ Failed to start contender monitoring.' });
  }
}

/**
 * Handle stop command
 */
async function handleStopCommand(sock, chatId) {
  try {
    const enabled = await toggleContenderMonitoring(chatId, null, false);
    
    if (!enabled) {
      await sock.sendMessage(chatId, {
        text: `🛑 *CONTENDER MONITORING STOPPED*\n\n✅ Ballon d'Or contender monitoring is now **INACTIVE** for this group.`
      });
    } else {
      await sock.sendMessage(chatId, {
        text: '⚠️ Contender monitoring is already disabled for this group.'
      });
    }
  } catch (error) {
    console.error('❌ [CONTENDER CMD] Stop error:', error);
    sock.sendMessage(chatId, { text: '❌ Failed to stop contender monitoring.' });
  }
}

/**
 * Handle status command
 */
async function handleStatusCommand(sock, chatId) {
  try {
    const status = await getContenderStatus(chatId);
    const communityInfo = await getCommunityInfo(sock, chatId);
    
    let message = `📊 *CONTENDER MONITORING STATUS* 📊\n\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `🔄 *Status:* ${status.enabled ? '🟢 ACTIVE' : '🔴 INACTIVE'}\n`;
    message += `📅 *Last Toggled:* ${status.last_toggled ? new Date(status.last_toggled).toLocaleString() : 'Never'}\n\n`;
    
    if (communityInfo) {
      message += `🏘️ *Community:* ${communityInfo.communityName}\n`;
      message += `👥 *Group:* ${communityInfo.groupName}\n`;
      message += `👤 *Owner:* @${communityInfo.groupOwner.split('@')[0]}\n`;
    } else {
      message += `⚠️ *Community Status:* Not part of any community\n`;
    }
    
    message += `\n━━━━━━━━━━━━━━━━━━`;
    
    await sock.sendMessage(chatId, {
      text: message,
      mentions: communityInfo ? [communityInfo.groupOwner] : []
    });
  } catch (error) {
    console.error('❌ [CONTENDER CMD] Status error:', error);
    sock.sendMessage(chatId, { text: '❌ Failed to get contender status.' });
  }
}

/**
 * Handle list command
 */
async function handleListCommand(sock, chatId) {
  try {
    const message = await generateContendersListMessage();
    
    await sock.sendMessage(chatId, { text: message });
  } catch (error) {
    console.error('❌ [CONTENDER CMD] List error:', error);
    sock.sendMessage(chatId, { text: '❌ Failed to fetch contenders list.' });
  }
}

/**
 * Show help message
 */
async function showHelpMessage(sock, chatId) {
  const message = `🏆 *BALLON D'OR CONTENDER COMMANDS* 🏆\n\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 *Available Commands:*\n\n` +
    `• \`.contender start\`\n` +
    `  🟢 Start contender monitoring in this group\n\n` +
    `• \`.contender stop\`\n` +
    `  🔴 Stop contender monitoring in this group\n\n` +
    `• \`.contender status\`\n` +
    `  📊 Show current monitoring status\n\n` +
    `• \`.contender list\`\n` +
    `  📋 Show all contenders with details\n\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🎯 *Features:*\n` +
    `✅ Automatic new contender detection\n` +
    `✅ Community information integration\n` +
    `✅ Only one group monitoring at a time\n` +
    `✅ Image processing with fallback\n` +
    `✅ Duplicate prevention\n\n` +
    `👤 *Admin only command*`;

  await sock.sendMessage(chatId, { text: message });
}

module.exports = handleContenderCommand;
