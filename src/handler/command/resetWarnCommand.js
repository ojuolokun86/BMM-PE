const sendToChat = require('../../utils/sendToChat');
const { db } = require('../../database/database');
const { isBotOwner } = require('../../database/database');
const { checkIfAdmin } = require('./groupCommand');

async function resetWarnCommand(sock, msg, textMsg) {
  const from = msg.key.remoteJid;
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const senderId = senderJid.split('@')[0];

  // Check if in group
  if (!from.endsWith('@g.us')) {
    return await sendToChat(sock, from, {
      message: '❌ This command can only be used in a group.'
    });
  }

  // Check if sender is admin or owner
  const isAdmin = await checkIfAdmin(sock, from, senderId);
  const isOwner = isBotOwner(senderId, null, botId);
  
  if (!isAdmin && !isOwner) {
    return await sendToChat(sock, from, {
      message: '❌ Only admins can reset warnings.'
    });
  }

  const args = textMsg.trim().split(/\s+/).slice(1);
  const target = args[0];

  // Reset ALL in the group
  if (target === 'all') {
    db.prepare(`DELETE FROM warns WHERE group_id = ? AND bot_id = ?`)
      .run(from, botId);
    return await sendToChat(sock, from, {
      message: '♻️ All warnings for this group have been cleared.'
    });
  }

  // Reset specific user by mention or reply
  let userToReset = null;

  if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    userToReset = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
  } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
    userToReset = msg.message.extendedTextMessage.contextInfo.participant;
  }

  if (!userToReset) {
    return await sendToChat(sock, from, {
      message: '❌ Please mention or reply to the user whose warnings you want to reset.'
    });
  }

  // Get current warnings before reset
  const currentWarns = db.prepare(`
    SELECT warn_count FROM warns 
    WHERE group_id = ? AND bot_id = ? AND user_jid = ?
  `).get(from, botId, userToReset);

  if (!currentWarns) {
    return await sendToChat(sock, from, {
      message: `✨ @${userToReset.split('@')[0]} has no warnings to reset.`,
      mentions: [userToReset]
    });
  }

  // Reset warnings for specific user
  db.prepare(`
    DELETE FROM warns 
    WHERE group_id = ? AND bot_id = ? AND user_jid = ?
  `).run(from, botId, userToReset);

  await sendToChat(sock, from, {
    message: `✅ Cleared ${currentWarns.warn_count} warning(s) for @${userToReset.split('@')[0]}.`,
    mentions: [userToReset]
  });
};

module.exports = resetWarnCommand;
