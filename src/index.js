/**
 * index.js
 * Main entry point for the WhatsApp bot
 * --------------------------------------
 */
require("./console-style.js");
const readline = require('readline');
const { default: makeWASocket, DisconnectReason, Browsers, jidDecode, fetchLatestBaileysVersion, WAVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const NodeCache = require('node-cache');
const qrTerminal = require('qrcode-terminal');
const store = require('./utils/store');

const { botStartTimes } = require('./utils/globalStore');

// Restart system
const { restartBot, registerLifecycle, sendRestartMessage, detectRestartSource, consumePendingRestartNotification } = require('./main/restart');

// SQLite auth
const { useSQLiteAuthState, getAllSessions, deleteSession } = require('./database/sqliteAuthState');

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

// Memory monitoring - Restart if RAM gets too high
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 300) {
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

async function startBot({ restartType = 'manual', source = restartSource } = {}) {
 const { version } = await fetchLatestBaileysVersion()
  await bootSequence();

  try {
    const authId = '123456';
    
  console.log(version)
    let phoneNumber;
    let pairingMethod;

    const sessions = getAllSessions();

    if (sessions.length) {
      phoneNumber = sessions[0];
      pairingMethod = 'pairingCode';
      console.log(`📱 Loaded session: ${phoneNumber}`);
    } else {
      pairingMethod = await askUserChoice();
      phoneNumber = await askPhoneNumber();
    }

    const { state, saveCreds } = await useSQLiteAuthState(authId, phoneNumber);

    let qrShown = false;
    let pairingRequested = false;
    const msgRetryCounterCache = new NodeCache()
    sock = makeWASocket({
      version: version,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      logger: pino({
          level: "info",
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
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      reconnectIntervalMs: 5000,
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
      if (connection === 'open') {
        console.log('✅ Bot connected');
        const botId = sock?.user?.id?.split(':')[0]?.split('@')[0];
        if (botId && !botStartTimes[botId]) botStartTimes[botId] = Date.now();
        qrShown = false;
        pairingRequested = false;

        // Handle post-connection actions based on restart type
        if (restarting) {
          const restartType = restarting.type || 'manual';
          console.log(`✅ Reconnected after ${restartType} restart`);
          
          // Send appropriate online message based on restart type
          if (restartType === 'crash') {
            await sendRestartMessage(sock, phoneNumber, { 
              type: 'crash',
              additionalInfo: '🔄 System recovered from unexpected termination.'
            });
          } else if (restartType === 'pm2') {
            await sendRestartMessage(sock, phoneNumber, {
              type: 'pm2',
              additionalInfo: '🔄 PM2 process manager has restarted the bot.'
            });
          } else if (restartType === 'login') {
            await sendRestartMessage(sock, phoneNumber, {
              type: 'login',
              additionalInfo: '🔑 New login session established.'
            });
          } else {
            // For manual/command restarts
            await sendSystemOnlineMessage();
          }
          
          restarting = false;
        }

        const pending = consumePendingRestartNotification();
        if (pending?.jid) {
          await sendRestartMessage(sock, pending.jid, {
            type: pending.type || 'manual',
            additionalInfo: pending.additionalInfo || ''
          });
        }

      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;

        console.log('⚠️ Connection closed:', code);

        if (loggedOut) {
          console.log('🚫 Logged out — clearing session');
          deleteSession(authId, phoneNumber);
          process.exit(0);
        }

        if (!restarting) {
          console.log('🔄 Auto-restart triggered');
          const restartType = lastDisconnect?.error?.isTemporary ? 'temporary' : 'crash';
          await restartBot({ 
            type: restartType,
            sock, 
            phoneNumber,
            source: 'connection_close',
            additionalInfo: `🔌 Connection closed with code: ${code}`
          });
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
      if (msg.key && msg.key.remoteJid === 'status@broadcast') return;

      handleIncomingMessage({ authId, sock, msg, phoneNumber });
    });

    sock.ev.on('lid-mapping.update', (update) => {
      console.log('🔁 New LID ↔ PN mapping:', update)
    })

    // Handle incoming calls
    // sock.ev.on('call', async ({ call }) => {
    //   const { handleIncomingCall } = require('./handler/command/call');
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