const modeCommand = require('./command/mode');
const prefixCommand = require('./command/prefix');
const handleAntilinkCommand = require('./features/antiLink');
const { getUserMode, isBotOwner, getUserPrefix } = require('../database/database');
const { getUserSettings } = require('../utils/settings');
const settingsCommand = require('./command/settings');
const resetWarnCommand = require('./command/resetWarnCommand');
const warnlistCommand = require('./command/warnlistCommand');
const handleAntideleteCommand = require('./command/antideleteCommand');
const listGroupsCommand = require('./command/listGroup');
const statusCommand = require('./command/statusCommand');
const welcomeCommand = require('./command/welcomeCommand');
const { viewOnceCommand } = require('./command/viewOnce');
const reactCommand = require('./command/reactCommand');
const { getReactToCommand } = require('../database/database');
const { getEmojiForCommand } = require('./features/commandEmoji');
const tagCommand = require('./command/tag');
const presenceCommand = require('./command/presenceCommand');
const setPrivacyCommand = require('./command/privacyCommand');
const setDisappearingCommand = require('./command/disappearing');
const setBotPrivacyCommand = require('./command/privacy2');
const infoCommand = require('./command/info');
const { handleSsCommand } = require('./command/ss');
const { convertStickerToImage, convertStickerToGif } = require('./command/stToImage');
const playCommand  = require('./command/playSong');  
const { imagine } = require('./command/imagine');
const songCommand = require('./command/song');
const { kickCommand } = require('./command/kick');
const { handleListInactiveCommand } = require('./command/groupStatsCommand');
const restartCommand = require('./command/restartCommand');
const {
  muteGroup,
  unmuteGroup,
  requestList,
  acceptAllRequests,
  rejectAllRequests,
  addUserToGroup, 
  lockGroupInfo,
  unlockGroupInfo,
  promoteUser,
  demoteUser,
  handleGroupCommand
} = require('./command/groupCommand');
const pollCommand = require('./command/poll');
const stickerCommand = require('./command/stikcer');
const { checkIfAdmin } = require('./command/kick');
const report = require('./command/report');
const helpCommand = require('./command/help');
const { downloadVideo } = require('./command/video');
const { logoutCommand } = require('./command/logout');
const aiCommand = require('./command/aiCommand');
const { clearChat } = require('./command/clearChat');
const funCommand = require('./command/funCommand');
const { downloadStatus } = require('./command/status');
const ytCommand = require('./command/yt');
const newsCommand = require('./command/news');
const factCommand = require('./command/fact');
const deleteMessageCommand = require('./command/deleteMessage');
const pingCommand = require('./command/ping');
const timeCommand = require('./command/timeCommand');
const {destroyGroupCommand} = require('./command/destroyGroup');
const { handleFootballCommand } = require('./command/football');
const { warnCommand } = require('./command/warn');
const { handleGameCommand } = require('./command/game');
const { handleTrivia } = require('./command/triviaGame');
const { handleAdventure } = require('./command/adventureGame');
const { handleBgRemoval } = require('./command/bg');










function getMatchedOwner(senderId, senderLid, botId, botLid) {
  if (senderId === botId || senderId === botLid) return senderId;
  if (senderLid && (senderLid === botId || senderLid === botLid)) return senderLid;
  return null;
}

async function execute({ authId, sock, msg, textMsg, phoneNumber }) {
  let from;
  try {
    from = msg.key.remoteJid;
    const jid = msg.key.fromMe ? msg.key.remoteJid : msg.key.participant || msg.key.remoteJid;
    const senderId = jid.split(':')[0].split('@')[0];
    const senderLid = jid.includes(':') ? jid.split(':')[1] : undefined;

    const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
    const botLid = sock.user?.lid?.split(':')[0];
    const botName = sock.user?.name || 'Bot';
    const prefix = getUserPrefix(botId);
    const mode = getUserMode(botId);
    const matchedOwner = getMatchedOwner(senderId, senderLid, botId, botLid);

    // Always define isGroup, isOwner, isAdmin
    const isGroup = from.endsWith('@g.us');
    const isOwner = !!matchedOwner;
    let isAdmin = false;
    if (isGroup) {
      isAdmin = await checkIfAdmin(sock, from, senderId);
    }

    // Permission checks for bot mode
    if (mode === 'private') {
      if (!msg.key.fromMe && !matchedOwner) {
        return; // allow only bot itself or owner in private mode
      }
    }
    if (mode === 'admin') {
      if (isGroup) {
        if (!isAdmin && !isOwner) {
          return;
        }
      } else {
        if (!isOwner && !msg.key.fromMe) {
          return;
        }
      }
    }

    let args;
    let command;

    if (textMsg.startsWith(prefix)) {
      args = textMsg.slice(prefix.length).trim().split(/\s+/);
      command = args.shift().toLowerCase();
    } else {
      args = textMsg.trim().split(/\s+/);
      command = args.shift().toLowerCase();
    }

    if (getReactToCommand(botId)) {
      const emoji = getEmojiForCommand(command);
      await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
      console.log(`🔄 Reacted with emoji: ${emoji} for command: ${command}`);
    }

    // Command switch
    switch (command) {
      case 'help':
        await helpCommand(sock, msg, textMsg, prefix, isAdmin, isOwner);
        break;
      case 'menu':
        const { menu } = require('./command/menu');
        await menu(sock, from, msg, botName, mode, botId, botLid, prefix, authId);
        break;
      case 'ai':
      case 'gpt':
      case 'llama':
      case 'mistral':
      case 'deepseek':
      case 'ds':
          await aiCommand(sock, from, msg, { prefix, args, command });
          break;  
      case 'ping':
        await pingCommand(authId, sock, msg);
        break;
      case 'settings':
        await settingsCommand(authId, sock, msg);
        break;
      case 'prefix':
        await prefixCommand(sock, msg, textMsg, phoneNumber);
        break;
      case 'mode':
        await modeCommand(sock, msg, textMsg, phoneNumber);
        break;
      case 'antilink':
        await handleAntilinkCommand(sock, msg, phoneNumber);
        break;
      case 'resetwarn':
        await resetWarnCommand(sock, msg, textMsg);
        break;
      case 'warn':
        await warnCommand(sock, msg, args);
        break;
      case 'warnlist':
      case 'listwarn':
        await warnlistCommand(sock, msg);
        break;
      case 'antidelete':
        await handleAntideleteCommand(sock, msg, phoneNumber);
        break;
      case 'listgroup':
        await listGroupsCommand(sock, msg);
        break;
      case 'status':
        await statusCommand(sock, msg);
        break;
      case 'welcome':
        await welcomeCommand(sock, msg);
        break;
      case 'vv':
      case 'view':
        await viewOnceCommand(sock, msg, command);
        break;
      case 'react':
        await reactCommand(sock, msg, textMsg);
        break;
      case 'tag':
      case 'tagall':
      case 'admin':
        await tagCommand(sock, msg, command, args);
        break;
      case 'online':
        await presenceCommand(sock, msg, args);
        break;
      case 'privacy':
        await setPrivacyCommand(sock, msg, phoneNumber);
        break;
      case 'disappear':
      case 'disappearing':
        await setDisappearingCommand(sock, msg);
        break;
      case 'setprofile':
        await setBotPrivacyCommand(sock, msg);
        break;
      case 'info':
        await infoCommand(sock, msg);
        break;
      case 'mute':
        await muteGroup(sock, msg, senderId);
        break;
      case 'unmute':
        await unmuteGroup(sock, msg, senderId);
        break;
      case 'poll':
        await pollCommand(sock, msg, textMsg);
        break;
      case 'requestlist':
        await requestList(sock, msg, phoneNumber);
        break;
      case 'acceptall':
        await acceptAllRequests(sock, msg, phoneNumber);
        break;
      case 'rejectall':
        await rejectAllRequests(sock, msg, phoneNumber);
        break;
      case 'lockinfo':
        await lockGroupInfo(sock, msg, phoneNumber);
        break;
      case 'unlockinfo':
        await unlockGroupInfo(sock, msg, phoneNumber);
        break;
      case 'add':
        await addUserToGroup(sock, msg, phoneNumber);
        break;
      case 'promote':
        await promoteUser(sock, msg, phoneNumber);
        break;
      case 'demote':
        await demoteUser(sock, msg, phoneNumber);
        break;
      case 'group':
        await handleGroupCommand(sock, msg, botId);
        break;
      case 'sticker':
        await stickerCommand(sock, msg);
        break;
      case 'ss':
      case 'ssweb':
      case 'screenshot':
        await handleSsCommand(sock, from, msg, args[0]);
        break;
      case 'stimage':
        await convertStickerToImage(sock, msg, from);
        break;
      // case 'stgif':
      //   await convertStickerToGif(sock, msg, from);
      //   break;
      case 'play':
        await playCommand(sock, from, msg, { prefix, args });
        break;
      case 'imagine':
        await imagine(sock, msg, command, args, from);
        break;
      case 'song':
        await songCommand(sock, from, msg, { prefix, args });
        break;
      case 'kick':
        await kickCommand(sock, msg, command, args, from);
        break;
      case 'listinactive':
        await handleListInactiveCommand(sock, from);
        break;
      case 'report':
        await report.execute({ sock, msg, textMsg, args });
        break;
      case 'restart':
        await restartCommand(authId, sock, msg);
        break;
      case 'logout':
        await logoutCommand(authId, sock, msg, );
        break;
      case 'video':
        await downloadVideo(sock, from, msg, args );
        break;
      case 'clear':
        await clearChat(sock, from, msg);
        break;
        case 'slap': case 'hug': case 'kick': case 'poke': case 'tickle':
          case 'cry': case 'pat': case 'kill': case 'kiss': case 'wave':
          case 'blush': case 'shrug': case 'smile': case 'laugh':
          case 'lick': case 'bored': case 'stare': case 'yeet': case 'feed':
          case 'dance': case 'cuddle': case 'highfive': case 'facepalm':
          case 'thumbsup': case 'think': case 'shoot': case 'pout':
          case 'bite': case 'smug': case 'baka': case 'quote': case 'joke': case 'translate':
          await funCommand(sock, from, msg, command, args);
          break;
        case 'dstatus':
          await downloadStatus(sock, msg, isOwner, from, prefix);
          break;
        case 'yt':
          await ytCommand(sock, from, msg, {prefix, args,});
          break;
        case 'news':
          await newsCommand(sock, from, msg, {prefix, args,});
          break;
        case 'fact':
          await factCommand(sock, from, msg, {prefix, args,});
          break;
        case 'delete':
        case 'del':
          await deleteMessageCommand(sock, from, msg);
          break;
        case 'time':
          await timeCommand(sock, from, msg, args);
          break;
        case 'destroy':
          await destroyGroupCommand(sock, msg, command, args, from);
          break;
        case 'football':
          await handleFootballCommand({ 
            sock, 
            msg, 
            from, 
            textMsg, 
            prefix, 
            userId: phoneNumber,  // Use phoneNumber as the user ID
          });
          break;
       // Add game command to switch case
      case 'game':
        await handleGameCommand(sock, msg, args,);
        break;
      case 'trivia':
        await handleTrivia(sock, msg, args);
        break;
      // case 'rpg':
      //   await handleAdventure(sock, msg, args);
      //   console.log('Adventure command executed');
      //   break;
      case 'bg':
        await handleBgRemoval(sock, msg);
        break;
      default:
        await sock.sendMessage(from, { text: `❌ Unknown command: *${command}*\nType *${getUserPrefix(phoneNumber)}menu* for a list of commands.` });
        break;
    }
  } catch (err) {
    console.error('❌ Command error:', err);
    // await sendToChat(sock, from, {
    //   message: `❌ Error: ${err.message || err.toString()}`
    // });
  }
}

module.exports = { execute };
