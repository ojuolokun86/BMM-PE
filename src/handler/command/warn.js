const { incrementWarn, resetWarn, getAntilinkSettings } = require('../../database/antilinkDb');
const { isBotOwner } = require('../../database/database');
const { checkIfAdmin } = require('./groupCommand');

// Random warning messages
const warningMessages = [
  "⚠️ @user has been warned. Reason: {reason}\nWarning {count}/{limit}",
  "🚨 WARNING: @user\nReason: {reason}\nThis is warning {count}/{limit}",
  "❗ @user received a warning!\nCause: {reason}\nWarning status: {count}/{limit}",
  "⚠️ Warning issued to @user\n➤ {reason}\nWarnings: {count}/{limit}"
];

// Random removal messages
const removalMessages = [
  "🚫 @user has been removed after reaching {limit} warnings.",
  "❌ @user was kicked for accumulating {limit} warnings.",
  "🔴 @user has exceeded the warning limit ({limit}) and was removed.",
  "⛔ Maximum warnings reached ({limit}). @user has been removed."
];

function getRandomMessage(arr, userId, reason = "", count = null, limit = null) {
  let msg = arr[Math.floor(Math.random() * arr.length)];
  msg = msg.replace("@user", `@${userId}`);
  msg = msg.replace("{reason}", reason || "No reason specified");
  if (count && limit) {
    msg = msg.replace("{count}", count).replace("{limit}", limit);
  }
  return msg;
}

async function warnCommand(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];

  // Get warn limit from antilink settings
  const settings = getAntilinkSettings(from, botId);
  const warnLimit = settings.warnLimit || 3;

  // Check if in group
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: '❌ This command only works in groups.' });
  }

  // Check if sender is admin or owner
  const isAdmin = await checkIfAdmin(sock, from, sender.split('@')[0]);
  //const isOwner = isBotOwner(sender.split('@')[0], null, botId);
  
  if (!isAdmin) {
    return sock.sendMessage(from, { text: '❌ Only admins can use the warn command.' });
  }

  // Get target user
  let targetUser = null;
  let reason = "";

  // Check for mentioned user
  if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    targetUser = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    reason = args.slice(1).join(' ');
  } 
  // Check for replied message
  else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
    targetUser = msg.message.extendedTextMessage.contextInfo.participant;
    reason = args.join(' ');
  }

  if (!targetUser) {
    return sock.sendMessage(from, { text: '❌ Please mention or reply to the user you want to warn.' });
  }

  // Don't allow warning admins
  const targetIsAdmin = await checkIfAdmin(sock, from, targetUser.split('@')[0]);
  if (targetIsAdmin) {
    return sock.sendMessage(from, { text: '❌ Cannot warn admin users.' });
  }

  try {
    const warnCount = incrementWarn(from, botId, targetUser, reason, 'manual');

    // Send warning message
    await sock.sendMessage(from, {
      text: getRandomMessage(warningMessages, targetUser.split('@')[0], reason, warnCount, warnLimit),
      mentions: [targetUser]
    });

    // If warn limit reached, remove user
    if (warnCount >= warnLimit) {
      await sock.groupParticipantsUpdate(from, [targetUser], 'remove');
      await sock.sendMessage(from, {
        text: getRandomMessage(removalMessages, targetUser.split('@')[0], null, null, warnLimit),
        mentions: [targetUser]
      });
      resetWarn(from, botId, targetUser);
    }

    return true;
  } catch (err) {
    console.error('❌ Error in warn command:', err);
    await sock.sendMessage(from, { text: '❌ Failed to warn user.' });
    return false;
  }
}

module.exports = { warnCommand };