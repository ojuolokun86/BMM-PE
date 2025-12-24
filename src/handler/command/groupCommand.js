const sendToChat = require('../../utils/sendToChat');
const { handleGroupStatsCommand } = require('./groupStatsCommand')
// 📌 Shared utility to extract target JID from reply or mention
function extractTargetJid(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;

  // 1. Replied participant
  if (ctx?.participant) {
    return ctx.participant;
  }

  // 2. Mentioned JIDs (if available)
  if (ctx?.mentionedJid?.length) {
    return ctx.mentionedJid[0]; // Only take the first one
  }

  return null;
}


// Get all group admins
const getGroupAdmins = async (sock, groupId) => {
  try {
    //console.log(`🔍 Fetching group metadata for: ${groupId}`);
    const groupMetadata = await sock.groupMetadata(groupId);
    const admins = groupMetadata.participants
      .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
      .map(p => p.id);

    //console.log(`✅ Admins in group ${groupId}:`, admins);
    return admins;
  } catch (err) {
    console.error(`❌ Error getting admins for ${groupId}:`, err);
    return [];
  }
};

// Check if a user is admin
const checkIfAdmin = async (sock, groupId, userId) => {
  try {
    // Ensure userId is a full JID (WhatsApp format)
    const fullUserId = userId.includes('@') ? userId : `${userId}@lid`; // or @s.whatsapp.net for regular users

    //console.log(`👤 Checking if user ${fullUserId} is admin in ${groupId}`);
    const admins = await getGroupAdmins(sock, groupId);
    const isAdmin = admins.includes(fullUserId);
    //console.log(`➡️ Is user admin? ${isAdmin}`);
    return isAdmin;
  } catch (err) {
    console.error(`⚠️ Failed to check admin status in group ${groupId}:`, err);
    return false;
  }
};

// Mute group (set to announcement only)
async function muteGroup(sock, msg, userId) {
  const sender = msg.key.participant || msg.key.remoteJid;
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const groupJid = msg.key.remoteJid;
   if (!groupJid || !groupJid.endsWith('@g.us')) {
    return sendToChat(sock, groupJid, { message: '> ❌ This command only works in groups.' }, { quoted: msg });
  }

  //console.log(`🔒 Attempting to mute group: ${groupJid}`);

  const isAdmin = await checkIfAdmin(sock, groupJid, userId);
  const isBotAdmin = await checkIfAdmin(sock, groupJid, botLid);  
  if (!isAdmin) {
    ///console.log(`⛔ User ${userId} is not an admin. Abort muting.`);
    return sendToChat(sock, groupJid, { message: '> ❌ Only group admins can mute the group.' }, { quoted: msg });
  }
  if (!isBotAdmin) {
    return sendToChat(sock, groupJid, { message: '> ❌ I need to be an admin to mute the group.' }, { quoted: msg });
  }

  await sock.groupSettingUpdate(groupJid, 'announcement');
  //console.log(`✅ Group ${groupJid} muted successfully.`);
  await sendToChat(sock, groupJid, { message: '🔒 Group muted (locked).' }, { quoted: msg });
}

// Unmute group (allow all members to send messages)
async function unmuteGroup(sock, msg, userId) {
  const groupJid = msg.key.remoteJid;
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
   if (!groupJid || !groupJid.endsWith('@g.us')) {
    return sendToChat(sock, groupJid, { message: '> ❌ This command only works in groups.' }, { quoted: msg });
  }

  //console.log(`🔓 Attempting to unmute group: ${groupJid}`);

  const isAdmin = await checkIfAdmin(sock, groupJid, userId);
  if (!isAdmin) {
    //console.log(`⛔ User ${userId} is not an admin. Abort unmuting.`);
    return sendToChat(sock, groupJid, { message: '> ❌ Only group admins can unmute the group.' }, { quoted: msg });
  }
  const isBotAdmin = await checkIfAdmin(sock, groupJid, botLid);
  if (!isBotAdmin) {
    return sendToChat(sock, groupJid, { message: '> ❌ I need to be an admin to unmute the group.' }, { quoted: msg });
  }

  await sock.groupSettingUpdate(groupJid, 'not_announcement');
  //console.log(`✅ Group ${groupJid} unmuted successfully.`);
  await sendToChat(sock, groupJid, { message: '🔓 Group unmuted (unlocked).' }, { quoted: msg });
}

// List all pending group join requests
async function requestList(sock, msg, userId) {
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderId = sender?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const groupJid = msg.key.remoteJid;
  if (!groupJid || !groupJid.endsWith('@g.us')) {
    return sendToChat(sock, groupJid, { message: '> ❌ This command only works in groups.' }, { quoted: msg });
  }

  const isAdmin = await checkIfAdmin(sock, groupJid, sender);
  const isBotAdmin = await checkIfAdmin(sock, groupJid, botLid);
  if (!isAdmin) {
    return sendToChat(sock, groupJid, { message: '> ❌ Only group admins can use this command.' }, { quoted: msg });
  }
  if (!isBotAdmin) {
    return sendToChat(sock, groupJid, { message: '> ❌ I need to be an admin to view join requests.' }, { quoted: msg });
  }

  const requests = await sock.groupRequestParticipantsList(groupJid);
  if (!requests || requests.length === 0) {
    return sendToChat(sock, groupJid, { message: 'ℹ️ No pending join requests.' }, { quoted: msg });
  }

  let text = `📋 *Pending Join Requests (${requests.length})*\n\n`;
  requests.forEach((user, i) => {
    text += `${i + 1}. @${user.jid.split('@')[0]}\n`;
  });

  await sendToChat(sock, groupJid, { message: text, mentions: requests.map(u => u.jid) }, { quoted: msg });
}

// Accept all pending group join requests
async function acceptAllRequests(sock, msg, userId) {
  const groupJid = msg.key.remoteJid;
  if (!groupJid || !groupJid.endsWith('@g.us')) {
    return sendToChat(sock, groupJid, { message: '> ❌ This command only works in groups.' }, { quoted: msg });
  }

  const isAdmin = await checkIfAdmin(sock, groupJid, userId);
   const isBotAdmin = await checkIfAdmin(sock, groupJid, userId);
  if (!isAdmin) {
    return sendToChat(sock, groupJid, { message: '> ❌ Only group admins can use this command.' }, { quoted: msg });
  }
  if (!isBotAdmin) {
    return sendToChat(sock, groupJid, { message: '> ❌ I need to be an admin to accept join requests.' }, { quoted: msg });
  }

  const requests = await sock.groupRequestParticipantsList(groupJid);
  if (!requests || requests.length === 0) {
    return sendToChat(sock, groupJid, { message: 'ℹ️ No pending join requests to accept.' }, { quoted: msg });
  }

  const jids = requests.map(u => u.jid);
  await sock.groupRequestParticipantsUpdate(groupJid, jids, "approve");
  await sendToChat(sock, groupJid, { message: `✅ Successfully accepted ${requests.length} join requests.` }, { quoted: msg });
}

// Reject all pending group join requests
async function rejectAllRequests(sock, msg, userId) {
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const groupJid = msg.key.remoteJid;
  if (!groupJid || !groupJid.endsWith('@g.us')) {
    return sendToChat(sock, groupJid, { message: '> ❌ This command only works in groups.' }, { quoted: msg });
  }

  const isAdmin = await checkIfAdmin(sock, groupJid, userId);
   const isBotAdmin = await checkIfAdmin(sock, groupJid, botLid);
  if (!isAdmin) {
    return sendToChat(sock, groupJid, { message: '> ❌ Only group admins can use this command.' }, { quoted: msg });
  }
  if (!isBotAdmin) {
    return sendToChat(sock, groupJid, { message: '> ❌ I need to be an admin to reject join requests.' }, { quoted: msg });
  }

  const requests = await sock.groupRequestParticipantsList(groupJid);
  if (!requests || requests.length === 0) {
    return sendToChat(sock, groupJid, { message: 'ℹ️ No pending join requests to reject.' }, { quoted: msg });
  }

  const jids = requests.map(u => u.jid);
  await sock.groupRequestParticipantsUpdate(groupJid, jids, "reject");
  await sendToChat(sock, groupJid, { message: `✅ Successfully rejected ${requests.length} join requests.` }, { quoted: msg });
}

async function toggleGroupJoinApproval(sock, msg, userId, turnOn = true) {
  const groupJid = msg.key.remoteJid;

  console.log(`[toggleGroupJoinApproval] GroupJID: ${groupJid}`);
  console.log(`[toggleGroupJoinApproval] userId: ${userId}`);
  console.log(`[toggleGroupJoinApproval] turnOn: ${turnOn}`);

  if (!groupJid || !groupJid.endsWith('@g.us')) {
    console.log('[toggleGroupJoinApproval] Not a group chat');
    return sendToChat(sock, groupJid, {
      message: '> ❌ This command only works in groups.'
    }, { quoted: msg });
  }

  const isAdmin = await checkIfAdmin(sock, groupJid, userId);
  console.log(`[toggleGroupJoinApproval] isAdmin: ${isAdmin}`);
  if (!isAdmin) {
    return sendToChat(sock, groupJid, {
      message: '> ❌ Only group admins can change join settings.'
    }, { quoted: msg });
  }

  const isBotAdmin = await checkIfAdmin(sock, groupJid, botLid);
  if (!isBotAdmin) {
    return sendToChat(sock, groupJid, {
      message: '> ❌ I need to be an admin to change join settings.'
    }, { quoted: msg });
  }

  try {
    const setting = turnOn ? 'approval_mode' : 'not_approval_mode';
    console.log(`[toggleGroupJoinApproval] Setting group to: ${setting}`);

    await sock.groupSettingUpdate(groupJid, setting);

    const statusMsg = turnOn
      ? '> ✅ Group join mode set to *approval required*.'
      : '> ✅ Group join mode set to *open join* (no approval required).';

    await sendToChat(sock, groupJid, { message: statusMsg }, { quoted: msg });

    console.log('[toggleGroupJoinApproval] Setting updated successfully');
  } catch (err) {
    console.error('[toggleGroupJoinApproval] Error:', err);
    await sendToChat(sock, groupJid, {
      message: '> ❌ Failed to update join settings.'
    }, { quoted: msg });
  }
}



async function lockGroupInfo(sock, msg, userId) {
  const groupJid = msg.key.remoteJid;
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  if (!groupJid || !groupJid.endsWith('@g.us')) {
    return sendToChat(sock, groupJid, { message: '> ❌ This command only works in groups.' }, { quoted: msg });
  }

  const isAdmin = await checkIfAdmin(sock, groupJid, userId);
  if (!isAdmin) {
    return sendToChat(sock, groupJid, { message: '> ❌ Only group admins can lock group info.' }, { quoted: msg });
  }
  const isBotAdmin = await checkIfAdmin(sock, groupJid, botLid);
  if (!isBotAdmin) {
    return sendToChat(sock, groupJid, { message: '> ❌ I need to be an admin to lock group info.' }, { quoted: msg });
  }
  await sock.groupSettingUpdate(groupJid, 'locked');
  await sendToChat(sock, groupJid, { message: '🔒 Group info is now restricted to admins only.' }, { quoted: msg });
}

async function unlockGroupInfo(sock, msg, userId) {
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const groupJid = msg.key.remoteJid;
  if (!groupJid || !groupJid.endsWith('@g.us')) {
    return sendToChat(sock, groupJid, { message: '❌ This command only works in groups.' }, { quoted: msg });
  }

  const isAdmin = await checkIfAdmin(sock, groupJid, userId);
  if (!isAdmin) {
    return sendToChat(sock, groupJid, { message: '❌ Only group admins can unlock group info.' }, { quoted: msg });
  }
  const isBotAdmin = await checkIfAdmin(sock, groupJid, botLid);
  if (!isBotAdmin) {
    return sendToChat(sock, groupJid, { message: '❌ I need to be an admin to unlock group info.' }, { quoted: msg });
  }

  await sock.groupSettingUpdate(groupJid, 'unlocked');
  await sendToChat(sock, groupJid, { message: '🔓 Group info can now be edited by all members.' }, { quoted: msg });
}

// Add a user to the group (admin only)
async function addUserToGroup(sock, msg, userId) {
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const groupJid = msg.key.remoteJid;
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

  if (!groupJid || !groupJid.endsWith('@g.us')) {
    return sendToChat(sock, groupJid, {
      message: '❌ This command only works in groups.'
    }, { quoted: msg });
  }

  const isAdmin = await checkIfAdmin(sock, groupJid, userId);
  const isBotAdmin = await checkIfAdmin(sock, groupJid, botLid);
  if (!isAdmin) {
    return sendToChat(sock, groupJid, {
      message: '❌ Only group admins can add members.'
    }, { quoted: msg });
  }
  if (!isBotAdmin) {
    return sendToChat(sock, groupJid, {
      message: '❌ I need to be an admin to add members.'
    }, { quoted: msg });
  }

  const parts = text.trim().split(' ');
  let rawNumber = parts[1];

  if (!rawNumber) {
    return sendToChat(sock, groupJid, {
      message: '❌ Invalid command. Use: .add 234XXXXXXXXXX'
    }, { quoted: msg });
  }

  // Clean the number: remove +, spaces, dashes etc.
  const number = rawNumber.replace(/[^\d]/g, '');

  // Validate length (most international numbers are 8–15 digits)
  if (number.length < 8 || number.length > 15) {
    return sendToChat(sock, groupJid, {
      message: '❌ Invalid number format. Use: .add 234XXXXXXXXXX'
    }, { quoted: msg });
  }

  try {
    // Check if the number is on WhatsApp
    const exists = await sock.onWhatsApp(number + '@s.whatsapp.net');

    if (!exists || !exists[0]?.exists) {
      return sendToChat(sock, groupJid, {
        message: '❌ That number is not registered on WhatsApp.'
      }, { quoted: msg });
    }

    const userJid = exists[0].jid;

    // Attempt to add to group
    const res = await sock.groupParticipantsUpdate(groupJid, [userJid], 'add');

    if (res?.[0]?.status === 403) {
  // Generate group invite code
  const inviteCode = await sock.groupInviteCode(groupJid);
  const groupName = await sock.groupMetadata(groupJid).then(meta => meta.subject);

  const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

  // Notify in group
  await sendToChat(sock, groupJid, {
    message: `⚠️ Could not add @${number} due to privacy settings. Sent them an invite link via DM.`,
    mentions: [userJid]
  }, { quoted: msg });

  // Send link to user's DM
  await sendToChat(sock, userJid, {
    message: `👋 Hi! You were invited to join *${groupName}*.\nJoin here: ${inviteLink}`
  });

  return;
}


    await sendToChat(sock, groupJid, {
      message: `✅ Successfully added @${number}.`,
      mentions: [userJid]
    }, { quoted: msg });

  } catch (err) {
    console.error('[addUserToGroup] Error:', err);
    return sendToChat(sock, groupJid, {
      message: `❌ Failed to add member: ${err?.message || 'Unknown error'}`
    }, { quoted: msg });
  }
}

// Promote a user to admin (reply or mention)
async function promoteUser(sock, msg, userId) {
  const groupJid = msg.key.remoteJid;
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];

  if (!groupJid || !groupJid.endsWith('@g.us')) {
    return sendToChat(sock, groupJid, { message: '❌ This command only works in groups.' }, { quoted: msg });
  }

  const isAdmin = await checkIfAdmin(sock, groupJid, userId);
  const isBotAdmin = await checkIfAdmin(sock, groupJid, botLid);
  if (!isAdmin) {
    return sendToChat(sock, groupJid, { message: '❌ Only group admins can promote users.' }, { quoted: msg });
  }
  if (!isBotAdmin) {
    return sendToChat(sock, groupJid, { message: '❌ I need to be an admin to promote users.' }, { quoted: msg });
  }

  const targetJid = extractTargetJid(msg);
  if (!targetJid) {
    return sendToChat(sock, groupJid, { message: '❌ Reply to a user or mention them to promote.' }, { quoted: msg });
  }

  try {
    await sock.groupParticipantsUpdate(groupJid, [targetJid], 'promote');
    await sendToChat(sock, groupJid, {
      message: `✅ Promoted user: @${targetJid.split('@')[0]}`,
      mentions: [targetJid]
    }, { quoted: msg });
  } catch (err) {
    await sendToChat(sock, groupJid, {
      message: `❌ Failed to promote user: @${targetJid.split('@')[0]} - ${err.message}`,
      mentions: [targetJid]
    }, { quoted: msg });
  }
}


// Demote a user from admin (reply or mention)
async function demoteUser(sock, msg, userId) {
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const groupJid = msg.key.remoteJid;

  if (!groupJid || !groupJid.endsWith('@g.us')) {
    return sendToChat(sock, groupJid, { message: '❌ This command only works in groups.' }, { quoted: msg });
  }

  const isAdmin = await checkIfAdmin(sock, groupJid, userId);
  const isBotAdmin = await checkIfAdmin(sock, groupJid, botLid);
  if (!isAdmin) {
    return sendToChat(sock, groupJid, { message: '❌ Only group admins can demote users.' }, { quoted: msg });
  }
  if (!isBotAdmin) {
    return sendToChat(sock, groupJid, { message: '❌ I need to be an admin to demote users.' }, { quoted: msg });
  }

  const targetJid = extractTargetJid(msg);
  if (!targetJid) {
    return sendToChat(sock, groupJid, { message: '❌ Reply to a user or mention them to demote.' }, { quoted: msg });
  }

  try {
    await sock.groupParticipantsUpdate(groupJid, [targetJid], 'demote');
    await sendToChat(sock, groupJid, {
      message: `✅ Demoted user: @${targetJid.split('@')[0]}`,
      mentions: [targetJid]
    }, { quoted: msg });
  } catch (err) {
    await sendToChat(sock, groupJid, {
      message: `❌ Failed to demote user: @${targetJid.split('@')[0]}`,
      mentions: [targetJid]
    }, { quoted: msg });
  }
}

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getUrlInfo } = require('@whiskeysockets/baileys');

async function handleGroupCommand(sock, msg, userId) {
  const groupJid = msg.key.remoteJid;
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

  if (!groupJid || !groupJid.endsWith('@g.us')) {
    return sendToChat(sock, groupJid, { message: '❌ This command only works in groups.' }, { quoted: msg });
  }

  const parts = text.trim().split(' ');
  const subcommand = parts[1]?.toLowerCase();
  const argText = parts.slice(2).join(' ');

  const metadata = await sock.groupMetadata(groupJid);
  const sender = msg.key.participant || msg.key.remoteJid;
  const isAdmin = await checkIfAdmin(sock, groupJid, sender);
  const owner = metadata.owner || metadata.participants.find(p => p.admin === 'superadmin')?.id || 'unknown';
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const isBotAdmin = await checkIfAdmin(sock, groupJid, botLid);

  switch (subcommand) {
   case 'link': {

          if (!isAdmin) {
            return sendToChat(sock, groupJid, { message: '> ❌ Only admins can request group link.' }, { quoted: msg });
          }
          
          
          if (!isBotAdmin) {
            return sendToChat(sock, groupJid, { message: '> ❌ I need to be an admin before i can request group link.' }, { quoted: msg });
          } 
            const code = await sock.groupInviteCode(groupJid);
            const url = `https://chat.whatsapp.com/${code}`; 

            // Generate link preview metadata
            let linkPreview;
            try {
                linkPreview = await getUrlInfo(url, { thumbnailWidth: 5000 });
            } catch (e) {
                console.warn('Couldn’t fetch preview for the link', e);
            }

            // Send the link with preview
            return await sock.sendMessage(groupJid, {
                text: url,
                linkPreview
            }, { quoted: msg });
            }

    case 'info': {
      const remoteJid = groupJid;
      const groupName = metadata.subject;
      const memberCount = metadata.participants.length;
      const groupDesc = metadata.desc || 'No description';
      const adminCount = metadata.participants.filter(p => p.admin).length;

      const infoMsg = `
┌──「 *📋 INFO GROUP* 」
▢ *♻️ ID:*
• ${remoteJid}

▢ *🔖 NAME:* 
• ${groupName}

▢ *👥 Members:* 
• ${memberCount}

▢ *🤿 Group Owner:* 
• @${owner.split('@')[0]}

▢ *🕵🏻‍♂️ Admins:* 
• ${adminCount}

▢ *📌 Description:* 
• ${groupDesc}
      `.trim();

      return sendToChat(sock, groupJid, { message: infoMsg, mentions: [owner] }, { quoted: msg });
    }

    case 'desc': {
      if (!isAdmin) {
        return sendToChat(sock, groupJid, { message: '> ❌ Only admins can change group description.' }, { quoted: msg });
      }
      if (!isBotAdmin) {
        return sendToChat(sock, groupJid, { message: '> ❌ I need to be an admin to change group description.' }, { quoted: msg });
      }

      if (!argText) {
        return sendToChat(sock, groupJid, {
          message: '> ❌ Please provide a new description.\nExample: `.group desc This is a fun group!`'
        }, { quoted: msg });
      }

      await sock.groupUpdateDescription(groupJid, argText);
      return sendToChat(sock, groupJid, { message: '> ✅ Group description updated.' }, { quoted: msg });
    }

    case 'pic': {
      if (!isAdmin) {
        return sendToChat(sock, groupJid, { message: '> ❌ Only admins can update group picture.' }, { quoted: msg });
      }

      if (!isBotAdmin) {
        return sendToChat(sock, groupJid, { message: '> ❌ I need to be an admin to update group picture.' }, { quoted: msg });
      }

      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
      if (!quoted) {
        return sendToChat(sock, groupJid, { message: '> ❌ Please quote an image to set as group photo.' }, { quoted: msg });
      }

      const buffer = await downloadMediaMessage({ message: { imageMessage: quoted } }, 'buffer');
      await sock.updateProfilePicture(groupJid, buffer);
      return sendToChat(sock, groupJid, { message: '> ✅ Group picture updated.' }, { quoted: msg });
    }
    case 'stats': {
      console.log('stats');
      await handleGroupStatsCommand(sock, groupJid, userId);
      break;
    } 
    case 'revoke': {
      if (!isAdmin) {
        return sendToChat(sock, groupJid, { message: '> ❌ Only group admins can revoke the invite link.' }, { quoted: msg });
      }
      if (!isBotAdmin) {
        return sendToChat(sock, groupJid, { message: '> ❌ I need to be an admin to revoke the invite link.' }, { quoted: msg });
      }
      try {
        await sock.groupRevokeInvite(groupJid);
        return sendToChat(sock, groupJid, { message: '> ✅ Group invite link has been revoked (new link generated).' }, { quoted: msg });
      } catch (err) {
        return sendToChat(sock, groupJid, { message: `> ❌ Failed to revoke link: ${err.message}` }, { quoted: msg });
      }
    }

    default:
      return sendToChat(sock, groupJid, {
        message: `❓ Unknown command.\n\n> Available group subcommands:
> .group link — Get group invite link
> .group info — See group details
> .group desc <text> — Set group description
> .group pic — Reply to image to set group picture
> .group stats — See group stats
> .group revoke — Revoke group invite link`,
      }, { quoted: msg });
  }
}



module.exports = {
  muteGroup,
  unmuteGroup,
  requestList,
  acceptAllRequests,
  rejectAllRequests,
  lockGroupInfo,
  unlockGroupInfo,
  addUserToGroup,
  promoteUser,
  demoteUser,
  handleGroupCommand,
  getGroupAdmins,
  checkIfAdmin
};
