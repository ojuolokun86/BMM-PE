const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { Mutex } = require('async-mutex');
const { getBaileys } = require('../utils/baileys');


const dbPath = path.join(__dirname, 'sessions.db');
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, '');

const db = new Database(dbPath);
const mutex = new Mutex();

/* ───────── MIGRATE TABLE ───────── */

// Check columns
const oldCols = db.prepare(`PRAGMA table_info(sessions)`).all();
const columns = oldCols.map(c => c.name);

// We want: auth_id, phone_number, creds, keys, created_at, updated_at
const keepCols = ['auth_id', 'phone_number', 'creds', 'keys', 'created_at', 'updated_at'];
const dropCols = columns.filter(c => !keepCols.includes(c));
const expectedCols = ['auth_id','phone_number','creds','keys','created_at','updated_at'];
const needsMigration = !expectedCols.every(c => oldCols.some(oc => oc.name === c));

if (needsMigration) {
    console.log('🛠 Migrating session table...');
    // migration SQL here
}

if (dropCols.length > 0) {
  console.log('🛠 Removing unwanted columns:', dropCols.join(', '));
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions_new (
      auth_id TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      creds TEXT NOT NULL,
      keys TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (auth_id, phone_number)
    );

    INSERT INTO sessions_new (auth_id, phone_number, creds, keys, created_at, updated_at)
    SELECT auth_id, phone_number, creds, keys, created_at, updated_at
    FROM sessions;

    DROP TABLE sessions;
    ALTER TABLE sessions_new RENAME TO sessions;
  `);
}

// Ensure table exists (first install)
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    auth_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    creds TEXT NOT NULL,
    keys TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (auth_id, phone_number)
  );
`);

/* ───────── INTERNAL ───────── */

async function loadSession(authId, phoneNumber) {
  const baileys = await getBaileys();
  const BufferJSON = baileys.BufferJSON || baileys.default?.BufferJSON || {
    reviver: (_, v) => v
  };
  const row = db.prepare(`
    SELECT creds, keys FROM sessions
    WHERE auth_id = ? AND phone_number = ?
  `).get(authId, phoneNumber);

  if (!row) return null;

  return {
    creds: JSON.parse(row.creds, BufferJSON.reviver),
    keys: JSON.parse(row.keys, BufferJSON.reviver)
  };
}

async function saveSession(authId, phoneNumber, creds, keys) {
  const baileys = await getBaileys();
  const BufferJSON = baileys.BufferJSON || baileys.default?.BufferJSON || {
    replacer: (_, v) => v
  };
  db.prepare(`
    INSERT INTO sessions (auth_id, phone_number, creds, keys, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(auth_id, phone_number) DO UPDATE SET
      creds = excluded.creds,
      keys = excluded.keys,
      updated_at = excluded.updated_at
  `).run(
    authId,
    phoneNumber,
    JSON.stringify(creds, BufferJSON.replacer),
    JSON.stringify(keys, BufferJSON.replacer)
  );
}

/* ───────── MAIN AUTH ───────── */

async function useSQLiteAuthState(authId, phoneNumber) {
  const baileys = await getBaileys();

  const {
    initAuthCreds,
    proto,
  } = baileys;
  const BufferJSON =
  baileys.BufferJSON ||
  baileys.default?.BufferJSON ||  
  {
    replacer: (_, v) => v,
    reviver: (_, v) => v
  };
  let session = await loadSession(authId, phoneNumber);

  if (!session) {
    session = { creds: initAuthCreds(), keys: {} };
    await saveSession(authId, phoneNumber, session.creds, session.keys);
  }

  const { creds, keys } = session;

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = keys[type]?.[id] ?? null;
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }
          return data;
        },

        set: async (data) => {
          await mutex.runExclusive(() => {
            for (const category in data) {
              if (!keys[category]) keys[category] = {};
              for (const id in data[category]) {
                const value = data[category][id];
                if (value) keys[category][id] = value;
                else delete keys[category][id];
              }
            }
            saveSession(authId, phoneNumber, creds, keys);
          });
        }
      }
    },

    saveCreds: async () => {
      await mutex.runExclusive(async () => {
        await saveSession(authId, phoneNumber, creds, keys);
      });
    }
  };
}

/* ───────── UTILITIES ───────── */

function deleteSession(authId, phoneNumber) {
  db.prepare(`DELETE FROM sessions WHERE auth_id = ? AND phone_number = ?`).run(authId, phoneNumber);
}

function getAllSessions() {
  return db.prepare(`SELECT DISTINCT phone_number FROM sessions`).all().map(r => r.phone_number);
}

function deleteAllSessions() {
  db.prepare(`DELETE FROM sessions`).run();
}

module.exports = {
  useSQLiteAuthState,
  deleteSession,
  getAllSessions,
  deleteAllSessions
};
