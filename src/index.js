//require('dotenv').config();
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const qr = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const { useSQLiteAuthState, getAllSessions, deleteSession } = require('./database/sqliteAuthState');
const handleIncomingMessage  = require('./handler/messageHandler');
const NodeCache = require('node-cache');

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }
  }
});

function askUserChoice() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n🔐 Choose authentication method:');
    console.log('1️⃣  QR Code (Scan with WhatsApp)');
    console.log('2️⃣  Pairing Code (Enter 6-digit code)');
    console.log('');

    rl.question('Enter your choice (1 or 2): ', (answer) => {
      rl.close();
      const choice = answer.trim();
      if (choice === '1' || choice === '2') {
        resolve(choice === '1' ? 'qrCode' : 'pairingCode');
      } else {
        console.log('❌ Invalid choice. Defaulting to QR Code.');
        resolve('qrCode');
      }
    });
  });
}

function askPhoneNumber() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('');
    rl.question('📱 Enter your WhatsApp phone number (with country code, e.g., 1234567890): ', (answer) => {
      rl.close();
      const phoneNumber = answer.trim();
      if (phoneNumber) {
        resolve(phoneNumber);
      } else {
        console.log('❌ Invalid phone number. Please try again.');
        resolve(askPhoneNumber());
      }
    });
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error(' Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error(' Uncaught Exception:', err);
});

async function startBot() {
  let pairingMethod = null;
  let phoneNumber = null;
  let authState = null;
  const authId = '123456';
  const groupCache = new NodeCache({ stdTTL: 60 * 60, useClone: false });
  
  // Check for existing SQLite sessions
  const existingSessions = getAllSessions();
  
  if (existingSessions.length > 0) {
    // Use existing session
    phoneNumber = existingSessions[0];
    pairingMethod = 'pairingCode';
    console.log(`\n📱 Loading existing session for: ${phoneNumber}`);
    authState = await useSQLiteAuthState(authId, phoneNumber);
  } else {
    // No existing session, prompt for new registration
    pairingMethod = await askUserChoice();
    
    if (pairingMethod === 'pairingCode') {
      phoneNumber = await askPhoneNumber();
      authState = await useSQLiteAuthState(authId, phoneNumber);
    } else {
      phoneNumber = await askPhoneNumber();
      authState = await useSQLiteAuthState(authId, phoneNumber);
    }
  }

  const { state, saveCreds } = authState;
  
  let qrCodeRequested = false;
  let pairingCodeRequested = false;
  
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    downloadHistory: false,
    receivedPendingNotifications: true,
    groupMetadataCache: async (key) => {
        return groupCache.get(key);
      },
    groupMetadataCacheSet: async (key, value) => {
        groupCache.set(key, value);
      },
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr: qrCode } = update;
    
    if (connection === 'close') {
      // Get error details with better error handling
      const error = lastDisconnect?.error;
      const statusCode = error?.output?.statusCode || error?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      
      // Get reason with fallbacks
      let reason = 'Unknown reason';
      if (error?.output?.reason) reason = error.output.reason;
      else if (error?.message) reason = error.message;
      else if (error?.status) reason = `Status ${error.status}`;
      
      console.log('\n⚠️ Connection closed with reason:', reason);
      console.log('Error details:', JSON.stringify(error, null, 2));
      
      if (isLoggedOut) {
        console.log('\n🚫 Logged out. Cleaning session from database...');
        deleteSession(authId, phoneNumber);
        console.log('✅ Session cleaned. Please restart the bot to reconnect.');
        process.exit(0);
      } else {
        console.log('\n🔄 Attempting to reconnect in 3 seconds...');
        setTimeout(() => {
          console.log('\n🔄 Reconnecting...');
          startBot().catch(err => {
            console.error('❌ Failed to restart bot:', err);
            process.exit(1);
          });
        }, 3000);
      }
    } else if (connection === 'open') {
      console.log('✅ Bot connected successfully!');
      qrCodeRequested = false;
      pairingCodeRequested = false;
    }

    // 📱 QR Code Logic
    if (pairingMethod === 'qrCode' && qrCode && !qrCodeRequested) {
      qrCodeRequested = true;
      console.log('\n📱 QR Code received. Scan with WhatsApp:');
      qr.generate(qrCode, { small: true });
    }

    // 🔐 Pairing Code Logic
    if (pairingMethod === 'pairingCode' && qrCode && !pairingCodeRequested && phoneNumber) {
      pairingCodeRequested = true;
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        const formattedCode = code.match(/.{1,4}/g).join('-');
        console.log('\n🔐 Your pairing code:', formattedCode);
        console.log('📋 Enter this code in WhatsApp to complete pairing.');
      } catch (err) {
        console.error('❌ Failed to get pairing code:', err.message);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    
    if (!msg.message) return;
    
    handleIncomingMessage({authId, sock, msg, phoneNumber });
  });
}

startBot().catch(err => {
  console.error(' Error starting bot:', err);
  process.exit(1);
});
