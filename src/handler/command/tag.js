//const sendToChat = require('../../utils/sendToChat');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const {  getGroupProfilePicBuffer, getContextInfo} = require('../../utils/groupImagePreview');



let lastTagAllEmoji = null; // Store the last used emoji
const generateTagAllMessage = (groupName, sender, botOwnerName, messageContent, mentions, adminList, emoji, senderJid) => {
  mentions = Array.isArray(mentions) ? mentions : [];
  adminList = Array.isArray(adminList) ? adminList : [];
  const totalMembers = mentions.length;
  const adminIds = adminList.map(id => id.split('@')[0]);
  const timestamp = new Date().toLocaleString();

  // Header
  let text = `📢 *TAG ALL NOTIFICATION* 📢\n\n`;
  
  // Group info/ omom no good
  text += `🏷 *Group*: ${groupName}\n`;
  text += `📊 *Members*: ${totalMembers} (👑 ${adminList.length} | 👥 ${totalMembers - adminList.length})\n`;
  text += `⏰ *Time*: ${timestamp}\n\n`;
  
  // Sender and owner info
  text += `👤 *From*: @${senderJid.split('@')[0]}\n`;
  text += `🤖 *Bot Owner*: ${botOwnerName}\n\n`;
  
  // Message section
  if (messageContent) {
      text += `💬 *Message*:\n${messageContent}\n\n`;
  }
  
  // Member list
  text += `👥 *Mentioned Members* (${mentions.length}):\n`;
  text += mentions.map((id, index) => {
      const username = id.split('@')[0];
      const isAdmin = adminIds.includes(username);
      return `${index + 1}. ${isAdmin ? '👑' : emoji} @${username}`;
  }).join('\n'); // One line between mentions

  // Footer
  text += `\n\n🔔 *Notification sent via BMM Bot*\n`;
  text += `👉 *Total Members*: ${totalMembers}\n`;
  text += `👑 *Admins*: ${adminList.length}\n`;
  text += `👥 *Members*: ${totalMembers - adminList.length}\n`;

  const allMentions = mentions.includes(senderJid) ? mentions : [senderJid, ...mentions];
  return { text, mentions: allMentions };
};

function getNewRandomEmoji() {
  const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😜', '🤪', '😝', '🤑', '🤡', '🤠', '🥳', '😎', '🤓', '🧐', '😏', '😬', '🤭', '🤫', '😛', '😋', '😺', '😹', '😻',
    '😼', '🙈', '🙉', '🙊', '👻', '💩', '👽', '👾', '🤖', '🎃', '😈', '👹', '👺', '🦄', '🐵', '🐒', '🦍', '🐶', '🐱',
    '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦝', '🦥', '🦦', '🦨', '🦧', '🦩',
    '🦚', '🦜', '🦢', '🦩', '🦦', '🦥', '🦨', '🦧', '🦮', '🐕‍🦺', '🐈‍⬛', '🦴', '🦷', '🦾', '🦿', '🦻', '🧠', '🦷'
  ];
  let emoji;
  do {
    emoji = emojis[Math.floor(Math.random() * emojis.length)];
  } while (emoji === lastTagAllEmoji);
  lastTagAllEmoji = emoji;
  return emoji;
}


/**
 * Main tag command handler.
 */
async function tagCommand(sock, msg, command, args) {
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid.endsWith('@g.us')) {
    await sock.sendMessage(remoteJid, { text: '❌ This command only works in groups.' });
    return;
  }

  const groupMetadata = await sock.groupMetadata(remoteJid);
  const participants = groupMetadata.participants.map(p => p.id);
  const adminList = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
  const groupName = groupMetadata.subject;
  const senderName = msg.pushName || 'Unknown';
  const botOwnerName = sock.user?.name || 'BMM';
  const senderJid = msg.key.participant || msg.key.remoteJid;

  let additionalMessage = args.join(' ') || '';

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const quotedType = quoted ? Object.keys(quoted)[0] : null;

  // Extract text if quoted
  if (quotedType === 'conversation') additionalMessage = quoted.conversation;
  else if (quotedType === 'extendedTextMessage') additionalMessage = quoted.extendedTextMessage.text;

  // Media types
  const isMedia = ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage'].includes(quotedType);


  // Handle media reply
  if (isMedia && quoted) {
    const mediaMsg = quoted[quotedType];
    const buffer = await downloadMediaMessage(
      { message: { [quotedType]: mediaMsg } },
      'buffer',
      {}
    );

    if (!buffer) {
      await sock.sendMessage(remoteJid, { text: '❌ Failed to download media.', quotedMessage: msg });
      return;
    }

    const caption = command === 'tagall'
      ? generateTagAllMessage(groupName, senderName, botOwnerName, additionalMessage || mediaMsg.caption, participants, adminList, getNewRandomEmoji(), senderJid).text
      : (additionalMessage || mediaMsg.caption || '');

    let mediaPayload = {
      caption,
      mentions: participants
    };

    if (quotedType === 'imageMessage') {
      mediaPayload.image = buffer;
    } else if (quotedType === 'videoMessage') {
      mediaPayload.video = buffer;
    } else if (quotedType === 'documentMessage') {
      mediaPayload.document = buffer;
      mediaPayload.fileName = mediaMsg.fileName || 'file';
    } else if (quotedType === 'audioMessage') {
      mediaPayload.audio = buffer;
      mediaPayload.mimetype = mediaMsg.mimetype;
    }

    await sock.sendMessage(remoteJid, mediaPayload, { quoted: msg });
    return;
  }

  // Handle normal text-only tag
  if (command === 'tag') {
    await sock.sendMessage(remoteJid, {
      text: additionalMessage || '📢 Attention everyone!',
      mentions: participants,
      quotedMessage: msg
    });
  } else if (command === 'tagall') {
    const emoji = getNewRandomEmoji();
    const tagAllMsgObj = generateTagAllMessage(
      groupName,
      senderName,
      botOwnerName,
      additionalMessage,
      participants,
      adminList,
      emoji,
      senderJid
    );
    const mentionsWithSender = tagAllMsgObj.mentions.includes(senderJid)
      ? tagAllMsgObj.mentions
      : [senderJid, ...tagAllMsgObj.mentions];
      const groupPicBuffer = await getGroupProfilePicBuffer(sock, remoteJid);

    await sock.sendMessage(remoteJid, {
      text: tagAllMsgObj.text,
      mentions: mentionsWithSender,
      quotedMessage: msg,
      contextInfo: getContextInfo({
        title: groupName,
        body: `Tag All Notification for ${groupName}`,
        thumbnail: groupPicBuffer
      })
    });
  } else if (command === 'admin') {
    const admins = groupMetadata.participants.filter(p => p.admin);
    const adminIds = admins.map(p => p.id);
    let adminMsg = `🤖 *BMM BOT* 🤖\n\n👑 *Group Admins in ${groupName}:*\n`;
    adminMsg += admins.map(p => `• 👮 @${p.id.split('@')[0]}`).join('\n');
    adminMsg += `\n\n${additionalMessage ? `📝 ${additionalMessage}\n` : ''}`;

    await sock.sendMessage(remoteJid, {
      text: adminMsg,
      mentions: adminIds,
      quotedMessage: msg,
      contextInfo: getContextInfo({
        title: groupName,
        body: `Admin List Notification for ${groupName}`,
        thumbnail: groupPicBuffer
      })
    });
  } else {
    await sock.sendMessage(remoteJid, { text: '❌ Unknown tag command. Use tag, tagall, or admin.' });
  }
}

module.exports = tagCommand;