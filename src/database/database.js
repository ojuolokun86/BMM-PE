const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'sessions.db');
const db = new Database(dbPath);

// 🔐 Users Table
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    user_lid TEXT,
    user_name TEXT,
    auth_id TEXT,
    mode TEXT DEFAULT 'private',
    prefix TEXT DEFAULT '.',
    status_view_mode INTEGER DEFAULT 0, -- 0: default, 1: compact, 2: detailed
    react_to_command INTEGER DEFAULT 0, -- 0: off, 1: on
    followed_teams TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// 🛡️ Antilink Settings Table
db.prepare(`
  CREATE TABLE IF NOT EXISTS antilink_settings (
    group_id TEXT,
    bot_id TEXT,
    mode TEXT DEFAULT 'off',
    warn_limit INTEGER DEFAULT 2,
    bypass_admins INTEGER DEFAULT 1,
    PRIMARY KEY (group_id, bot_id)
  )
`).run();


db.prepare(`
  CREATE TABLE IF NOT EXISTS antidelete_settings (
    user_id TEXT PRIMARY KEY,
    mode TEXT DEFAULT 'off',
    forward_to_dm INTEGER DEFAULT 0
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS antidelete_excludes (
    user_id TEXT,
    group_id TEXT,
    PRIMARY KEY (user_id, group_id)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS welcome_settings (
    group_id TEXT,
    bot_id TEXT,
    welcome_enabled INTEGER DEFAULT 0,
    goodbye_enabled INTEGER DEFAULT 0,
    PRIMARY KEY (group_id, bot_id)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS bot_activity (
    user TEXT,
    bot TEXT,
    action TEXT,
    time INTEGER
  )
`).run();

function recordBotActivity({ user, bot, action }) {
  if (!user || !bot || !action) {
    throw new Error('Missing required parameters for recordBotActivity');
}
  db.prepare(
      'INSERT INTO bot_activity (user, bot, action, time) VALUES (?, ?, ?, ?)'
  ).run(user, bot, action, Date.now());
}

// In database.js or migration setup
try {
  db.prepare("ALTER TABLE antilink_warns ADD COLUMN reasons TEXT").run();
} catch (e) {
  // Ignore if already exists
}
try{
  db.prepare("ALTER TABLE users ADD COLUMN status_view_mode INTEGER DEFAULT 0;").run();
} catch (e) {}

 try {
  db.prepare("ALTER TABLE antidelete_settings ADD COLUMN forward_to_dm INTEGER DEFAULT 0;").run();
} catch (e) {
  // Ignore if already exists
 }
// 🧩 Auto-migrate missing columns
try {
  db.prepare("ALTER TABLE users ADD COLUMN prefix TEXT DEFAULT '.'").run();
} catch (e) {} // Ignore if already exists

try {
  db.prepare("ALTER TABLE users ADD COLUMN followed_teams TEXT DEFAULT '[]'").run();
} catch (e) {} // Ignore if already exists

try {
  db.prepare("ALTER TABLE antilink_settings ADD COLUMN bypass_admins INTEGER DEFAULT 1").run();
} catch (e) {} // Ignore if already exists

try {
  db.prepare("ALTER TABLE users ADD COLUMN react_to_command INTEGER DEFAULT 0;").run();
} catch (e) {}
// 🔧 User Management Functions
function saveUserToDb({ user_id, user_lid, user_name, auth_id, mode = 'private', prefix = '.', status_view_mode = 0 }) {
  db.prepare(
    `INSERT OR IGNORE INTO users (user_id, user_lid, user_name, auth_id, mode, prefix, status_view_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(user_id, user_lid, user_name, auth_id, mode, prefix, status_view_mode);
}

function getUserPrefix(user_id) {
  const row = db.prepare(`SELECT prefix FROM users WHERE user_id = ?`).get(user_id);
  return row?.prefix || '.';
}
function getUserStatusViewMode(user_id) {
  try {
    // First check if user exists
    const userExists = db.prepare('SELECT 1 FROM users WHERE user_id = ?').get(user_id);
    
    if (!userExists) {
      // If user doesn't exist, create with default status_view_mode of 0
      db.prepare(
        `INSERT OR IGNORE INTO users (user_id, status_view_mode) VALUES (?, 0)`
      ).run(user_id);
      return 0;
    }
    
    // Get the status_view_mode for existing user
    const row = db.prepare(`SELECT status_view_mode FROM users WHERE user_id = ?`).get(user_id);
    
    // Ensure we return a number (0, 1, or 2)
    const mode = parseInt(row?.status_view_mode, 10);
    return isNaN(mode) || mode < 0 || mode > 2 ? 0 : mode;
  } catch (error) {
    console.error('Error in getUserStatusViewMode:', error);
    return 0; // Default to 0 (Silent Mode) on error
  }
}

function setUserStatusViewMode(user_id, mode) {
  // First, ensure the user exists
  const userExists = db.prepare('SELECT 1 FROM users WHERE user_id = ?').get(user_id);
  
  if (userExists) {
    // Update existing user
    db.prepare(`UPDATE users SET status_view_mode = ? WHERE user_id = ?`).run(mode, user_id);
  } else {
    // If user doesn't exist, create with default values
    db.prepare(
      `INSERT INTO users (user_id, status_view_mode) VALUES (?, ?)`
    ).run(user_id, mode);
  }
  
  // Verify the update was successful
  const updated = db.prepare('SELECT status_view_mode FROM users WHERE user_id = ?').get(user_id);
  if (!updated || updated.status_view_mode !== mode) {
    console.error(`Failed to update status_view_mode for user ${user_id}`);
    return false;
  }
  return true;
}

function setUserPrefix(user_id, prefix) {
  db.prepare(`UPDATE users SET prefix = ? WHERE user_id = ?`).run(prefix, user_id);
}

function getUserMode(user_id) {
  const row = db.prepare(`SELECT mode FROM users WHERE user_id = ?`).get(user_id);
  return row?.mode || 'private';
}
function followedTeams(user_id) {
  try {
    const row = db.prepare(`SELECT followed_teams FROM users WHERE user_id = ?`).get(user_id);
    const teams = JSON.parse(row?.followed_teams || '[]');
    return Array.isArray(teams) ? teams : [];
  } catch (error) {
    console.error('Error getting followed teams:', error);
    return [];
  }
}

function addFollowedTeam(user_id, team) {
  try {
    const currentTeams = followedTeams(user_id);
    if (currentTeams.some(t => t.id === team.id)) {
      return false; // Already following
    }
    const updatedTeams = [...currentTeams, {
      id: team.id,
      name: team.name,
      followedAt: new Date().toISOString()
    }];
    db.prepare(`UPDATE users SET followed_teams = ? WHERE user_id = ?`)
      .run(JSON.stringify(updatedTeams), user_id);
    return true;
  } catch (error) {
    console.error('Error adding followed team:', error);
    return false;
  }
}

function removeFollowedTeam(user_id, teamId) {
  try {
    const currentTeams = followedTeams(user_id);
    const initialLength = currentTeams.length;
    const updatedTeams = currentTeams.filter(team => team.id !== teamId);
    if (updatedTeams.length === initialLength) {
      return false;
    }
    db.prepare(`UPDATE users SET followed_teams = ? WHERE user_id = ?`)
      .run(JSON.stringify(updatedTeams), user_id);
    return true;
  } catch (error) {
    console.error('Error removing followed team:', error);
    return false;
  }
}

function isFollowingTeam(user_id, teamId) {
  try {
    const teams = followedTeams(user_id);
    return teams.some(team => team.id === teamId);
  } catch (error) {
    console.error('Error checking if following team:', error);
    return false;
  }
}

function setUserMode(user_id, mode) {
  db.prepare(`UPDATE users SET mode = ? WHERE user_id = ?`).run(mode, user_id);
}

function userExists(user_id) {
  return !!db.prepare(`SELECT 1 FROM users WHERE user_id = ?`).get(user_id);
}

function getBotOwnerByPhone(phoneNumber) {
  const row = db.prepare(`SELECT user_id FROM users WHERE user_id = ?`).get(phoneNumber);
  return row?.user_id || null;
}

function deleteUser(authId, phoneNumber) {
  db.prepare(`DELETE FROM users WHERE auth_id = ? AND user_id = ?`).run(authId, phoneNumber);
}

function isBotOwner(senderId, senderLid, botId, botLid) {
  return (
    senderId === botId ||
    senderId === botLid ||
    (senderLid && (senderLid === botId || senderLid === botLid))
  );
}

function getReactToCommand(user_id) {
  const row = db.prepare(`SELECT react_to_command FROM users WHERE user_id = ?`).get(user_id);
  return row?.react_to_command === 1;
}
function setReactToCommand(user_id, enabled) {
  db.prepare(`UPDATE users SET react_to_command = ? WHERE user_id = ?`).run(enabled ? 1 : 0, user_id);
}

function recordBotActivity({ user, bot, action }) {
  if (!user || !bot || !action) {
    throw new Error('Missing required parameters for recordBotActivity');
  }
  db.prepare(
    'INSERT INTO bot_activity (user, bot, action, time) VALUES (?, ?, ?, ?)'
  ).run(user, bot, action, Date.now());
}

// Update adventure games table to use only playerId
db.prepare(`
  DROP TABLE IF EXISTS adventure_games
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS adventure_games (
    player_id TEXT PRIMARY KEY,
    game_state TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Update helper functions to use only playerId
function saveGameState(playerId, gameState) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO adventure_games (player_id, game_state, last_updated)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `);
  stmt.run(playerId, JSON.stringify(gameState));
}

function loadGameState(playerId) {
  const row = db.prepare(`
    SELECT game_state FROM adventure_games WHERE player_id = ?
  `).get(playerId);
  return row ? JSON.parse(row.game_state) : null;
}

function deleteGameState(playerId) {
  db.prepare(`DELETE FROM adventure_games WHERE player_id = ?`).run(playerId);
}

module.exports = {
  // Database instance
  db,
  
  // User management
  saveUserToDb,
  userExists,
  setUserMode,
  getUserMode,
  getUserPrefix,
  setUserPrefix,
  getUserStatusViewMode,
  setUserStatusViewMode,
  deleteUser,
  getBotOwnerByPhone,
  isBotOwner,
  getReactToCommand,
  setReactToCommand,
  recordBotActivity,
  followedTeams,
  addFollowedTeam,
  removeFollowedTeam,
  isFollowingTeam,
  // Game state management
  saveGameState,
  loadGameState,
  deleteGameState
};
