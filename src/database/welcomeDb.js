const { db } = require('./database');

function getWelcomeSettings(groupId, botId) {
  const row = db.prepare(`SELECT welcome_enabled, goodbye_enabled FROM welcome_settings WHERE group_id = ? AND bot_id = ?`).get(groupId, botId);
  return {
    welcome: row?.welcome_enabled === 1,
    goodbye: row?.goodbye_enabled === 1
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

module.exports = {
  getWelcomeSettings,
  setWelcomeEnabled,
  setGoodbyeEnabled,
};