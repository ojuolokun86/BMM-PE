const {
  getUserMode,
  getUserPrefix,
  getUserStatusViewMode,
  getReactToCommand,
  getRestartMessagesEnabled,
  isChatbotEnabled,
  getJoinRequestSettings,
  getAntitagStatus,
  getAntitagMaxWarnings,
  getContenderGroupStatus,
  followedTeams
} = require('../database/database');
const { getAntilinkSettings } = require('../database/antilinkDb');
const { getAntideleteMode, isGroupExcluded, shouldForwardToOwner } = require('../database/antideleteDb');
const { getWelcomeSettings } = require('../database/welcomeDb')
const { getAllowedLinks } = require('../database/linkDb');
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../database/sessions.db');
const db = new Database(dbPath);
const { version } = require('../../package.json');

async function getUserSettings(authId, userId, groupId = null) {
  const mode = getUserMode(userId);
  const prefix = getUserPrefix(userId);
  const statusView = getUserStatusViewMode(userId);
  const commandReact = getReactToCommand(userId);
  const restartMessagesEnabled = getRestartMessagesEnabled(userId);
  const chatbotEnabled = isChatbotEnabled(userId);
  const joinRequestSettings = getJoinRequestSettings(userId);
  const antitagSettings = getAntitagStatus(userId);
  const antitagMaxWarnings = getAntitagMaxWarnings(userId);
  const userFollowedTeams = followedTeams(userId);
  const row = db.prepare('SELECT user_name, user_lid FROM users WHERE user_id = ?').get(userId);
  const isGroup = typeof groupId === 'string' && groupId.endsWith('@g.us');

  let antilink = null;
  let antidelete = null;
  let welcomeSettings = null;
  let allowedLinks = [];
  let contenderSettings = null;

  
  const botVersion = version;
  if (isGroup) {
    antilink = getAntilinkSettings(groupId, userId);
    antidelete = {
      mode: getAntideleteMode(userId),
      sendToOwner: shouldForwardToOwner(userId),
      excluded: isGroupExcluded(userId, groupId)
    };
    welcomeSettings = getWelcomeSettings(groupId, userId);
    allowedLinks = getAllowedLinks(groupId, userId).map(link => link.platform);
    contenderSettings = getContenderGroupStatus(groupId);
  } else {
    antidelete = {
      mode: getAntideleteMode(userId),
      sendToOwner: shouldForwardToOwner(userId),
      excluded: null
    };
  }

  return {
    mode,
    prefix,
    isGroup,
    statusView,
    ownerName: row ? row.user_name : '',
    botLid: row ? row.user_lid : '',
    antilink,
    antidelete,
    welcomeSettings,
    allowedLinks,
    contenderSettings,
    commandReact,
    restartMessagesEnabled,
    chatbotEnabled,
    joinRequestSettings,
    antitagSettings,
    antitagMaxWarnings,
    userFollowedTeams,
    authId,
    botVersion
  };
}

module.exports = { getUserSettings };
