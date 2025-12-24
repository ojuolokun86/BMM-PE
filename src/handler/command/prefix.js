const { setUserPrefix, getUserPrefix, isBotOwner, getBotOwnerByPhone } = require('../../database/database');
const sendToChat = require('../../utils/sendToChat');
function isRealOwner(senderId, senderLid, sock) {
  // Get bot's main ID and LID
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0];

  // Get registered owner from database (if available)
   const dbOwnerId = getBotOwnerByPhone(botId) || null;

  // Check all possible matches
  return (
    senderId === botId ||
    senderId === botLid ||
    senderLid === botId ||
    senderLid === botLid ||
    (dbOwnerId && senderId === dbOwnerId)
  );
}

module.exports = async function prefixCommand(sock, msg, textMsg, phoneNumber) {
  const from = msg.key.remoteJid;
  const isGroup = from.endsWith('@g.us')
let senderJid;
  if (isGroup) {
    senderJid = msg.key.participant;
  } else {
    // If message is from the bot itself, use bot ID
    // If message is from the other user, use `remoteJid`
    senderJid = msg.key.fromMe ? sock.user.id : from;
  }

  const senderId = senderJid.split(':')[0]?.split('@')[0];
  const senderLid = senderJid.includes(':') ? senderJid.split(':')[1] : null;

  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0];

 const isOwner = isRealOwner(senderId, senderLid, sock )

  // ✅ Check if sender is the bot owner
  if (!isOwner) {
    await sendToChat(sock, from, {
      message: '❌ Only the bot owner can change the prefix.'
    });
    return;
  }

  // ✅ Get current prefix
  const currentPrefix = getUserPrefix(phoneNumber);
  const args = textMsg.slice(currentPrefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command !== 'prefix' || args.length < 1) {
    await sendToChat(sock, from, {
      message: `Usage: ${currentPrefix}prefix <new_prefix>\nCurrent prefix: *${currentPrefix}*`
    });
    return;
  }

  const newPrefix = args[0];
  if (!newPrefix || newPrefix.length > 3) {
    await sendToChat(sock, from, { message: '❌ Invalid prefix. Please use 1–3 characters.' });
    return;
  }

  setUserPrefix(botId, newPrefix);
  console.log(`Prefix updated for ${botId} to ${newPrefix}`);
  await sendToChat(sock, from, { message: `✅ Prefix updated to *${newPrefix}*.` });
};
