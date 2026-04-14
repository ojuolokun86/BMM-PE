const sendToChat = require('../../utils/sendToChat.js');
const { getContextInfo, getForwardedContext } = require('../../utils/contextInfo.js');
const { version } = require('../../../package.json');
const { getEmojiForCommand } = require('../features/commandEmoji.js');


const getMainMenu = (
  ownerName = 'Unknown',
  mode = 'private',
  phoneNumber = 'Unknown',
  groupId = 'Unknown',
  prefix = 'Unknown',
  version = 'Unknown',
  authId = 'Unknown',
  v = '1'
) => `
🖥️ *SYSTEM CONTROL PANEL INITIALIZED*
━━━━━━━━━━━━━━━━━━━━━━━━━━
> 👤 Operator: ${ownerName || 'Not Set'}
> ⚙️ Mode: ${mode ? mode.toUpperCase() : 'PRIVATE'}
> 📱 System ID: ${phoneNumber || 'Not Available'}
> 🆔 Group ID: ${groupId || 'Not Available'}
> 🔤 Prefix: ${prefix || 'Not Set'}
> 🧩 Firmware: v${version || '1.0.0'}
> 🔐 Auth ID: ${authId || 'Not Available'}
━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 *CORE COMMANDS*

> 🏓 ping → Check bot responsiveness
> ⚙️ settings → Configure system settings
> 🔤 prefix → Change command prefix
> � mode → Switch system mode
> 📖 help → Command manual
> � menu → Display system menu
> ℹ️ info → System information
> 🔄 restart → Reboot system
> 🚪 logout → Logout session
> � react → React to commands
> � disk → Show storage & memory info
> 📦 npm → Update Baileys package
> 🔄 update → Update bot from GitHub
> � contacts → See all Your Saved contact by bot
> 🧹 clear → Clear all messages in a chat

🛡️ *MODERATION & SECURITY*

> 🔗 antilink → Block external links
> 🔗 link → Manage allowed link platforms
> 📋 warnlist → View warnings
> �️ antidelete → Monitor message deletions
> 🔒 privacy → Configure privacy
> ⏳ disappear → Enable disappearing messages
> 🔄 resetwarn → Reset warnings

📦 *GROUP MANAGEMENT*

> � listgroup → List all groups
> 🏷️ tag → Hide tag mention user in way that they wont see name
> 📢 tagall → Mention all members
> 🔇 mute → Mute all chat to admin only
> 🔊 unmute → Unmute chat to allow all member to chat
> � lockinfo → Lock Group info
> 🔓 unlockinfo → Unlock group info
> ➕ add → Add members
> 👟 kick → Remove members
> ⬆️ promote → Promote to admin
> ⬇️ demote → Demote from admin
> 📊 poll → Create a poll
> 🔗 group link → Fetch invite link
> � group stats → Display group stats
> ♻️ group revoke → Revoke group invite link
> ℹ️ group info → See group details
> 📝 group desc <text> → Set group description
> 🖼️ group pic → Reply to image to set group picture
> 👻 listinactive → View inactive members
> 💥 destroy → Destroy the group
> 🏆 hall → Add user to Hall of Fame
> 🏆 fame → Hall of Fame
> � requestlist → List pending join requests
> ✅ acceptall → Accept all pending requests
> ❌ rejectall → Reject all pending requests
> 📝 copy → Copy members from one group to another

📁 *GREETING COMMANDS*

> � welcome → Configure welcome/goodbye messages


📁 *MEDIA*

> 📸 ss → Take screenshot of a webpage
> 🎨 imagine → Generate AI image
> 🎵 song → Download audio
> ▶️ play → Play music
> 🎬 video → Download video
> 📥 dstatus → Download a status by replying to it
> � yt → YouTube helper (download/search)
> � bg → Remove background from image
> �️ sticker → Convert image/video to sticker
> 🖼️ stimage → Sticker to image
> 🎞️ stgif → Sticker to GIF

⚽ *SPORTS*

> ⚽ football → Football commands | Get football news, search for teams, follow teams, list your followed teams

🎮 *GAMES*
> 🎮 game → Play word chain game with friends
> 🧠 trivia → Play trivia game with various categories
> ⚔️ rpg → Start or continue an adventure game

🔧 *UTILITIES*
> 📸 dp → Get profile picture of any WhatsApp user
> 📢 broadcast → Broadcast message to all groups Member and more
> 📌 status → Setup status view and status reactions
> 👁️ vv → Repost view-once media to chat
> 📤 view → Send view-once media to your DM
> 🟢 online → Configure bot presence (online/typing/recording)
> 👤 setprofile → Update bot profile (name, pic, bio, blocklist)
> 📝 report → Send a report
> 📰 news → Get the latest headlines from Google News
> 🌍 news <country> → Country news (e.g., news ng, news us, news uk)
> 🗑️ delete → Delete any message by replying to it both dm and group
> ❌ del → Delete any message by replying to it both dm and group
> ⏰ time → Get the current time in a specific country
> 🌐 translate → Translate text to another language
> 🎉 fun → See all fun commands
> 💬 chatbot → Chat with chatbot
> 🗨️ selfchat → Enable chatbot for self-chat only

🤖 *AI*

> 🤖 ai → Chat with AI
> 🧠 gpt → Chat with GPT
> 🦙 llama → Chat with Meta Llama AI
> 🌌 mistral → Chat with Mistral AI
> 🔮 deepseek → Chat with DeepSeek AI
> 🔮 ds → DeepSeek AI (alias)
> 🤖 bmm → Chat with BMM AI

🎨 *FUN*
> � fun → Show all fun commands

━━━━━━━━━━━━━━━━━━━━━━━━━━
🖥️ *EXECUTION MODE*: Reply with a command to run.
ℹ️ *Use help <command> for command details.*
⚠️ *Root access unlocks advanced privileges.*
©️ *2026 BMM V${v}. All rights reserved.*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Follow us on whatsapp channel click view channel
`;

const getFunMenu = (ownerName, mode, phoneNumber, prefix, version) => `
🎨 *FUN COMMANDS*
━━━━━━━━━━━━━━━━━━━━━━━━━━
> 👤 Operator: ${ownerName || 'Not Set'}
> ⚙️ Mode: ${mode ? mode.toUpperCase() : 'PRIVATE'}
> 📱 System ID: ${phoneNumber || 'Not Available'}
> 🔤 Prefix: ${prefix || 'Not Set'}
> 🧩 Firmware: v${version || '1.0.0'}
━━━━━━━━━━━━━━━━━━━━━━━━━━

> 🖼️ sticker → Convert image/video to sticker
> 🖼️ stimage → Sticker to image
> 🎞️ stgif → Sticker to GIF
> 😂 joke → Tell a joke
> 📚 fact → Tell a fact
> 💬 quote → Tell a quote
> 🎨 imagine → Generate AI image
> 👋 slap → Slap someone
> 🤗 hug → Hug someone
> 👟 kick → Kick someone
> 👉 poke → Poke someone
> ✅ tick → Tick someone
> 🔫 shoot → Shoot someone
> 🍴 feed → Feed someone
> 🐾 pat → Pat someone
> 💋 kiss → Kiss someone
> 😆 laugh → Laugh at someone
> 👅 lick → Lick someone
> 😊 blush → Blush at someone
> 🤷 shrug → Shrug at someone
> 😀 smile → Smile at someone
> 👀 stare → Stare at someone
> 💨 yeet → Yeet someone
> 🛌 cuddle → Cuddle someone
> ✋ highfive → High five someone
> 🤦 facepalm → Facepalm someone
> 🤔 think → Think at someone
> 😡 pout → Pout at someone
> 🦷 bite → Bite someone
> 😏 smug → Smug at someone
> 🐤 baka → Baka at someone
> 🤣 tickle → Tickle someone
> 😢 cry → Show a crying GIF
> 👋 wave → Wave with a GIF
> 😴 bored → Show a bored GIF
> 💃 dance → Show a dancing GIF
> 👍 thumbsup → Show a thumbs up GIF
> 🌐 translate → Translate text
> 🔊 echo → Echo back your message
`;
async function funMenu(sock, chatId, message, ownerName, mode, phoneNumber, groupId, prefix, authId) {
  const funMenuText = getFunMenu(ownerName, mode, phoneNumber, prefix, version);
  const contextInfo = {
    ...getContextInfo(),
    ...getForwardedContext()
  };
  const sent = await sock.sendMessage(chatId, {
    text: funMenuText,
    contextInfo,
    quoted: message
  });
}

async function menu(sock, chatId, message, ownerName, mode, phoneNumber, groupId, prefix, authId) {
  const v = version.split('.')[0];
  //console.log('Menu called with authId:', authId);
  
  // Get subscription info with proper error handling
 
  
  //console.log('Subscription info from getSubscriptionInfo:', subscription);
  
  const menuText = getMainMenu(
    ownerName, 
    mode, 
    phoneNumber, 
    groupId,
    prefix,
    version, 
    authId,
    v
  );
  //console.log('Generated menu text with subscription:', { 
  //  level: subscription.subscription_level, 
  //  days: subscription.daysLeft 
  //});
  const contextInfo = {
    ...getContextInfo(),
    ...getForwardedContext()
  };

  const sent = await sock.sendMessage(chatId, {
    text: menuText,
    contextInfo,
    quoted: message
  });

  const menuMsgId = sent.key.id;

  // Listener for user response after menu
  const listener = async (m) => {
    const { execute } = require('../commandHandler');
    const reply = m.messages?.[0];
    if (!reply || reply.key.remoteJid !== chatId) return;

    const quotedId = reply.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (quotedId !== menuMsgId) return;

    const text = reply.message?.conversation || reply.message?.extendedTextMessage?.text || '';
    const input = text.trim().toLowerCase();

    await execute({
      sock,
      msg: reply,
      textMsg: input,
      phoneNumber: null
    });

    sock.ev.off('messages.upsert', listener); // Remove listener after execution
  };

  sock.ev.on('messages.upsert', listener);
}

module.exports = { menu, funMenu };
