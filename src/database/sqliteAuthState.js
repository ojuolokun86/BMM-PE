const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { initAuthCreds, makeCacheableSignalKeyStore, BufferJSON } = require('@whiskeysockets/baileys');

const dbPath = path.join(__dirname, 'sessions.db');
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, '');

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    auth_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    status TEXT NOT NULL,
    creds TEXT NOT NULL,
    keys TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (auth_id, phone_number)
  )
`);

// Buffer-safe stringify
function encodeKeys(keys) {
  const encoded = {};
  for (const category in keys) {
    encoded[category] = {};
    for (const id in keys[category]) {
      encoded[category][id] = JSON.stringify(keys[category][id], BufferJSON.replacer);
    }
  }
  return encoded;
}

// Buffer-safe parse
function decodeKeys(encoded) {
  const parsed = {};
  for (const category in encoded) {
    parsed[category] = {};
    for (const id in encoded[category]) {
      parsed[category][id] = JSON.parse(encoded[category][id], BufferJSON.reviver);
    }
  }
  return parsed;
}

// Load session from DB
function loadSession(authId, phoneNumber) {
  const row = db.prepare(`
    SELECT creds, keys FROM sessions
    WHERE auth_id = ? AND phone_number = ?
  `).get(authId, phoneNumber);

  if (!row) return null;

  return {
    creds: JSON.parse(row.creds, BufferJSON.reviver),
    keys: decodeKeys(JSON.parse(row.keys)),
    status: row.status,

  };
}

// Save session to DB
function saveSession(authId, phoneNumber, status, creds, keys) {
  db.prepare(`
    INSERT INTO sessions (auth_id, phone_number, status, creds, keys)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(auth_id, phone_number)
    DO UPDATE SET creds = excluded.creds, keys = excluded.keys, updated_at = CURRENT_TIMESTAMP
  `).run(
    authId,
    phoneNumber,
    status,
    JSON.stringify(creds, BufferJSON.replacer),
    JSON.stringify(encodeKeys(keys))
  );
}
try{
  db.prepare(`
    ALTER TABLE sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  `).run();
} catch (e) {
  // Ignore if already exists
}  

// Main function used in Baileys
async function useSQLiteAuthState(authId, phoneNumber) {
  let session = loadSession(authId, phoneNumber);

  if (!session) {
    session = {
      creds: initAuthCreds(),
      keys: {},
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  const { creds, keys } = session;

  const keyStore = makeCacheableSignalKeyStore({
    get: async (type, ids) => {
      const result = {};
      for (const id of ids) {
        if (keys[type] && keys[type][id]) {
          result[id] = keys[type][id];
        }
      }
      return result;
    },
    set: async (data) => {
  for (const category in data) {
    if (!keys[category]) keys[category] = {};
    for (const id in data[category]) {
      keys[category][id] = data[category][id];
    }
  }
  saveSession(authId, phoneNumber, 'active', creds, keys);
    }
  });

  return {
    state: {
      creds,
      keys: keyStore
    },
    saveCreds: async () => {
      saveSession(authId, phoneNumber, 'active', creds, keys);
    }
  };
}

// Delete session
function deleteSession(authId, phoneNumber) {
  db.prepare(`DELETE FROM sessions WHERE auth_id = ? AND phone_number = ?`).run(authId, phoneNumber);
}

function deleteAllSessions() {
  db.prepare('DELETE FROM sessions').run();
}

// Get all sessions from the database
function getAllSessions() {
  try {
    const rows = db.prepare('SELECT DISTINCT phone_number FROM sessions').all();
    return rows.map(row => row.phone_number);
  } catch (error) {
    console.error('Error getting all sessions:', error);
    return [];
  }
}


module.exports = { 
  useSQLiteAuthState, 
  deleteSession, 
  deleteAllSessions, 
  getAllSessions
};
