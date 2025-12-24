const { db } = require('./database');

// Initialize tables
db.prepare(`
  CREATE TABLE IF NOT EXISTS warns (
    group_id TEXT,
    bot_id TEXT,
    user_jid TEXT,
    warn_count INTEGER DEFAULT 0,
    reason TEXT DEFAULT NULL,
    type TEXT DEFAULT 'manual', -- 'manual' or 'antilink'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, bot_id, user_jid)
  )
`).run();

// 🔍 Get antilink settings
function getAntilinkSettings(groupId, botId) {
  const row = db.prepare(`
    SELECT mode, warn_limit, bypass_admins
    FROM antilink_settings
    WHERE group_id = ? AND bot_id = ?
  `).get(groupId, botId);

  return {
    mode: row?.mode || 'off',
    warnLimit: row?.warn_limit || 2,
    bypassAdmins: row?.bypass_admins === 1
  };
}

// 💾 Set or update antilink settings
function setAntilinkSettings(groupId, botId, updates = {}) {
  const existing = db.prepare(`
    SELECT mode, warn_limit, bypass_admins FROM antilink_settings WHERE group_id = ? AND bot_id = ?
  `).get(groupId, botId);

  // Use existing values if not provided in updates
  const mode = typeof updates.mode !== 'undefined' ? updates.mode : existing?.mode || 'off';
  const warnLimit = typeof updates.warnLimit !== 'undefined' ? Number(updates.warnLimit) : existing?.warn_limit || 2;
  const bypass = typeof updates.bypassAdmins !== 'undefined'
    ? (updates.bypassAdmins ? 1 : 0)
    : typeof existing?.bypass_admins !== 'undefined'
      ? existing.bypass_admins
      : 1;

  if (existing) {
    db.prepare(`UPDATE antilink_settings SET mode = ?, warn_limit = ?, bypass_admins = ? WHERE group_id = ? AND bot_id = ?`)
      .run(mode, warnLimit, bypass, groupId, botId);
  } else {
    db.prepare(`INSERT INTO antilink_settings (group_id, bot_id, mode, warn_limit, bypass_admins) VALUES (?, ?, ?, ?, ?)`)
      .run(groupId, botId, mode, warnLimit, bypass);
  }
}

// 🚨 Increase warn
function incrementWarn(groupId, botId, userJid, reason = '', warnType = 'manual') {
  const stmt = db.prepare(`
    INSERT INTO warns (group_id, bot_id, user_jid, warn_count, reason, type)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(group_id, bot_id, user_jid) 
    DO UPDATE SET 
      warn_count = warn_count + 1,
      reason = CASE 
        WHEN reason IS NULL OR reason = '' THEN ?
        ELSE reason || ' | ' || ?
      END,
      type = ?,
      timestamp = CURRENT_TIMESTAMP
    RETURNING warn_count
  `);

  const prefix = warnType === 'antilink' ? '[ANTILINK] ' : '';
  const finalReason = prefix + (reason || 'No reason specified');

  const result = stmt.get(
    groupId, 
    botId, 
    userJid, 
    finalReason,
    warnType,
    finalReason,
    finalReason,
    warnType
  );
  return result.warn_count;
}

// 🔄 Reset warning
function resetWarn(groupId, botId, userJid) {
  db.prepare(`DELETE FROM warns WHERE group_id = ? AND bot_id = ? AND user_jid = ?`)
    .run(groupId, botId, userJid);
}

// ❌ Delete all user data
function deleteAllAntilinkSettings(botId) {
  db.prepare(`DELETE FROM antilink_settings WHERE bot_id = ?`).run(botId);
  db.prepare(`DELETE FROM warns WHERE bot_id = ?`).run(botId);
}

// ❌ Optional: delete group-specific settings
function deleteAntilinkGroup(botId, groupId) {
  db.prepare(`DELETE FROM antilink_settings WHERE group_id = ? AND bot_id = ?`).run(groupId, botId);
  db.prepare(`DELETE FROM warns WHERE group_id = ? AND bot_id = ?`).run(groupId, botId);
}

module.exports = {
  getAntilinkSettings,
  setAntilinkSettings,
  incrementWarn,
  resetWarn,
  deleteAllAntilinkSettings,
  deleteAntilinkGroup
};
