const { db } = require('./database');
// Get global antidelete mode for a bot
function getAntideleteMode(botId) {
  const row = db.prepare(`SELECT mode FROM antidelete_settings WHERE user_id = ?`).get(botId);
  return row?.mode || 'off';
}

// Set global antidelete mode for a bot
function setAntideleteMode(botId, mode) {
  if (!botId) return;
  const existing = db.prepare(`SELECT 1 FROM antidelete_settings WHERE user_id = ?`).get(botId);
  if (existing) {
    db.prepare(`UPDATE antidelete_settings SET mode = ? WHERE user_id = ?`).run(mode, botId);
  } else {
    db.prepare(`INSERT INTO antidelete_settings (user_id, mode) VALUES (?, ?)`).run(botId, mode);
  }
}

// Exclude a group from antidelete
function excludeGroup(botId, groupId) {
  db.prepare(`INSERT OR IGNORE INTO antidelete_excludes (user_id, group_id) VALUES (?, ?)`).run(botId, groupId);
}

// Include a group back (remove exclusion)
function includeGroup(botId, groupId) {
  db.prepare(`DELETE FROM antidelete_excludes WHERE user_id = ? AND group_id = ?`).run(botId, groupId);
}

// Check if a group is excluded
function isGroupExcluded(botId, groupId) {
  return !!db.prepare(`SELECT 1 FROM antidelete_excludes WHERE user_id = ? AND group_id = ?`).get(botId, groupId);
}

// List all excluded groups for a bot
function getExcludedGroups(botId) {
  return db.prepare(`SELECT group_id FROM antidelete_excludes WHERE user_id = ?`).all(botId).map(r => r.group_id);
}

function deleteAllAntideleteSettings(botId) {
  db.prepare(`DELETE FROM antidelete_settings WHERE user_id = ?`).run(botId);
  db.prepare(`DELETE FROM antidelete_excludes WHERE user_id = ?`).run(botId);
}
const dmForwardMap = new Map();

function shouldForwardToOwner(botId) {
  const row = db.prepare(`SELECT forward_to_dm FROM antidelete_settings WHERE user_id = ?`).get(botId);
  return row?.forward_to_dm === 1;
}

function setForwardToDm(botId, value) {
  const existing = db.prepare(`SELECT 1 FROM antidelete_settings WHERE user_id = ?`).get(botId);
  if (existing) {
    db.prepare(`UPDATE antidelete_settings SET forward_to_dm = ? WHERE user_id = ?`).run(value ? 1 : 0, botId);
  } else {
    db.prepare(`INSERT INTO antidelete_settings (user_id, mode, forward_to_dm) VALUES (?, 'off', ?)`).run(botId, value ? 1 : 0);
  }
}
module.exports = {
  getAntideleteMode,
  setAntideleteMode,
  excludeGroup,
  includeGroup,
  isGroupExcluded,
  getExcludedGroups,
  deleteAllAntideleteSettings,
  setForwardToDm,
  shouldForwardToOwner
};
