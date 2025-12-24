const { getMediaFromStore, deleteMediaFromStore, getTextFromStore, deleteTextFromStore } = require('../../utils/globalStore');
const { getAntideleteMode, isGroupExcluded, } = require('../../database/antideleteDb');
const { wasDeletedByBot } = require('../../utils/botDeletedMessages');
const { isBotOwner } = require('../../database/database');
const sendToChat = require('../../utils/sendToChat');
const { shouldForwardToOwner } = require('../../database/antideleteDb');


async function handleDeletedMessage(sock, msg) {
  const protocol = msg?.message?.protocolMessage;
  const remoteJid = msg.key.remoteJid;
 
  const senderId = msg.key.participant || msg.key.remoteJid;
  if (!protocol || protocol.type !== 0) return;
  const chatId = remoteJid;
  const msgId = protocol.key.id;
  const textData = getTextFromStore(msgId);
   if (remoteJid === 'status@broadcast') {
  //console.log(`⏭️ Skipping restore: deleted status message (${msgId})`);
  return;
}
  // const deletedBy = textData?.sender || protocol.key.participant || chatId;
  const botId = sock.user?.id?.split(':')[0];
  const botLid = sock.user?.lid?.split(':')[0];
  const isGroup = chatId.endsWith('@g.us');
  const timestamp = new Date().toLocaleString();

   let deletedBy;
        if (isGroup) {
            deletedBy = msg.key.participant || remoteJid;
        } else {
            deletedBy = msg.key.fromMe ? (botLid || botId) : remoteJid;
        }

  const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  const forwardToOwner = shouldForwardToOwner(botId);
  //console.log(`🔍 Forward to owner: ${forwardToOwner}, Owner JID: ${ownerJid}`);
  const targetJid = (!isGroup && forwardToOwner) ? ownerJid : chatId;
  //console.log(`🔍 Target JID for restoration: ${targetJid}`);
  const deletedById = deletedBy?.split('@')[0];
  const deletedByBot = msg.key.fromMe || deletedById === botId || deletedById === botLid;
 
  if (wasDeletedByBot(msgId)) return;
   
        //console.log(`🔍 Handling deleted message ${msgId} in ${chatId} by ${deletedBy} at ${timestamp}`);
  // Get global antidelete mode
  const mode = getAntideleteMode(botId);
  
  if (mode === 'off') return;
  if (deletedByBot) return;
  if (isGroupExcluded(botId, chatId)) return;
  //console.log(`🔍 Deleted by bot: ${deletedByBot}, Mode: ${mode}`);
  const shouldRestore =
    mode === 'both' ||
    (mode === 'group' && isGroup) ||
    (mode === 'chat' && !isGroup);

  if (!shouldRestore) return;
  
 

  // Always mention the user who deleted, even in DM
  let deletedByTag = '';
  let mentions = [];
  // const textData = getTextFromStore(msgId);
  if (textData && textData.deletedBy) {
    deletedByTag = `@${textData.deletedBy.split('@')[0]}`;
    mentions = [textData.deletedBy];
  } else if (deletedBy && deletedBy !== chatId) {
    deletedByTag = `@${deletedBy.split('@')[0]}`;
    mentions = [deletedBy];
  } else {
    deletedByTag = '';
    mentions = [];
  }

  // Restore text
  if (textData) {
    await sendToChat(sock, targetJid, {
      message: `♻️ *Restored deleted message*\n\n*Content:* ${textData.content}${deletedByTag ? `\n*By:* ${deletedByTag}` : ''}\n*At:* ${timestamp}`,
      mentions
    });
    //console.log(`Restoring deleted message to: ${targetJid}, mentioning: ${mentions}`);
    deleteTextFromStore(msgId);
    return;
  }

  // Restore media
  const mediaData = getMediaFromStore(msgId);
  if (mediaData) {
    const fullCaption = `♻️ *Deleted media restored*${deletedByTag ? `\n*By:* ${deletedByTag}` : ''}\n*At:* ${timestamp}`
    + (mediaData.caption ? `\n\n📝 *Caption:* ${mediaData.caption}` : '');

  await sock.sendMessage(targetJid, {
    [mediaData.type]: mediaData.buffer,
    caption: fullCaption,
    mentions
  }, { quoted: msg });
    deleteMediaFromStore(msgId);
    return;
  }

  // Nothing found
  await sendToChat(sock, targetJid, {
    message: `🗑️ *A message was deleted${deletedByTag ? ` by ${deletedByTag}` : ''}* but could not be restored.`,
    mentions
  });
  //console.log(`Restoring deleted message to: ${targetJid}, mentioning: ${mentions}`);
}

module.exports = handleDeletedMessage;
