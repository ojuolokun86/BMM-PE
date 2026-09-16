const { botStartTimes } = require('../../utils/globalStore');
const { version } = require('../../../package.json');
const { getContextInfo, getForwardedContext } = require('../../utils/contextInfo');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const reactionEmojis = ['⚡', '🚀', '🔥', '✨', '💨'];

function formatUptime(totalSeconds) {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

async function checkForUpdates() {
  const currentVersion = `v${version}`;

  try {
    // Get tags directly from the remote without changing local tags.
    const { stdout } = await execPromise(
      'git ls-remote --tags --refs origin'
    );

    const remoteVersions = stdout
      .split('\n')
      .map(line => {
        const match = line.match(/refs\/tags\/(v\d+\.\d+\.\d+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    if (!remoteVersions.length) {
      throw new Error('No version tags found on remote');
    }

    // Compare semantic versions properly
    remoteVersions.sort((a, b) => {
      const av = a.slice(1).split('.').map(Number);
      const bv = b.slice(1).split('.').map(Number);

      for (let i = 0; i < 3; i++) {
        if (av[i] !== bv[i]) {
          return bv[i] - av[i];
        }
      }

      return 0;
    });

    const latestVersion = remoteVersions[0];

    return {
      hasUpdate: latestVersion !== currentVersion,
      current: currentVersion,
      latest: latestVersion
    };

  } catch (error) {
    console.error('Error checking for updates:', error);

    return {
      hasUpdate: false,
      current: currentVersion,
      latest: currentVersion
    };
  }
}

async function pingCommand(authId, sock, msg) {
  const v = version.split('.')[0];
  const chatId = msg?.key?.remoteJid;
  const botId = sock?.user?.id?.split(':')[0]?.split('@')[0];
  const botName = `BMM V${v} ENGINE`;
  const ownerName = sock.user.name;
  const randomEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];

  // Measure round-trip ping with a minimal direct send
  const t0 = Date.now();
  await sock.sendMessage(chatId, {
    text: `🏓✨ Pong! ${randomEmoji}`,
    mentions: []
  }, { quoted: msg });

  const ping = Math.round((Date.now() - t0) / 2);

  // Per-bot uptime
  if (botId && !botStartTimes[botId]) botStartTimes[botId] = Date.now();
  const startTs = (botId && botStartTimes[botId]) ? botStartTimes[botId] : Date.now();
  const uptime = formatUptime((Date.now() - startTs) / 1000);
  const contextInfo = {
    ...getContextInfo(),
    ...getForwardedContext()
  };
  // Check for updates
  const updateInfo = await checkForUpdates();
  
  // Build status message
  let statusMessage = [
    `╭─ BMM V${v} ─────────╮`,
    `│ • Ping: ${ping}ms ⚡`,
    `│ • Uptime: ${uptime}`,
    `│ • Version: v${version}`,
    `│ • Bot: ${botName}`,
    `│ • Owner: ${ownerName || '—'}`,
    '╰─ ✅ Running ───────╯'
  ];
  
  // Add update information
  if (updateInfo.hasUpdate) {
    statusMessage.push(`\n🔄 **Update Available!**`);
    statusMessage.push(`Current: ${updateInfo.current}`);
    statusMessage.push(`Latest: ${updateInfo.latest}`);
    statusMessage.push(`Run \`.update bot\` to update`);
  } else {
    statusMessage.push(`\n✅ Bot is up to date (${updateInfo.current})`);
  }
  
  statusMessage.push('\n> Note: Subscription is active and fully functional.');
  statusMessage.push(`> ©️ 2026 BMM V${v}. All rights reserved.`);
  
  const text = statusMessage.join('\n');

  // Final styled message via sendToChat so your context/forwarding/quoted applies
  await sock.sendMessage(chatId, { text, contextInfo }, { quoted: msg });
}

module.exports = pingCommand;