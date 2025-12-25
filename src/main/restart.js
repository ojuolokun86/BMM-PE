/**
 * restart.js
 * Handles bot restart lifecycle, messages, and notifications.
 * ----------------------------------------------------------
 */

const path = require('path');

// Track active restarts to avoid duplicate triggers
const activeRestarts = new Map();

/* ─────────── UTILITY: Send restart message ─────────── */

/**
 * Sends a restart message to a phone number via WhatsApp
 * @param {import('@whiskeysockets/baileys').AnyWASocket} sock - Bot socket
 * @param {string} phoneNumber - Phone number to send message to
 * @param {Object} options
 * @param {string} options.type - Type of restart (manual, crash, command, etc)
 * @param {string} options.additionalInfo - Extra info for message
 */
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
    await sock.sendMessage(jid, { text: message });
    console.log(`📩 Restart message (${type}) sent to ${jid}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send restart message: ${error.message}`);
    return false;
  }
}

/* ─────────── UTILITY: Handle restart completion ─────────── */

/**
 * Handles sending messages and optional settings after restart
 * @param {import('@whiskeysockets/baileys').AnyWASocket} sock
 * @param {string} phoneNumber
 * @param {Object} options
 * @param {string} options.type
 * @param {string} options.additionalInfo
 * @param {string} options.authId
 */
async function handleRestartCompletion(sock, phoneNumber, { type, additionalInfo, authId }) {
  if (!sock || !phoneNumber) return false;

  try {
    // Wait for bot connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Send restart message
    const sent = await sendRestartMessage(sock, phoneNumber, { type, additionalInfo });

    // Optional: send settings after restart
    if (sent) {
      try {
        const settingsCommand = require('../handler/command/settings');
        const settingsMsg = {
          key: {
            remoteJid: phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`,
            fromMe: true
          }
        };
        await settingsCommand(authId, sock, settingsMsg);
      } catch (err) {
        console.error('❌ Failed to send settings after restart:', err.message);
      }
    }

    return sent;
  } catch (err) {
    console.error('❌ Failed to handle restart completion:', err.message);
    return false;
  }
}

/* ─────────── LIFECYCLE MANAGEMENT ─────────── */

// References to bot lifecycle functions
let startBotRef = null;
let stopBotRef = null;

/**
 * Registers lifecycle handlers from index.js
 * Must be called ONCE during bot initialization
 * @param {Object} param0
 * @param {Function} param0.startBot
 * @param {Function} param0.stopBot
 */
function registerLifecycle({ startBot, stopBot }) {
  startBotRef = startBot;
  stopBotRef = stopBot;
}

/* ─────────── RESTART BOT FUNCTION ─────────── */

/**
 * Restart the bot safely
 * @param {Object} options
 * @param {string} options.type - Restart type (manual, crash, command, etc)
 * @param {import('@whiskeysockets/baileys').AnyWASocket} [options.sock] - Optional socket to send messages
 * @param {string} [options.phoneNumber] - Optional phone number to notify
 * @param {string} [options.additionalInfo] - Extra info for message
 */
let restarting = false;
async function restartBot({ type = 'manual', sock, phoneNumber, additionalInfo = '' } = {}) {
  if (restarting) {
    console.log('⏳ Restart already in progress');
    return;
  }

  if (!startBotRef || !stopBotRef) {
    console.error('❌ Restart lifecycle not registered');
    return;
  }

  restarting = true;
  console.log(`🔄 Restarting bot (${type})`);

  try {
    // Stop the bot
    await stopBotRef();

    // Small delay
    await new Promise(r => setTimeout(r, 3000));

    // Start the bot
    await startBotRef({ restartType: type });

    console.log('✅ Restart complete');

    // Send restart message if socket & phone number provided
    if (sock && phoneNumber) {
      await handleRestartCompletion(sock, phoneNumber, { type, additionalInfo });
    }

  } catch (err) {
    console.error('❌ Restart failed:', err.message);
  } finally {
    restarting = false;
  }
}

/* =========================================
 * EXPORTS
 * ========================================= */
module.exports = {
  sendRestartMessage,
  handleRestartCompletion,
  restartBot,
  registerLifecycle
};
