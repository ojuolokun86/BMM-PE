const { quotedInfo } = require('../../utils/sendToChat');
const sendToChat = require('../../utils/sendToChat');
const { isBotOwner } = require('../../database/database');
const privacySettings = {
  0: 'last_seen',
  1: 'profile_photo',
  2: 'status',
  3: 'read_receipts',
  4: 'groups',
  5: 'calls',
  6: 'online'
};
const onlineOptionMenu = `
🟢 *Who can see when you're online?*
Reply with a number:
1. Everyone  
2. Same as Last Seen
`;

const onlineOptions = {
  1: 'all',
  2: 'match_last_seen'
};


const settingLabels = {
  last_seen: 'Last Seen',
  profile_photo: 'Profile Photo',
  status: 'Status',
  read_receipts: 'Read Receipts',
  groups: 'Group Invite Privacy',
  calls: 'Call Privacy',
  online: 'Online Status'
};
const apiKeyMapping = {
  last_seen: 'last',
  profile_photo: 'profile',
  status: 'status',
  read_receipts: 'readreceipts',
  groups: 'groupadd',
  calls: 'calladd',
  online: 'online'
};


const privacyOptions = {
  0: 'all',
  1: 'contacts',
  2: 'contacts_except',
  3: 'none'
};

const optionMenu = `
👁️ *Choose who can see it:*
Reply with a number:
🌍 0. Everyone  
📇 1. My Contacts  
🚫 2. My Contacts Except...  
🔒 3. Nobody  
`;

async function setPrivacyCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const quote = quotedInfo();
  const sender = msg.key.participant || msg.key.remoteJid;
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const senderId = sender?.split('@')[0];
  const name = sock.user?.name;
  if (!msg.key.fromMe && !isBotOwner(senderId, botId, botLid)) {
    return await sendToChat(sock, from, {
      message: `❌ Only *${name}* can configure privacy settings.`
    });
  }
  let currentSettings;
  try {
    currentSettings = await sock.fetchPrivacySettings?.(true);
  } catch (e) {
    console.error(`error in fetching privacy settings: ${e}`);
    return await sendToChat(sock, from, {
      message: '❌ Failed to fetch current privacy settings.'
    });
  }

  // Dynamically build the menu with actual settings
  let settingMenu = `🔐 *Your Privacy Settings*\n_Reply with 0–6 to update a setting._\n\n`;

  for (const [key, settingName] of Object.entries(privacySettings)) {
    const apiKey = apiKeyMapping[settingName] || settingName;
    const current = currentSettings[apiKey] || 'unknown';


    const label = settingLabels[settingName] || settingName;
    const icon = getIcon(settingName);

    settingMenu += `${icon} ${key}. *${label}* — _${current}_\n`;
  }

  const sentMenu = await sock.sendMessage(from, { text: settingMenu }, { quoted: quote });
  const menuMsgId = sentMenu.key.id;

  let selectedSetting = null;

  const firstListener = async (m) => {
    const reply = m.messages?.[0];
    if (!reply) return;

    const replyFrom = reply.key.remoteJid;
    const replySender = reply.key.participant || reply.key.remoteJid;
    const context = reply.message?.extendedTextMessage?.contextInfo;

    if (replyFrom !== from || replySender !== sender) return;
    if (!context || context.stanzaId !== menuMsgId) return;

    const body = reply.message?.conversation || reply.message?.extendedTextMessage?.text || '';
    const option = parseInt(body.trim());

    if (isNaN(option) || !privacySettings.hasOwnProperty(option)) {
      await sendToChat(sock, from, { message: '❌ Invalid option. Use 0–6.' });
      sock.ev.off('messages.upsert', firstListener);
      return;
    }

    selectedSetting = privacySettings[option];
    sock.ev.off('messages.upsert', firstListener);

    if (selectedSetting === 'calls') {
      await sendToChat(sock, from, {
        message: '❌ Call privacy setting is not supported in Baileys.'
      });
      return;
    }

   const secondMenuText = selectedSetting === 'online' ? onlineOptionMenu : optionMenu;
    const secondMenu = await sock.sendMessage(from, { text: secondMenuText }, { quoted: reply });

    const optionMsgId = secondMenu.key.id;

    const secondListener = async (m2) => {
      const reply2 = m2.messages?.[0];
      if (!reply2) return;

      const replyFrom2 = reply2.key.remoteJid;
      const replySender2 = reply2.key.participant || reply2.key.remoteJid;
      const context2 = reply2.message?.extendedTextMessage?.contextInfo;

      if (replyFrom2 !== from || replySender2 !== sender) return;
      if (!context2 || context2.stanzaId !== optionMsgId) return;

      const body2 = reply2.message?.conversation || reply2.message?.extendedTextMessage?.text || '';
     const optionsMap = selectedSetting === 'online' ? onlineOptions : privacyOptions;
        const option2 = parseInt(body2.trim());

        if (isNaN(option2) || !optionsMap.hasOwnProperty(option2)) {
        await sendToChat(sock, from, {
            message: `❌ Invalid option. Use ${
            selectedSetting === 'online' ? '1–2' : '0–3'
            }.`
        });
        sock.ev.off('messages.upsert', secondListener);
        return;
        }

        const value = optionsMap[option2];

      try {
        switch (selectedSetting) {
          case 'last_seen':
            await sock.updateLastSeenPrivacy(value);
            break;
          case 'profile_photo':
            await sock.updateProfilePicturePrivacy(value);
            break;
          case 'status':
            await sock.updateStatusPrivacy(value);
            break;
          case 'read_receipts':
            await sock.updateReadReceiptsPrivacy(value);
            break;
          case 'groups':
            await sock.updateGroupsAddPrivacy(value);
            break;
          case 'online':
            await sock.updateOnlinePrivacy(value);
            break;
          default:
            throw new Error('Unsupported privacy setting');
        }

        await sendToChat(sock, from, {
          message: `✅ *${selectedSetting.replace('_', ' ')}* updated to *${value}*`
        });
      } catch (err) {
        console.error(err);
        await sendToChat(sock, from, {
          message: `❌ Failed to update setting:\n${err.message}`
        });
      }

      sock.ev.off('messages.upsert', secondListener);
    };

    sock.ev.on('messages.upsert', secondListener);
  };

  sock.ev.on('messages.upsert', firstListener);
}

// Helper to return nice emojis per setting
function getIcon(setting) {
  switch (setting) {
    case 'last_seen': return '🔐';
    case 'profile_photo': return '🖼️';
    case 'status': return '📊';
    case 'read_receipts': return '✅';
    case 'groups': return '👥';
    case 'calls': return '📞';
    case 'online': return '🟢';
    default: return '🔧';
  }
}

module.exports = setPrivacyCommand;
