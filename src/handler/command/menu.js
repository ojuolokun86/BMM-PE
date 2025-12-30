const sendToChat = require('../../utils/sendToChat');
const { getContextInfo, getForwardedContext } = require('../../utils/contextInfo');
const { version } = require('../../../package.json');


const getMainMenu = (
  ownerName = 'Unknown',
  mode = 'private',
  phoneNumber = 'Unknown',
  groupId = 'Unknown',
  prefix = 'Unknown',
  version = 'Unknown',
  authId = 'Unknown',
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
> 🔀 mode → Switch system mode
> 📖 help → Command manual
> 🗂️ menu → Display system menu
> 🖥️ info → System information
> 🔄 restart → Reboot system
> 🚪 logout → Logout session
> 😎 react → React to commands
> 📊 disk → Show storage & memory info

🛡️ *MODERATION & SECURITY*

> 🔗 antilink → Block external links
> 📋 warnlist → View warnings
> 🕵️ antidelete → Monitor message deletions
> 🔒 privacy → Configure privacy
> ⏳ disappear → Enable disappearing messages

📦 *GROUP MANAGEMENT*

> 📑 listgroup → List all groups
> 🏷️ tag → hide tag mention user in way that they wont see name
> 📢 tagall → Mention all members
> 🔇 mute → mute all chat to admin only
> 🔊 unmute → Unmute chat to allow all member to chat
> 🔐 lockinfo → Lock Group info
> 🔓 unlockinfo →  unlock group info
> ➕ add → Add members
> ➖ kick → remove members
> 🤖 warn →  Warn a user in a group by mention or reply to their message
> ®️ resetwarn → Reset warnings
> ⬆️ promote →  Promote to admin
> ⬇️ demote → Demote from admin
> 📊 poll → Create a poll
> 🔗 group link → Fetch invite link
> 📈 group stats → Display group stats
> ♻️ group revoke → Revoke group invite link
> ℹ️ group info → See group details
> 📝 group desc <text> → Set group description
> 🖼️ group pic → Reply to image to set group picture
> 👻 listinactive → View inactive members
> 💥 destroy → Destroy the group

📁 *MEDIA*

> 📸 ss → Take screenshot of a webpage
> 🎨 imagine → Generate AI image
> 🎵 song → Download audio
> ▶️ play → Play music
> 🎬 video → Download video
> 📥 dstatus → Download a status by replying to it
> 📹 yt video → Download a video from YouTube
> 🎧 yt audio → Download an audio from YouTube
> 🔍 yt search → Search YouTube videos or songs
> 🖼️ bg → Remove background from image

⚽ *SPORTS*

> ⚽ football → Football commands | Get football news, search for teams, follow teams, list your followed teams

🎮 *GAME*
> 🎮 game wordchain → Start a word chain game in group
> 🎯 trivia → start Trivia Game

🔧 *UTILITIES*

> 📌 status → To setup status view and status reactions
> 👁️ vv → View once media
> 📤 view → Send View once to your DM
> 🟢 online → Show online members
> 👤 setprofile → Update profile
> 📝 report → Send a report
> 📰 news → Get the latest headlines from Google News
> 🌍 news <country> → Country news (e.g., news ng, news us, news uk)
> 🗑️ delete → Delete any message by replying to it both dm and group
> ❌ del → Delete any message by replying to it both dm and group
> ⏰ time → Get the current time in a specific country
> 🧹 clear → Clear all messages in a chat {works in both dm and group chat}

🤖 *AI*

> 🤖 ai → Chat with AI
> 🧠 gpt → Chat with GPT
> 🦙 llama → Chat with Meta Llama AI
> 🌌 mistral → Chat with Mistral AI
> 🔮 deepseek → Chat with DeepSeek V3 AI

🎨 *FUN*

> 🪄 sticker → Convert image/video to sticker
> 🖼️ stimage → Sticker to image
> 🎞️ stgif → Sticker to GIF
> ⚔️ kill → Kill someone
> 🤗 hug → Hug someone
> 😂 joke → Tell a joke
> 📚 fact → Tell a fact
> 💬 quote → Tell a quote
> 🎨 imagine → Generate AI image
> 👋 slap → Slap someone
> 🤗 hug → Hug someone
> 🦵 kick → Kick someone
> 👉 poke → Poke someone
> ✅ tick → Tick someone
> 🔫 shoot → Shoot someone
> 🍴 feed → Feed someone
> 🐾 pat → Pat someone
> ⚔️ kill → Kill someone
> 💋 kiss → Kiss someone
> 😆 laugh → Laugh at someone
> 🍅 lick → lick someone
> 😊 blush → blush at someone
> 🤷 shrug → shrug at someone
> 😀 smile → smile at someone
> 👀 stare → stare at someone
> 💨 yeet → yeet someone
> 🛌 cuddle → cuddle someone
> ✋ highfive → highfive someone
> 🤦 facepalm → facepalm someone
> 🤔 think → think at someone
> 😡 pout → pout at someone
> 🦷 bite → bite someone
> 😏 smug → smug at someone
> 🐤 baka → baka at someone
> 🌐 translate → Translate text

━━━━━━━━━━━━━━━━━━━━━━━━━━
🖥️ *EXECUTION MODE*: Reply with a command to run.
ℹ️ *Use help <command> for command details.*
⚠️ *Root access unlocks advanced privileges.*
©️ *2025 BMM V2. All rights reserved.*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Follow us on whatsapp channel click view channel
`;



async function menu(sock, chatId, message, ownerName, mode, phoneNumber, groupId, prefix, authId) {
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

module.exports = { menu };
