// src/cli.js
const { startBmmBot } = require('./main/main');
const inquirer = require('inquirer');
const { v4: uuidv4 } = require('uuid');
const { useSQLiteAuthState } = require('./database/sqliteAuthState');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

async function startCLI() {
  console.log('🚀 Starting BMM Bot in CLI mode...\n');
  
  // Generate a unique authId if not provided
  const authId = 'cli-user-' + uuidv4();
  
  // Prompt for phone number
  const { phoneNumber } = await inquirer.prompt([{
    type: 'input',
    name: 'phoneNumber',
    message: 'Enter phone number (with country code, e.g. 1234567890):',
    validate: input => input && input.length >= 10 ? true : 'Please enter a valid phone number'
  }]);

  // Ask for authentication method
  const { authMethod } = await inquirer.prompt([{
    type: 'list',
    name: 'authMethod',
    message: 'Choose authentication method:',
    choices: [
      { name: 'QR Code (Recommended)', value: 'qrCode' },
      { name: 'Pairing Code', value: 'pairingCode' }
    ],
    default: 'qrCode'
  }]);

  console.log('\n🔍 Checking for existing session...');

  // Check if session exists
  const { state } = await useSQLiteAuthState(authId, phoneNumber);
  const hasSession = state.creds.me?.id || state.creds.registered;

  if (hasSession) {
    console.log('✅ Found existing session. Connecting...');
    startBot();
  } else {
    console.log('ℹ️ No existing session found. You will need to authenticate.');
    startBot();
  }

  function startBot() {
    startBmmBot({
      authId,
      phoneNumber,
      country: 'US',
      pairingMethod: authMethod,
      onStatus: (status) => {
        console.log(`Status: ${status}`);
      },
      onQr: (qr) => {
        if (authMethod === 'qrCode') {
          console.log('\n📡 Scan this QR code with your phone:');
          qrcode.generate(qr, { small: true });
        }
      },
      onPairingCode: (code) => {
        if (authMethod === 'pairingCode') {
          console.log('\n🔢 Pairing code:', code);
        }
      }
    });
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the CLI
startCLI().catch(console.error);