const { 
  toggleAntiGroupTag, 
  getAntiGroupTagStatus 
} = require('../features/antiGroupTag');
const { 
  setAntitagMaxWarnings, 
  getAntitagMaxWarnings 
} = require('../../database/database');

/**
 * Handle antitag command
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {string} senderId - Sender ID
 * @param {array} args - Command arguments
 * @param {boolean} isAdmin - Whether sender is admin
 */
async function handleAntitagCommand(sock, chatId, senderId, args, isAdmin) {
  try {
    // Only admins can use this command
    if (!isAdmin) {
      return sock.sendMessage(chatId, {
        text: 'Only admins can use this command.'
      });
    }

    const action = args[0]?.toLowerCase();
    
    switch (action) {
      case 'on':
      case 'enable':
      case 'start':
        await handleEnableCommand(sock, chatId);
        break;
        
      case 'off':
      case 'disable':
      case 'stop':
        await handleDisableCommand(sock, chatId);
        break;
        
      case 'status':
        await handleStatusCommand(sock, chatId);
        break;
        
      case 'reset':
        await handleResetCommand(sock, chatId);
        break;
        
      case 'max':
      case 'warnings':
      case 'limit':
        await handleMaxWarningsCommand(sock, chatId, args);
        break;
        
      default:
        await showHelpMessage(sock, chatId);
        break;
    }
    
  } catch (error) {
    console.error('Error in antitag command:', error);
    sock.sendMessage(chatId, { text: 'Failed to execute antitag command.' });
  }
}

/**
 * Handle enable command
 */
async function handleEnableCommand(sock, chatId) {
  try {
    const enabled = await toggleAntiGroupTag(chatId, true);
    
    if (enabled) {
      await sock.sendMessage(chatId, {
        text: `*ANTI-GROUP-TAG ENABLED* \n\n` +
              `Group tagging in status updates will now be automatically deleted and users will be warned.\n\n` +
              `Use \`.antitag status\` to check current settings.`
      });
    } else {
      await sock.sendMessage(chatId, {
        text: 'Failed to enable anti-group-tag protection.'
      });
    }
  } catch (error) {
    console.error('Antitag enable error:', error);
    sock.sendMessage(chatId, { text: 'Failed to enable anti-group-tag protection.' });
  }
}

/**
 * Handle disable command
 */
async function handleDisableCommand(sock, chatId) {
  try {
    const enabled = await toggleAntiGroupTag(chatId, false);
    
    if (!enabled) {
      await sock.sendMessage(chatId, {
        text: `*ANTI-GROUP-TAG DISABLED* \n\n` +
              `Group tagging in status updates will no longer be automatically deleted.\n\n` +
              `Use \`.antitag on\` to re-enable protection.`
      });
    } else {
      await sock.sendMessage(chatId, {
        text: 'Failed to disable anti-group-tag protection.'
      });
    }
  } catch (error) {
    console.error('Antitag disable error:', error);
    sock.sendMessage(chatId, { text: 'Failed to disable anti-group-tag protection.' });
  }
}

/**
 * Handle status command
 */
async function handleStatusCommand(sock, chatId) {
  try {
    const status = await getAntiGroupTagStatus(chatId);
    const maxWarnings = await getAntitagMaxWarnings(chatId);
    
    let message = `*ANTI-GROUP-TAG STATUS* \n\n`;
    message += `Status: ${status.enabled ? 'ON' : 'OFF'}\n`;
    message += `Current Warnings: ${status.warnings}\n`;
    message += `Max Warnings: ${maxWarnings}\n`;
    message += `Remaining: ${maxWarnings - status.warnings}\n`;
    
    if (status.last_warning) {
      message += `Last Warning: ${new Date(status.last_warning).toLocaleString()}\n`;
    } else {
      message += `Last Warning: None\n`;
    }
    
    message += `\n*Protection Rules:*\n`;
    message += `1. Detects group tags in status updates\n`;
    message += `2. Automatically deletes offending status\n`;
    message += `3. Issues warnings (max ${maxWarnings})\n`;
    message += `4. Removes users after max warnings\n`;
    message += `5. Tracks violation history`;
    
    await sock.sendMessage(chatId, { text: message });
    
  } catch (error) {
    console.error('Antitag status error:', error);
    sock.sendMessage(chatId, { text: 'Failed to get anti-group-tag status.' });
  }
}

/**
 * Handle reset command
 */
async function handleResetCommand(sock, chatId) {
  try {
    const { resetAntitagWarnings } = require('../../database/database');
    await resetAntitagWarnings(chatId);
    
    await sock.sendMessage(chatId, {
      text: `*ANTI-GROUP-TAG WARNINGS RESET* \n\n` +
            `All warnings for this group have been reset to zero.\n\n` +
            `Users will start receiving warnings from 1 again.`
    });
    
  } catch (error) {
    console.error('Antitag reset error:', error);
    sock.sendMessage(chatId, { text: 'Failed to reset anti-group-tag warnings.' });
  }
}

/**
 * Handle max warnings command
 */
async function handleMaxWarningsCommand(sock, chatId, args) {
  try {
    const newMax = parseInt(args[1]);
    
    if (!newMax || newMax < 1 || newMax > 10) {
      await sock.sendMessage(chatId, {
        text: `*INVALID MAX WARNINGS* \n\n` +
              `Please provide a number between 1 and 10.\n\n` +
              `Usage: \`.antitag max <number>\`\n` +
              `Example: \`.antitag max 5\``
      });
      return;
    }
    
    await setAntitagMaxWarnings(chatId, newMax);
    
    await sock.sendMessage(chatId, {
      text: `*MAX WARNINGS UPDATED* \n\n` +
            `Maximum warnings has been set to ${newMax}.\n\n` +
            `Users will now be removed after ${newMax} violations.\n\n` +
            `Current warnings will remain the same.`
    });
    
  } catch (error) {
    console.error('Antitag max warnings error:', error);
    sock.sendMessage(chatId, { text: 'Failed to set max warnings.' });
  }
}

/**
 * Show help message
 */
async function showHelpMessage(sock, chatId) {
  let message = `*ANTI-GROUP-TAG COMMANDS* \n\n`;
  message += `*.antitag on* - Enable anti-group-tag protection\n`;
  message += `*.antitag off* - Disable anti-group-tag protection\n`;
  message += `*.antitag status* - Show current status and warnings\n`;
  message += `*.antitag reset* - Reset all warnings to zero\n`;
  message += `*.antitag max <1-10>* - Set max warnings before kick\n\n`;
  message += `*What it does:*\n`;
  message += `Detects and deletes status updates containing group tags (@group mentions)\n`;
  message += `Issues warnings to users who violate the rule\n`;
  message += `Automatically removes users after max warnings\n`;
  message += `Tracks warning history for each user\n\n`;
  message += `*Examples:*\n`;
  message += `*.antitag max 5* - Set max warnings to 5\n`;
  message += `*.antitag max 2* - Set max warnings to 2 (strict)`;
  
  await sock.sendMessage(chatId, { text: message });
}

module.exports = {
  handleAntitagCommand
};
