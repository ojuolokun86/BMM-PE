// scripts/notifyUpdate.js
const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

// Use absolute path to the project root
const NOTIFICATION_FILE = path.join(process.cwd(), '.update-notification');

// Try to read previous version from src/.last_version
let previousVersion = '';
try {
  const lastVerPath = path.join(__dirname, '../src/.last_version');
  if (fs.existsSync(lastVerPath)) {
    previousVersion = fs.readFileSync(lastVerPath, 'utf8').trim();
  }
} catch {}

// Create a notification file with previousVersion to aid classification
const notification = {
  version,
  previousVersion,
  timestamp: Date.now(),
  message: '🚀 Bot has been updated to the latest version!\n\n> ✨ New Features Added!\n\n> 👉 Use .menu or .help to explore what’s new.'
};

fs.writeFileSync(NOTIFICATION_FILE, JSON.stringify(notification, null, 2));
console.log('📝 Update notification queued:', notification);