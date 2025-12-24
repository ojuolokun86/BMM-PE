// src/handler/command/deleteMessage.js
const sendToChat = require('../../utils/sendToChat');

// Normalize a JID or raw id to its numeric part (before @ / before :)
function toNumericId(id) {
  if (!id) return '';
  const left = id.split(':')[0];
  return left.split('@')[0];
}

// Lightweight admin check using group metadata with JID normalization (@s.whatsapp.net and @lid)
async function isGroupAdmin(sock, chatId, userId) {
  try {
    const metadata = await sock.groupMetadata(chatId);
    const targetNum = toNumericId(userId);

    const participant = metadata.participants.find(p => {
      const pNum = toNumericId(p.id);
      return pNum === targetNum;
    });

    console.log('participant:', participant?.id || 'not-found');
    return !!participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Build the delete key for a quoted message
function getQuotedDeleteKey(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const q = ctx?.quotedMessage;
  if (!ctx || !q) return null;

  const participant = ctx.participant || ctx.remoteJid || msg.key.remoteJid;
  const id = ctx.stanzaId || ctx.msgId || ctx.key?.id;
  if (!id) return null;

  return {
    remoteJid: msg.key.remoteJid,
    fromMe: false,
    id,
    participant
  };
}

module.exports = async function deleteMessageCommand(sock, from, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderId = toNumericId(sender);
    const botId = toNumericId(sock.user?.id);
    const botLids = sock.user?.lid;
    const botLid = toNumericId(sock.user?.lid);
    const isGroup = from.endsWith('@g.us');

    console.log(`botLid: ${botLid}`);
    console.log(`botLids: ${botLids}`);
    console.log(`senderId: ${senderId}`);
    console.log(`sender: ${sender}`);

  // must be a reply
  const quotedKey = getQuotedDeleteKey(msg);
  if (!quotedKey) {
    return sendToChat(sock, from, { message: '❌ Reply to a message you want to delete.' }, { quoted: msg });
  }

  // DM: only bot owner can delete
  if (!isGroup) {
    if (botId !== senderId) {
      return sendToChat(sock, from, { message: '❌ Only the bot owner can delete messages in DM.' }, { quoted: msg });
    }
    try {
      await sock.sendMessage(from, { delete: quotedKey });
      return;
    } catch (e) {
      return sendToChat(sock, from, { message: `❌ Failed to delete: ${e.message || 'unknown error'}` }, { quoted: msg });
    }
  }

  // Group: bot must be admin
    const botIsAdmin = await isGroupAdmin(sock, from, botLid);
    console.log(`botIsAdmin: ${botIsAdmin}`);
    if (!botIsAdmin) {
    return sendToChat(sock, from, { message: '❌ I need to be an admin to delete messages.' }, { quoted: msg });
  }

  // Allow if invoker is admin OR quoted sender is admin
  const invokerIsAdmin = await isGroupAdmin(sock, from, senderId);
  const quotedSenderId = toNumericId(quotedKey.participant || '');
  console.log('admin-check ids:', { senderId, quotedSenderId });
  const quotedSenderIsAdmin = quotedSenderId ? await isGroupAdmin(sock, from, quotedSenderId) : false;

  if (!invokerIsAdmin && !quotedSenderIsAdmin) {
    return sendToChat(sock, from, { message: '❌ Only admins can use this or delete admin messages.' }, { quoted: msg });
  }

  try {
    await sock.sendMessage(from, { delete: quotedKey });
  } catch (e) {
    await sendToChat(sock, from, { message: `❌ Failed to delete: ${e.message || 'unknown error'}` }, { quoted: msg });
  }
};