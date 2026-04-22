const { 
  setAntitagStatus, 
  getAntitagStatus, 
  addAntitagWarning,
  setAntitagMaxWarnings,
  getAntitagMaxWarnings 
} = require('../../database/database');

/**
 * Check if message is a group status mention notification
 * @param {object} msg - Message object
 * @returns {boolean} - True if group status mention
 */
function isGroupStatusMention(msg) {
  return !!msg.message?.groupStatusMentionMessage;
}

/**
 * Handle anti-group-tag functionality
 * @param {object} sock - WhatsApp socket
 * @param {object} msg - Message object
 * @param {string} chatId - Chat ID
 */
async function handleAntiGroupTag(sock, msg, chatId) {
  try {
    // Check if antitag is enabled for this group
    const antitagStatus = await getAntitagStatus(chatId);
    if (!antitagStatus?.enabled) {
      return; // Feature not enabled
    }

    // Check if this is a group status mention
    if (!isGroupStatusMention(msg)) {
      return; // Not a group status mention
    }
    console.log('FROM:', msg.key.remoteJid);
    console.log('MSG:', JSON.stringify(msg.message, null, 2));

    console.log(`[ANTITAG] Status group mention detected in ${chatId}`);

    // Get max warnings setting
    const maxWarnings = await getAntitagMaxWarnings(chatId) || 3;
    const warningCount = await addAntitagWarning(chatId);
    
    // Delete the notification message
    try {
      await sock.sendMessage(chatId, { delete: msg.key });
      console.log(`[ANTITAG] Deleted group status mention notification from ${chatId}`);
    } catch (deleteError) {
      console.error(`[ANTITAG] Failed to delete notification:`, deleteError);
    }

    // Get sender ID for mention
    const senderId = msg.key.participant || msg.key.remoteJid;
    
    // Warn the user
    try {
      let warningMessage = `*ANTI-GROUP-TAG WARNING* ${warningCount}/${maxWarnings}\n\n`;
      warningMessage += `Group tagging in status updates is not allowed!\n\n`;
      warningMessage += `This is warning ${warningCount} of ${maxWarnings}.\n`;
      
      if (warningCount >= maxWarnings) {
        // Max warnings reached - kick the user
        try {
          if (senderId && chatId.endsWith('@g.us')) {
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            console.log(`[ANTITAG] Kicked user ${senderId} for reaching max warnings`);
            
            warningMessage += `\n*MAX WARNINGS REACHED!* \nYou have been removed from the group for repeated violations.`;
          } else {
            warningMessage += `\n*MAX WARNINGS REACHED!* \nFurther violations will result in removal from the group.`;
          }
        } catch (kickError) {
          console.error(`[ANTITAG] Failed to kick user:`, kickError);
          warningMessage += `\n*MAX WARNINGS REACHED!* \nFailed to remove user from group. Admin action required.`;
        }
      } else {
        const remaining = maxWarnings - warningCount;
        warningMessage += `\n${remaining} more warning(s) before removal.`;
        warningMessage += `\nPlease refrain from tagging groups in status updates.`;
      }

      // Send warning with user mention
      await sock.sendMessage(chatId, {
        text: warningMessage,
        mentions: [senderId]
      });
      console.log(`[ANTITAG] Sent warning ${warningCount}/${maxWarnings} to ${chatId}`);

    } catch (warnError) {
      console.error(`[ANTITAG] Failed to send warning:`, warnError);
    }

  } catch (error) {
    console.error(`[ANTITAG] Error handling anti-group-tag:`, error);
  }
}

/**
 * Toggle anti-group-tag status for a user
 * @param {string} userId - User ID
 * @param {boolean} enabled - Enable/disable status
 * @returns {boolean} - New status
 */
async function toggleAntiGroupTag(userId, enabled = null) {
  try {
    const current = await getAntitagStatus(userId);
    const newStatus = enabled !== null ? enabled : !current?.enabled;
    
    await setAntitagStatus(userId, newStatus);
    
    console.log(`[ANTITAG] ${newStatus ? 'Enabled' : 'Disabled'} anti-group-tag for user: ${userId}`);
    return newStatus;
  } catch (error) {
    console.error(`[ANTITAG] Error toggling anti-group-tag:`, error);
    return false;
  }
}

/**
 * Get anti-group-tag status for a user
 * @param {string} userId - User ID
 * @returns {object} - Status object
 */
async function getAntiGroupTagStatus(userId) {
  try {
    const status = await getAntitagStatus(userId);
    const maxWarnings = await getAntitagMaxWarnings(userId) || 3;
    return { ...status, max_warnings: maxWarnings };
  } catch (error) {
    console.error(`[ANTITAG] Error getting status:`, error);
    return { enabled: false, warnings: 0, max_warnings: 3, last_warning: null };
  }
}

module.exports = {
  handleAntiGroupTag,
  toggleAntiGroupTag,
  getAntiGroupTagStatus,
  isGroupStatusMention
};