const { isBotOwner } = require('../../database/database');

const menu = `
📞 *Call Management Menu*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Reply with an option number:

> [1] ▸ Block all incoming **voice calls**
> [2] ▸ Block all incoming **video calls**  
> [3] ▸ Block **both voice and video calls**
> [4] ▸ Block calls **except whitelist**
> [5] ▸ Allow calls **only from whitelist**

⚠️ *This only works in the bot owner's DM.*
⚠️ *Call blocking will apply to all incoming calls.*
━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

// Store call blocking settings
const callSettings = {
  blockVoice: false,
  blockVideo: false,
  whitelistMode: false,
  whitelist: new Set()
};

async function handleCallCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const senderId = sender?.split('@')[0];

  // Only allow in bot owner's DM
  if (!from.endsWith('@s.whatsapp.net') && !from.endsWith('@lid')) {
    return sock.sendMessage(from, { text: '❌ This command only works in DM.' }, { quoted: msg });
  }
  if (!isBotOwner(senderId, botId, botLid)) {
    return sock.sendMessage(from, { text: '❌ Only the bot owner can use this command.' }, { quoted: msg });
  }

  // Send menu and set up listener
  const sentMenu = await sock.sendMessage(from, { text: menu }, { quoted: msg });
  const menuMsgId = sentMenu.key.id;

  const listener = async (m) => {
    const reply = m.messages?.[0];
    if (!reply) return;

    const replyFrom = reply.key.remoteJid;
    const replySender = reply.key.participant || reply.key.remoteJid;
    if (replyFrom !== from || replySender !== sender) return;

    const context = reply.message?.extendedTextMessage?.contextInfo;
    const isReplyToMenu = context?.stanzaId === menuMsgId;
    if (!isReplyToMenu) return;

    const body = reply.message?.conversation || reply.message?.extendedTextMessage?.text || '';
    const option = parseInt(body.trim());

    if (isNaN(option) || ![1, 2, 3, 4, 5].includes(option)) {
      await sock.sendMessage(from, { text: '❌ Invalid option. Reply with 1, 2, 3, 4, or 5.' });
      sock.ev.off('messages.upsert', listener);
      return;
    }

    let response = '';
    
    switch (option) {
      case 1:
        callSettings.blockVoice = true;
        callSettings.blockVideo = false;
        callSettings.whitelistMode = false;
        response = '✅ **Voice calls blocked**\n\n📞 All incoming voice calls will be rejected.\n🎥 Video calls will be allowed.';
        break;
        
      case 2:
        callSettings.blockVoice = false;
        callSettings.blockVideo = true;
        callSettings.whitelistMode = false;
        response = '✅ **Video calls blocked**\n\n🎥 All incoming video calls will be rejected.\n📞 Voice calls will be allowed.';
        break;
        
      case 3:
        callSettings.blockVoice = true;
        callSettings.blockVideo = true;
        callSettings.whitelistMode = false;
        response = '✅ **All calls blocked**\n\n📞🎥 Both voice and video calls will be rejected.';
        break;
        
      case 4:
        callSettings.blockVoice = true;
        callSettings.blockVideo = true;
        callSettings.whitelistMode = true;
        response = '✅ **Calls blocked except whitelist**\n\n📞🎥 All calls will be rejected except from whitelist users.\n\nℹ️ Use `.whitelist add <number>` to add users to whitelist.';
        break;
        
      case 5:
        callSettings.blockVoice = true;
        callSettings.blockVideo = true;
        callSettings.whitelistMode = true;
        response = '✅ **Only whitelist calls allowed**\n\n📞🎥 Only calls from whitelist users will be allowed.\n\nℹ️ Use `.whitelist add <number>` to add users to whitelist.';
        break;
    }

    await sock.sendMessage(from, { text: response });
    sock.ev.off('messages.upsert', listener);
  };

  sock.ev.on('messages.upsert', listener);
}

// Function to handle incoming calls
async function handleIncomingCall(sock, call) {
  const callerId = call.from?.split('@')[0];
  const callerJid = call.from;
  
  if (!callerId) return;
  
  let shouldBlock = false;
  let callType = call.type?.toLowerCase() || 'voice';
  
  // Check if call should be blocked
  if (callSettings.whitelistMode) {
    // Whititelist mode: block if not in whitelist
    if (!callSettings.whitelist.has(callerId)) {
      shouldBlock = true;
    }
  } else {
    // Normal blocking mode
    if (callType.includes('video') && callSettings.blockVideo) {
      shouldBlock = true;
    } else if (callType.includes('voice') && callSettings.blockVoice) {
      shouldBlock = true;
    }
  }
  
  if (shouldBlock) {
    try {
      // Reject the call
      await sock.rejectCall(call.id, callerJid);
      console.log(`📞 Rejected ${callType} call from ${callerId}`);
    } catch (error) {
      console.error('❌ Error rejecting call:', error);
    }
  }
}

// Get current call settings
function getCallSettings() {
  return {
    blockVoice: callSettings.blockVoice,
    blockVideo: callSettings.blockVideo,
    whitelistMode: callSettings.whitelistMode,
    whitelist: Array.from(callSettings.whitelist)
  };
}

// Add user to whitelist
function addToWhitelist(userId) {
  callSettings.whitelist.add(userId);
  return true;
}

// Remove user from whitelist
function removeFromWhitelist(userId) {
  return callSettings.whitelist.delete(userId);
}

module.exports = {
  handleCallCommand,
  handleIncomingCall,
  getCallSettings,
  addToWhitelist,
  removeFromWhitelist
};