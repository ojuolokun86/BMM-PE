const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../../sessions.db');
const db = new Database(dbPath);

// Create allowed_links table if it doesn't exist
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS allowed_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      platform_name TEXT NOT NULL,
      regex_pattern TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, bot_id, platform_name)
    );
  `);
} catch (e) {
  console.error('Error creating allowed_links table:', e);
}

// Get all allowed link patterns for a group
function getAllowedLinks(groupId, botId) {
  const rows = db.prepare(`
    SELECT platform_name, regex_pattern, enabled 
    FROM allowed_links 
    WHERE group_id = ? AND bot_id = ? AND enabled = 1
  `).all(groupId, botId);
  
  return rows.map(row => ({
    platform: row.platform_name,
    regex: new RegExp(row.regex_pattern, 'gi')
  }));
}

// Check if a message contains any allowed links
function hasAllowedLink(message, allowedLinks) {
  if (!allowedLinks || allowedLinks.length === 0) return false;
  
  return allowedLinks.some(link => link.regex.test(message));
}

// Add or update allowed link pattern
function setAllowedLink(groupId, botId, platformName, regexPattern, enabled = true) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO allowed_links (group_id, bot_id, platform_name, regex_pattern, enabled)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  return stmt.run(groupId, botId, platformName, regexPattern, enabled ? 1 : 0);
}

// Toggle allowed link (enable/disable)
function toggleAllowedLink(groupId, botId, platformName) {
  const row = db.prepare(`
    SELECT enabled FROM allowed_links 
    WHERE group_id = ? AND bot_id = ? AND platform_name = ?
  `).get(groupId, botId, platformName);
  
  if (!row) return null;
  
  const newEnabled = row.enabled === 1 ? 0 : 1;
  db.prepare(`
    UPDATE allowed_links SET enabled = ? 
    WHERE group_id = ? AND bot_id = ? AND platform_name = ?
  `).run(newEnabled, groupId, botId, platformName);
  
  return newEnabled === 1;
}

// Remove allowed link pattern
function removeAllowedLink(groupId, botId, platformName) {
  const stmt = db.prepare(`
    DELETE FROM allowed_links 
    WHERE group_id = ? AND bot_id = ? AND platform_name = ?
  `);
  
  return stmt.run(groupId, botId, platformName);
}

// Get all predefined link patterns
function getPredefinedPatterns() {
  return [
    {
      name: 'TikTok',
      pattern: '(https?:\\/\\/)?(www\\.)?(tiktok\\.com|vm\\.tiktok\\.com|vt\\.tiktok\\.com)\\/[^\\s]+',
      description: 'TikTok videos and profiles'
    },
    {
      name: 'Facebook',
      pattern: '(https?:\\/\\/)?(www\\.)?(facebook\\.com|fb\\.com|fb\\.watch|m\\.facebook\\.com)\\/[^\\s]+',
      description: 'Facebook posts, pages, and videos'
    },
    {
      name: 'Instagram',
      pattern: '(https?:\\/\\/)?(www\\.)?(instagram\\.com|instagr\\.am|www\\.instagram\\.com)\\/[^\\s]+',
      description: 'Instagram posts, reels, and profiles'
    },
    {
      name: 'YouTube',
      pattern: '(https?:\\/\\/)?(www\\.)?(youtube\\.com|youtu\\.be|m\\.youtube\\.com|youtube\\.shorts)\\/[^\\s]+',
      description: 'YouTube videos, shorts, and channels'
    },
    {
      name: 'Twitch',
      pattern: '(https?:\\/\\/)?(www\\.)?(twitch\\.tv|go\\.twitch\\.tv|m\\.twitch\\.tv)\\/[^\\s]+',
      description: 'Twitch streams and channels'
    },
    {
      name: 'GitHub',
      pattern: '(https?:\\/\\/)?(www\\.)?(github\\.com|gist\\.github\\.com|raw\\.github\\.com|github\\.io)\\/[^\\s]+',
      description: 'GitHub repositories, gists, and pages'
    },
    {
      name: 'Twitter/X',
      pattern: '(https?:\\/\\/)?(www\\.)?(twitter\\.com|x\\.com|t\\.co)\\/[^\\s]+',
      description: 'Twitter/X posts and profiles'
    },
    {
      name: 'LinkedIn',
      pattern: '(https?:\\/\\/)?(www\\.)?(linkedin\\.com|lnkd\\.in)\\/[^\\s]+',
      description: 'LinkedIn posts and profiles'
    },
    {
      name: 'Reddit',
      pattern: '(https?:\\/\\/)?(www\\.)?(reddit\\.com|redd\\.it)\\/[^\\s]+',
      description: 'Reddit posts and comments'
    },
    {
      name: 'Pinterest',
      pattern: '(https?:\\/\\/)?(www\\.)?(pinterest\\.com|pin\\.it)\\/[^\\s]+',
      description: 'Pinterest pins and boards'
    },
    {
      name: 'Snapchat',
      pattern: '(https?:\\/\\/)?(www\\.)?(snapchat\\.com|t\\.co\\/snapchat)\\/[^\\s]+',
      description: 'Snapchat stories and profiles'
    }
  ];
}

// Initialize default patterns for a group
function initializeDefaultPatterns(groupId, botId) {
  const patterns = getPredefinedPatterns();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO allowed_links (group_id, bot_id, platform_name, regex_pattern, enabled)
    VALUES (?, ?, ?, ?, 0)
  `);
  
  patterns.forEach(pattern => {
    stmt.run(groupId, botId, pattern.name, pattern.pattern);
  });
}

module.exports = {
  getAllowedLinks,
  hasAllowedLink,
  setAllowedLink,
  toggleAllowedLink,
  removeAllowedLink,
  getPredefinedPatterns,
  initializeDefaultPatterns
};
