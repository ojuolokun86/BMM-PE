const { setUserMode, getUserMode, isBotOwner, getBotOwnerByPhone } = require('../../database/database');
const sendToChat = require('../../utils/sendToChat');

function getMatchedOwner(senderId, senderLid, botId, botLid) {
  if (senderId === botId || senderId === botLid) return senderId;
  if (senderLid && (senderLid === botId || senderLid === botLid)) return senderLid;
  return null;
}

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

module.exports = async function modeCommand(sock, msg, textMsg, phoneNumber) {
  const from = msg.key.remoteJid;
  const isGroup = from.endsWith('@g.us');

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

  const matchedOwner = getMatchedOwner(senderId, senderLid, botId, botLid);

  // console.log('========== MODE COMMAND DEBUG ==========');
  // console.log(`🔄 Chat Type: ${isGroup ? 'GROUP' : 'PRIVATE'}`);
  // console.log(`📩 Message From: ${from}`);
  // console.log(`👤 Sender JID: ${senderJid}`);
  // console.log(`👤 Sender ID: ${senderId}`);
  // console.log(`🔗 Sender LID: ${senderLid}`);
  // console.log(`🤖 Bot ID: ${botId}`);
  // console.log(`🔐 Bot LID: ${botLid}`);
  // console.log(`✅ Matched Owner: ${matchedOwner}`);
  // console.log(`📨 Full textMsg: "${textMsg}"`);

  const [, mode] = textMsg.split(' ');
  if (!['public', 'private', 'admin'].includes(mode)) {
    console.log(`❌ Invalid mode input: ${mode}`);
    await sendToChat(sock, from, { message: 'Usage: .mode public|private|admin' });
    return;
  }

  const isOwner = isRealOwner(senderId, senderLid, sock);
  console.log(`🛡️ Is Real Owner: ${isOwner}`);

  if (!isOwner) {
    console.log(`⛔ Unauthorized mode change attempt by ${senderId} in ${from}`);
    await sendToChat(sock, from, {
      message: '❌ Only the bot owner can change the mode.'
    });
    return;
  }

  setUserMode(botId, mode);
  console.log(`✅ Mode set to: ${mode} by ${senderId} (from ${from})`);
  await sendToChat(sock, from, { message: `✅ Mode set to *${mode}*.` });

  console.log('========================================\n');
};

