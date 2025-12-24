const sendtoChat = require('../utils/sendToChat');
const {} = require('../handler/command/settings');
const activeRestarts = new Map();
async function sendRestartMessage(sock, phoneNumber, { type = 'manual', additionalInfo = '' } = {}) {
  if (!sock?.sendMessage) {
    console.error('❌ Cannot send restart message: Invalid socket');
    return false;
  }
  const { version } = require('../../package.json');
  const messageMap = {
    manual: `🖥️ [SYSTEM]: Manual reboot protocol engaged.\n> STATUS: Online\n> VERSION: ${version}\n> ACTION: System now stabilized.`,
    command: `🖥️ [COMMAND]: Reboot directive acknowledged.\n> SEQUENCE: Completed successfully\n> VERSION: ${version}\n> SYSTEM: Fully operational.`,
    initial: `🖥️ [BOOT]: Initialization sequence complete.\n> STATUS: ACTIVE\n> SYSTEM: All modules loaded\n> VERSION: ${version}`,
    crash: `🖥️ [ALERT]: Critical failure detected.\n> RECOVERY: Executed successfully\n> STATUS: STABLE\n> VERSION: ${version}`,
    deployment: `🖥️ [UPDATE]: Firmware upgrade finalized.\n> NEW VERSION: ${version}\n> STATUS: Operational\n> NOTE: Execute 'help' for command reference.`
};



  const message = `${messageMap[type] || '🔄 Bot has been restarted'}\n\n${additionalInfo || ''}`.trim();
  const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

  try {
    await sock.sendMessage(jid, { 
      text: message,
      // You can add more message options here if needed
      // For example, you can add buttons, mentions, etc.
    });
    console.log(`📩 Restart message (${type}) sent to ${jid}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send restart message: ${error.message}`);
    return false;
  }
}

async function handleRestartCompletion(sock, phoneNumber, { type, additionalInfo, authId }) {
  if (!sock || !phoneNumber) return false;
  
  try {
    // Wait for the connection to be fully established
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Send the restart message
    const messageSent = await sendRestartMessage(sock, phoneNumber, { 
      type, 
      additionalInfo 
    });

    // After sending restart message, send settings
    if (messageSent) {
      try {
        // Import settings command
        const settingsCommand = require('../handler/command/settings');
        // Create a message-like object that the settings command expects
        const settingsMsg = {
          key: {
            remoteJid: phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`,
            fromMe: true
          }
        };
        // Execute settings command
        await settingsCommand(authId, sock, settingsMsg);
      } catch (error) {
        console.error('❌ Failed to send settings after restart:', error.message);
      }
    }

    return messageSent;
  } catch (error) {
    console.error(`❌ Failed to handle restart completion:`, error.message);
    return false;
  }
}

async function restartBotForUser({
  authId,
  phoneNumber,
  country,
  pairingMethod,
  onStatus,
  onQr,
  onPairingCode,
  restartType = '',
  additionalInfo = '',
}) {
  const { stopBmmBot, startBmmBot } = require('./main');
  const sessionKey = `${authId}:${phoneNumber}`;

  if (activeRestarts.has(sessionKey)) {
    console.log(`⏳ Restart already in progress for ${phoneNumber}, skipping...`);
    return { success: false, error: 'Restart already in progress' };
  }

  try {
    activeRestarts.set(sessionKey, true);
    onStatus?.('stopping');

    // Only stop if not initial start
    
      stopBmmBot(authId, phoneNumber);
      await new Promise(resolve => setTimeout(resolve, 5000));
    

    onStatus?.('starting');
    let restartAttempts = 0;
    const maxAttempts = 3;

    while (restartAttempts < maxAttempts) {
      try {
        const newBmm = await startBmmBot({
          authId,
          phoneNumber,
          country,
          pairingMethod,
          onStatus: (status) => {
            onStatus?.(status);
          },
          onQr,
          onPairingCode,
          restartType,
          additionalInfo
        });

        if (newBmm) {
          // Handle the restart completion (including sending the message and settings)
          await handleRestartCompletion(newBmm, phoneNumber, {
            type: restartType,
            additionalInfo,
            authId  // Pass authId to handleRestartCompletion
          });
          
          return { 
            success: true, 
            bmm: newBmm,
            messageSent: true
          };
        }
      } catch (error) {
        console.error(`❌ Restart attempt ${restartAttempts + 1} failed:`, error.message);
        restartAttempts++;
        if (restartAttempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000 * restartAttempts));
        }
      }
    }

    throw new Error(`Failed to restart after ${maxAttempts} attempts`);
  } catch (error) {
    console.error(`❌ Failed to restart bot (${restartType}):`, error.message);
    return { 
      success: false, 
      error: error.message,
      messageSent: false
    };
  } finally {
    setTimeout(() => {
      activeRestarts.delete(sessionKey);
    }, 30000);
  }
}

module.exports = {  
  restartBotForUser,
  handleRestartCompletion,
  sendRestartMessage
};