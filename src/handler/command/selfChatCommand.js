const { 
  isBotOwner,
  isChatbotEnabled,
  setChatbotEnabled
} = require('../../database/database');

// In-memory storage for recent bot responses to prevent loops
const recentBotResponses = new Set();

// Command handler: .selfchat on/off
async function handleSelfChatCommand(sock, msg, args) {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderId = sender?.split('@')[0];
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];

  // Only allow in DM
  if (!chatId.endsWith('@s.whatsapp.net') && !chatId.endsWith('@lid')) {
    return sock.sendMessage(chatId, { text: '❌ This command only works in DM.' }, { quoted: msg });
  }

  // Only bot owner can use
  if (!isBotOwner(senderId, botId, botLid)) {
    return sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command.' }, { quoted: msg });
  }

  const action = args[0]?.toLowerCase();

  if (!action || !['on', 'off'].includes(action)) {
    const enabled = isChatbotEnabled(`self_${senderId}`);
    return sock.sendMessage(chatId, {
      text: `*SELF-CHAT SETUP*\n\n*.selfchat on*\nEnable chatbot for your self-chat only\n\n*.selfchat off*\nDisable chatbot for your self-chat\n\nCurrent status: ${enabled ? '✅ ON' : '❌ OFF'}\n\n*Note: This only works in your own DM (Message Yourself)*`,
      quoted: msg
    });
  }

  if (action === 'on') {
    if (isChatbotEnabled(`self_${senderId}`)) {
      return sock.sendMessage(chatId, { text: '*Self-chat bot is already enabled*' }, { quoted: msg });
    }
    setChatbotEnabled(`self_${senderId}`, true);
    console.log(`✅ Self-chat bot enabled for user ${senderId}`);
    return sock.sendMessage(chatId, { text: '*Self-chat bot has been enabled*\n\nNow you can chat with me in your own DM! 💬' }, { quoted: msg });
  }

  if (action === 'off') {
    if (!isChatbotEnabled(`self_${senderId}`)) {
      return sock.sendMessage(chatId, { text: '*Self-chat bot is already disabled*' }, { quoted: msg });
    }
    setChatbotEnabled(`self_${senderId}`, false);
    console.log(`✅ Self-chat bot disabled for user ${senderId}`);
    return sock.sendMessage(chatId, { text: '*Self-chat bot has been disabled*' }, { quoted: msg });
  }
}

// Response handler: auto-reply in self-chat only
async function handleSelfChatResponse(sock, msg) {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderId = sender?.split('@')[0];
  const fromMe = msg.key.fromMe;
  //console.log(`senderId`, senderId)
  //console.log(`fromMe`, fromMe)
  //console.log(`chatId`, chatId)

  // Only work in DM
  if (!chatId.endsWith('@s.whatsapp.net') && !chatId.endsWith('@lid')) return;

  // Check if this is self-chat (chatId matches the sender's own DM)
  // In WhatsApp self-chat, the chatId is the same as the sender's JID
  const isSelfChat = chatId === sender || chatId === `${senderId}@s.whatsapp.net` || chatId === `${senderId}@lid`;
  //console.log(`isSelfChat`, isSelfChat)
  if (!isSelfChat) return; // Only respond in self-chat

  // Check if self-chat bot is enabled for this user
  const selfChatKey = `self_${senderId}`;
  //console.log(`selfChatKey`, selfChatKey)
  //console.log(`isChatbotEnabled(selfChatKey)`, isChatbotEnabled(selfChatKey))
  if (!isChatbotEnabled(selfChatKey)) return;

  // Only respond to self messages (fromMe = true)
  if (!fromMe) return;

  // CRITICAL: Don't respond to bot's own messages to prevent infinite loop
  const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  
  // Check if this message was recently sent by the bot
  if (recentBotResponses.has(messageContent)) {
    //console.log(`Skipping recent bot response to prevent loop:`, messageContent.substring(0, 50))
    recentBotResponses.delete(messageContent); // Remove after checking
    return;
  }

  try {
    // Extract message text
    const userMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    //console.log(`userMessage`, userMessage)
    //console.log(`userMessage.trim()`, userMessage.trim())
    if (!userMessage.trim()) return; // Skip empty messages

    // Import chatbot functions
    const { getAIResponse } = require('./chatBot');
    
    //console.log(`Getting AI response...`)
    // Get AI response
    const response = await getAIResponse(userMessage, {
      messages: [],
      userInfo: {},
      repliedToMessage: null,
      repliedToBot: false
    });

    //console.log(`AI response:`, response)
    if (!response) {
      //console.log(`No response from AI`)
      return;
    }

    //console.log(`Sending response to chat...`)
    
    // Add response to recent responses to prevent loop
    recentBotResponses.add(response);
    
    // Clean up old responses (keep only last 10)
    if (recentBotResponses.size > 10) {
      const firstResponse = recentBotResponses.values().next().value;
      recentBotResponses.delete(firstResponse);
    }
    
    // Send response
    await sock.sendMessage(chatId, { text: response }, { quoted: msg });
    //console.log(`Response sent!`)

  } catch (error) {
    console.error('❌ Error in self-chat response:', error.message);
  }
}

module.exports = {
  handleSelfChatCommand,
  handleSelfChatResponse
};
