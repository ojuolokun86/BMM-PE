const sendToChat = require('../../utils/sendToChat');
const { getUserSettings } = require('../../utils/settings');
const{ isBotOwner } = require('../../database/database')
module.exports = async function settingsCommand(authId, sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const senderId = sender?.split('@')[0];
  const name = sock.user?.name;
  if (!msg.key.fromMe && !isBotOwner(senderId, botId, botLid)) {
    return await sock.sendMessage(from, {
      text: `❌ Only *${name}* can view this bot settings.`
    });
  }
  const settings = await getUserSettings(authId, botId, from); // botId = user_id, from = groupId
  const antilink = settings.antilink || {};
  const antidelete = settings.antidelete || {};
  const mode = settings.mode || "unknown";
  const prefix = settings.prefix || ".";
  const owner = settings.ownerName || name;
  const commandReact = settings.commandReact
  const welcomeSettings = settings.welcomeSettings || {};
  const followedTeams = settings.userFollowedTeams || [];
  const version = settings.botVersion;
  
  // Format subscription text

  let welcomeText = "Not configured";
  if (typeof welcomeSettings.welcome === 'boolean' && typeof welcomeSettings.goodbye === 'boolean') {
    welcomeText = `Welcome: ${welcomeSettings.welcome ? "🟢 ON" : "🔴 OFF"}\nGoodbye: ${welcomeSettings.goodbye ? "🟢 ON" : "🔴 OFF"}`;
  }
  let antideleteText = "Not configured";
  let forwardStatus = "";
  if (antidelete.mode) {
    if (antidelete.mode === 'off') antideleteText = "❌ Disabled";
    else if (antidelete.mode === 'chat') antideleteText = "💬 Private Chats Only";
    else if (antidelete.mode === 'group') antideleteText = "👥 Group Chats Only";
    else if (antidelete.mode === 'both') antideleteText = "🔁 All Chats & Groups";
    
    // Add DM forwarding status if antidelete is enabled
    if (antidelete.mode !== 'off' && antidelete.sendToOwner !== undefined) {
      forwardStatus = `\n   - DM Forwarding: ${antidelete.sendToOwner ? '✅ ON' : '❌ OFF'}`;
    }
  }
  let statusView = "Not configured";
  if (typeof settings.statusView === 'number') {
    if (settings.statusView === 0) statusView = "Off";
    else if (settings.statusView === 1) statusView = "View Only";
    else if (settings.statusView === 2) statusView = "View & React";
  }

  // Format followed teams
  let teamText = "❌ No teams followed yet";
  if (followedTeams && followedTeams.length > 0) {
    teamText = followedTeams
      .map((team, index) => {
        const teamName = team.name || 'Unknown Team';
        const teamId = team.id ? `(ID: ${team.id})` : '';
        return `⚽ ${index + 1}. ${teamName} ${teamId}`;
      })
      .join('\n');
  }

  

  // Format 3: Simple Style
  const formatRobotic = () => `
⚙️ *BOT SETTINGS REPORT*

� *Auth ID*: ${authId}
� *Owner*: ${owner}
� *Mode*: ${mode}
� *Prefix*: ${prefix}
� *Status View*: ${statusView}
${version ? `� *Version*: ${version}` : ''}
✨ *Command React*: ${commandReact ? '✅ ON' : '❌ OFF'}

🛡️ *Anti-link*: ${antilink?.enabled ? '✅ ON' : '❌ OFF'}
${antilink?.enabled ? `   - Action: ${antilink.action || 'warn'}
   - Excluded: ${antilink.excluded?.length || 0} groups` : ''}

🛡️ *Anti-delete*: ${antideleteText}${forwardStatus}

� *Welcome/Goodbye*: ${welcomeText}

⚽ *Followed Teams*:
${teamText}

� *Note*: Use commands to modify these settings
`;

  

  // Pick a random format
  const formats = [formatRobotic];
  const randomFormat = formats[Math.floor(Math.random() * formats.length)];
  const text = randomFormat();

  await sock.sendMessage(from, { text });
  //console.log("Settings sent to", from, "with text:", text);
};
