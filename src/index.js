/**
 * index.js
 * Main entry point for the WhatsApp bot
 * --------------------------------------
 */
require("./console-style.js");
const readline = require('readline');
const { getBaileys } = require('./utils/baileys');
const pino = require('pino');
const NodeCache = require('node-cache');
const qrTerminal = require('qrcode-terminal');
const store = require('./utils/store');

const { botStartTimes } = require('./utils/globalStore');

// Restart system
const { restartBot, registerLifecycle, sendRestartMessage, detectRestartSource, consumePendingRestartNotification, readRestartState, saveRestartState, setPendingRestartNotification } = require('./main/restart');

// SQLite auth
const { useSQLiteAuthState, getAllSessions, deleteSession } = require('./database/sqliteAuthState');

// Contender service
const ContenderReceiverServer = require('./server/contenderReceiver');


// Message handler
const handleIncomingMessage = require('./handler/messageHandler');

store.readFromFile()
setInterval(() => store.writeToFile(), 10000)
//console.log(store.contacts)
// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000) // every 1 minute

let lastRestart = 0

// const used = process.memoryUsage().rss / 1024 / 1024
// if (used > 400 && Date.now() - lastRestart > 60000) {
//   lastRestart = Date.now()
//   console.log("cooldown restart triggered")
//   process.exit(1)
// }
// Memory monitoring - Restart if RAM gets too high
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 300 && Date.now() - lastRestart > 60000) {
       lastRestart = Date.now()
        console.log('⚠️ RAM too high (>300MB), restarting bot...')
        process.exit(1) // Panel will auto-restart
    }
}, 30_000) // check every 30 seconds
// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Stopping bot gracefully...');
  try {
    await stopBot(true); // Save session before exiting
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during graceful shutdown:', err);
    process.exit(1);
  }
});

// Also handle other termination signals
process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Stopping bot gracefully...');
  try {
    await stopBot(true); // Save session before exiting
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during graceful shutdown:', err);
    process.exit(1);
  }
});

/* ─────────── UTILITY FUNCTIONS ─────────── */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(color, text) {
  const colors = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[color] || ''}${text}${colors.reset}`);
}

/* ─────────── PROMPTS ─────────── */

function askUserChoice() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log('\n🔐 Choose authentication method:');
    console.log('1️⃣  QR Code');
    console.log('2️⃣  Pairing Code\n');

    rl.question('Enter your choice (1 or 2): ', answer => {
      rl.close();
      resolve(answer.trim() === '2' ? 'pairingCode' : 'qrCode');
    });
  });
}

function askPhoneNumber() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    rl.question('\n📱 Enter phone number (with country code): ', answer => {
      rl.close();
      answer ? resolve(answer.trim()) : resolve(askPhoneNumber());
    });
  });
}

/* ─────────── GLOBAL STATE ─────────── */

let sock = null;
let restarting = false;
let pm2BootNotified = false;
const BOT_OWNER_NUMBER = '2348026977793'; // CHANGE THIS to your number
const groupCache = new NodeCache({ stdTTL: 3600, useClone: false });
/* ─────────── BOOT SEQUENCE ─────────── */

async function bootSequence() {
  log('cyan', '🖥️  SYSTEM BOOT INITIATED');
  await sleep(1500);

  log('yellow', '⚙️  Loading core modules...');
  await sleep(2000);

  log('yellow', '🔌 Initializing network interfaces...');
  await sleep(2000);

  log('yellow', '🧠 Syncing authentication state...');
  await sleep(2000);

  log('green', '✅ System integrity verified');
  await sleep(1000);

  log('cyan', '🚀 Launching WhatsApp engine...\n');
}

/* ─────────── START BOT ─────────── */

// Detect restart source if not explicitly provided
const restartSource = detectRestartSource();

// Global connection timeout tracker
let connectionTimeout = null;

// Global phone number for restart notifications
let phoneNumber = null;

// Read restart state on startup
const restartState = readRestartState();

async function startBot({ restartType = 'manual', source = restartSource } = {}) {
  const baileys = await getBaileys();
  
  const {
    default: makeWASocket,
    DisconnectReason,
    Browsers,
    jidDecode,
    fetchLatestBaileysVersion
  } = baileys;
  await bootSequence();

  try {
    const authId = '123456';
    
  
    let pairingMethod;

    const sessions = getAllSessions();

    let isFirstLogin = false;
    
    if (sessions.length) {
      phoneNumber = sessions[0];
      pairingMethod = 'pairingCode';
      console.log(`Loaded session: ${phoneNumber}`);
    } else {
      isFirstLogin = true;
      pairingMethod = await askUserChoice();
      phoneNumber = await askPhoneNumber();
    }

    const { state, saveCreds } = await useSQLiteAuthState(authId, phoneNumber);
    const {version} = await fetchLatestBaileysVersion()
    let qrShown = false;
    let pairingRequested = false;
    const msgRetryCounterCache = new NodeCache()
    sock = makeWASocket({
      version: version,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      logger: pino({
          level: "error",
          base: { module: "BAILEYS" },
          transport: {
              target: "pino-pretty",
              options: {
                  colorize: true,
                  translateTime: "HH:MM",
                  ignore: "pid,hostname",
              },
          },
      }),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      receivedPendingNotifications: true,
      defaultQueryTimeoutMs: 120000,
      connectTimeoutMs: 120000,
      keepAliveIntervalMs: 10000,
      reconnectIntervalMs: 10000,
      getMessage: async (key) => {
        const msg = await store.loadMessage(key.remoteJid, key.id)
        return msg?.message || undefined
      },
      syncFullHistory: false,
      groupMetadataCache: key => groupCache.get(key),
      groupMetadataCacheSet: (key, value) => groupCache.set(key, value),
      msgRetryCounterCache
      
    });

    sock.decodeJid = (jid) => {
      if (!jid) return jid
      if (/:\d+@/gi.test(jid)) {
        const decode = jidDecode(jid) || {}
        return (decode.user && decode.server) ? `${decode.user}@${decode.server}` : jid
      }
      return jid
    }
    store.bind(sock.ev, { decodeJid: sock.decodeJid });
    sock.authState = { saveCreds };

    /* ─── CONNECTION EVENTS ─── */
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      // Handle connection errors with robust restart logic
      if (connection === 'connecting') {
        console.log('Connecting to WhatsApp...');
      }
      
      if (connection === 'open') {
        console.log('✅ Bot connected');
        await new Promise(res => setTimeout(res, 3000))
        const botId = sock?.user?.id?.split(':')[0]?.split('@')[0];
        if (botId && !botStartTimes[botId]) botStartTimes[botId] = Date.now();
        qrShown = false;
        pairingRequested = false
        console.log(' checking querry', typeof sock.query)

        // Handle first login detection
        if (isFirstLogin) {
          console.log('First login detected - setting pending notification');
          isFirstLogin = false; // Reset after detection
          
          // Set pending notification for first login
          await setPendingRestartNotification({
            jid: phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`,
            type: 'login',
            additionalInfo: 'New login session established'
          });
        }

        // Handle post-connection actions based on restart state
        if (restartState) {
          console.log(`Reconnected after ${restartState.type} restart`);
          
          // Send appropriate online message based on restart type
          if (restartState.type === 'crash') {
            await sendRestartMessage(sock, phoneNumber, { 
              type: 'crash',
              additionalInfo: 'System recovered from unexpected termination.'
            });
          } else if (restartState.type === 'pm2') {
            await sendRestartMessage(sock, phoneNumber, {
              type: 'pm2',
              additionalInfo: 'PM2 process manager has restarted the bot.'
            });
          } else if (restartState.type === 'login') {
            await sendRestartMessage(sock, phoneNumber, {
              type: 'login',
              additionalInfo: 'New login session established.'
            });
          } else if (restartState.type === 'connection_error') {
            await sendRestartMessage(sock, phoneNumber, {
              type: 'connection_error',
              additionalInfo: restartState.additionalInfo || 'Connection recovered.'
            });
          }
        }

        // Handle pending restart notifications
        const pending = consumePendingRestartNotification();
        if (pending?.jid) {
          console.log('Processing pending restart notification:', pending.type);
          console.log('Socket state check - user:', sock.user ? 'exists' : 'null');
          console.log('Socket state check - authState:', sock.authState ? 'exists' : 'null');
          
          // Wait a bit more to ensure socket is fully ready
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          try {
            console.log('Attempting to send restart message to:', pending.jid);
            const sent = await sendRestartMessage(sock, pending.jid, {
              type: pending.type || 'manual',
              additionalInfo: pending.additionalInfo || ''
            });
            if (sent) {
              console.log(`Pending restart notification sent successfully for type: ${pending.type}`);
            } else {
              console.log(`Failed to send pending restart notification for type: ${pending.type}`);
              // Retry once more after additional delay
              console.log('Retrying message send after 3 more seconds...');
              await new Promise(resolve => setTimeout(resolve, 3000));
              const retrySent = await sendRestartMessage(sock, pending.jid, {
                type: pending.type || 'manual',
                additionalInfo: pending.additionalInfo || ''
              });
              if (retrySent) {
                console.log(`Retry successful for type: ${pending.type}`);
              } else {
                console.log(`Retry failed for type: ${pending.type}`);
              }
            }
          } catch (error) {
            console.error('Error sending pending restart notification:', error.message);
          }
        }

      
        
        // Start contender receiver server
        console.log('🚀 [CONTENDERS] Starting contender receiver server...');
        setTimeout(() => {
          const server = new ContenderReceiverServer(sock)
          server.start()
        }, 5000)
        

      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'Unknown reason';
        const isLoggedOut = code === DisconnectReason.loggedOut;
        const isBadSession = code === DisconnectReason.connectionClosed;
        const isFirstLoginRestart = code === 515; // Stream Errored (restart required) - first login

        console.log('Connection closed - Code:', code, '- Reason:', reason);

        // Handle first login restart (code 515)
        if (isFirstLoginRestart) {
          console.log('First login detected - connection requires restart');
          if (!restarting) {
            // Set pending notification for first login
            await setPendingRestartNotification({
              jid: phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`,
              type: 'login',
              additionalInfo: 'New login session established'
            });
            
            console.log('Waiting 30 seconds before restart for login processing...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            await restartBot({ 
              type: 'login',
              sock, 
              phoneNumber,
              source: 'first_login_restart',
              additionalInfo: `First login connection restart - Code: ${code}, Reason: ${reason}`
            });
          }
          return; // Skip other logic
        }

        // Only stop and delete session for logout or bad session
        if (isLoggedOut || isBadSession) {
          console.log('Session invalid - clearing session and stopping');
          deleteSession(authId, phoneNumber);
          process.exit(0);
        }

        // Restart for all other connection issues
        if (!restarting) {
          console.log('Connection issue detected - auto-restarting bot');
          await restartBot({ 
            type: 'connection_error',
            sock, 
            phoneNumber,
            source: 'connection_close',
            additionalInfo: `Connection closed - Code: ${code}, Reason: ${reason} - restarting bot`
          });
        }
      }

      // Handle connection timeout
      if (connection === 'connecting') {
        // Set a timeout for connection attempts
        connectionTimeout = setTimeout(async () => {
          if (!restarting && connection === 'connecting') {
            console.log(' Connection timeout - forcing restart');
            await restartBot({ 
              type: 'timeout',
              sock, 
              phoneNumber,
              source: 'connection_timeout',
              additionalInfo: 'Connection timeout - forced restart'
            });
          }
        }, 120000); // 2 minutes timeout
      } else {
        // Clear timeout if connection is no longer 'connecting'
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
      }

      // QR Code Display
      if (pairingMethod === 'qrCode' && qr && !qrShown) {
        qrShown = true;
        console.log('\n🔐 *Authentication Required*');
        console.log('┌' + '─'.repeat(48) + '┐');
        console.log('│ ' + 'Scan the QR code below to log in'.padEnd(47) + '│');
        console.log('│ ' + '1. Open WhatsApp on your phone'.padEnd(47) + '│');
        console.log('│ ' + '2. Tap Menu > Linked Devices > Link a Device'.padEnd(47) + '│');
        console.log('│ ' + '3. Point your phone at the QR code'.padEnd(47) + '│');
        console.log('└' + '─'.repeat(48) + '┘\n');
        
        try {
          // Generate QR code
          qrTerminal.generate(qr, { small: true });
          
          // Show WhatsApp web link as fallback
          const qrCode = qr.split('@')[1];
          if (qrCode) {
            console.log('\n🔗 Or use this link if scanning fails:');
            console.log(`https://wa.me/qr/${qrCode}`);
          }
        } catch (error) {
          console.error('❌ Error generating QR code:', error.message);
          console.log('\n⚠️  Please try restarting the application.');
        }
      }

      // Pairing code
      if (pairingMethod === 'pairingCode' && qr && !pairingRequested) {
        pairingRequested = true;
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('🔐 Pairing Code:', code.match(/.{1,4}/g).join('-'));
      }
    });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', ({ messages }) => {
      const msg = messages[0];
      if (msg.key.id.startsWith('BAE5') && msg.key.id.length === 16) return

      if (!msg.message) return;

      handleIncomingMessage({ authId, sock, msg, phoneNumber });
    });

    sock.ev.on('lid-mapping.update', (update) => {
      //console.log('🔁 New LID ↔ PN mapping:', update)
    })

    // Handle incoming calls
    // sock.ev.on('call', async ({ call }) => {
    //   await handleIncomingCall(sock, call);
    // });

    sock.ev.on('groups.update', (updates) => {
  for (const update of updates) {
    if (update.id) {
      groupCache.del(update.id); // 🔥 invalidate cache
      console.log(`♻️ Group cache refreshed: ${update.id}`);
    }
  }
});


    sock.ev.on('group-participants.update', async (update) => {
      //console.log('group participants update:', update);
      // Handle group participant updates (welcome, goodbye, etc.)
      try {
        const handleGroupParticipantsUpdate = require('./handler/features/welcome');
        await handleGroupParticipantsUpdate(sock, update, groupCache);
      } catch (err) {
        console.error('Error in welcome handler:', err);
      }
    });

    // Send online message to owner
    // if (restartType === 'manual') {
    //   await sendRestartMessage(sock, phoneNumber, { type: 'initial', additionalInfo: `Bot started successfully on ${phoneNumber}.` });
    // }

  } catch (err) {
    console.error('❌ Failed to start bot:', err.message);
    process.exit(1);
  }
}

async function getGroupMetadataCached(sock, groupId, cache) {
  const cached = cache.get(groupId);
  if (cached) return cached;

  const metadata = await sock.groupMetadata(groupId);
  cache.set(groupId, metadata);
  return metadata;
}


/* ─────────── STOP BOT ─────────── */

async function stopBot(saveSession = true) {
  try {
    restarting = true;
    
    // Clear connection timeout if exists
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
      console.log(' Connection timeout cleared');
    }
    
    // Check if this is a PM2 restart and save state
    if (process.env.pm_id && sock && phoneNumber) {
      console.log('PM2 restart detected - saving restart state');
      await saveRestartState({
        type: 'pm2',
        source: 'pm2_restart',
        additionalInfo: 'PM2 process manager restart',
        phoneNumber: phoneNumber || null,
        timestamp: Date.now()
      });
      
      // Set pending notification for PM2 restart
      await setPendingRestartNotification({
        jid: phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`,
        type: 'pm2',
        additionalInfo: 'PM2 process manager has restarted the bot.'
      });
    }
    
    if (sock) {
      // Save session before stopping if requested
      if (saveSession && sock.authState && sock.authState.saveCreds) {
        try {
          console.log('💾 Saving session before stopping...');
          await sock.authState.saveCreds();
          console.log('✅ Session saved successfully');
        } catch (saveError) {
          console.error('❌ Failed to save session before stopping:', saveError.message);
        }
      } else if (saveSession) {
        console.log('⚠️  Cannot save session: authState or saveCreds not available');
      }
      
      sock.ev.removeAllListeners();
      sock.ws?.close();
      sock = null;
    }
    console.log('🛑 Bot stopped');
  } catch (err) {
    console.error('❌ Stop error:', err.message);
  }
}

/* ─────────── SYSTEM ONLINE MESSAGE ─────────── */

async function sendSystemOnlineMessage() {
  try {
    if (!sock?.user) return;

    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    await sock.sendMessage(botJid, {
      text: `🖥️ [SYSTEM ONLINE]\n> STATUS: OPERATIONAL\n> MODE: STABLE\n> UPTIME: RESET`
    });
    await sendRestartMessage(sock, botJid, { type: 'initial', additionalInfo: `Bot started successfully on ${botJid}.` });
  } catch (err) {
    console.error('❌ Failed to send system online message:', err.message);
  }
}

/* ─────────── REGISTER LIFECYCLE ─────────── */

registerLifecycle({
  startBot,
  stopBot
});

/* ─────────── EXPORTS ─────────── */

module.exports = {
  startBot,
  stopBot,
  getGroupMetadataCached
};

/* ─────────── START BOT ─────────── */

// Only start the bot if this file is run directly
if (require.main === module) {
  startBot();
}