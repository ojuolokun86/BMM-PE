const { db } = require('./database');

// Function to get greet settings
function getGreetSettings(groupId, botId) {
  const stmt = db.prepare(`
    SELECT greet_enabled, welcome_enabled 
    FROM welcome_settings 
    WHERE group_id = ? AND bot_id = ?
  `);
  
  const result = stmt.get(groupId, botId);
  return {
    greet: result?.greet_enabled === 1,
    welcome: result?.welcome_enabled === 1
  };
}

// Function to set greet enabled/disabled
function setGreetEnabled(groupId, botId, enabled) {
  const stmt = db.prepare(`
    UPDATE welcome_settings 
    SET greet_enabled = ? 
    WHERE group_id = ? AND bot_id = ?
  `);
  
  stmt.run(enabled ? 1 : 0, groupId, botId);
}

function getWelcomeSettings(groupId, botId) {
  const stmt = db.prepare(`
    SELECT welcome_enabled, goodbye_enabled, show_fame, greet_enabled
    FROM welcome_settings 
    WHERE group_id = ? AND bot_id = ?
  `);
  
  const result = stmt.get(groupId, botId);
  return {
    welcome: result?.welcome_enabled === 1,
    goodbye: result?.goodbye_enabled === 1,
    showFame: result?.show_fame === 1,
    greet: result?.greet_enabled === 1
  };
}

// Set welcome
function setWelcomeEnabled(groupId, botId, enabled) {
  const row = db.prepare(`SELECT 1 FROM welcome_settings WHERE group_id = ? AND bot_id = ?`).get(groupId, botId);
  if (row) {
    db.prepare(`UPDATE welcome_settings SET welcome_enabled = ? WHERE group_id = ? AND bot_id = ?`).run(enabled ? 1 : 0, groupId, botId);
  } else {
    db.prepare(`INSERT INTO welcome_settings (group_id, bot_id, welcome_enabled) VALUES (?, ?, ?)`).run(groupId, botId, enabled ? 1 : 0);
  }
}

// Set goodbye
function setGoodbyeEnabled(groupId, botId, enabled) {
  const row = db.prepare(`SELECT 1 FROM welcome_settings WHERE group_id = ? AND bot_id = ?`).get(groupId, botId);
  if (row) {
    db.prepare(`UPDATE welcome_settings SET goodbye_enabled = ? WHERE group_id = ? AND bot_id = ?`).run(enabled ? 1 : 0, groupId, botId);
  } else {
    db.prepare(`INSERT INTO welcome_settings (group_id, bot_id, goodbye_enabled) VALUES (?, ?, ?)`).run(groupId, botId, enabled ? 1 : 0);
  }
}

// Set show fame
function setShowFameEnabled(groupId, botId, enabled) {
  const row = db.prepare(`SELECT 1 FROM welcome_settings WHERE group_id = ? AND bot_id = ?`).get(groupId, botId);
  if (row) {
    db.prepare(`UPDATE welcome_settings SET show_fame = ? WHERE group_id = ? AND bot_id = ?`).run(enabled ? 1 : 0, groupId, botId);
  } else {
    db.prepare(`INSERT INTO welcome_settings (group_id, bot_id, show_fame) VALUES (?, ?, ?)`).run(groupId, botId, enabled ? 1 : 0);
  }
}

module.exports = {
  getGreetSettings,
  getWelcomeSettings,
  setWelcomeEnabled,
  setGoodbyeEnabled,
  setShowFameEnabled,
  setGreetEnabled,
};