const sendToChat = require('../../utils/sendToChat');
const { botStartTimes } = require('../../utils/globalStore');
const { version } = require('../../../package.json');
const { getContextInfo, getForwardedContext } = require('../../utils/contextInfo');

const reactionEmojis = ['⚡', '🚀', '🔥', '✨', '💨'];

function formatUptime(totalSeconds) {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

async function pingCommand(authId, sock, msg) {
  const chatId = msg?.key?.remoteJid;
  const botId = sock?.user?.id?.split(':')[0]?.split('@')[0];
  const botName = 'BMM V2 ENGINE';
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
  const startTs = botStartTimes[botId] || Date.now();
  const uptime = formatUptime((Date.now() - startTs) / 1000);
  const contextInfo = {
    ...getContextInfo(),
    ...getForwardedContext()
  };

  const text = [
    '╭─ BMM V2 ─────────╮',
    `│ • Ping: ${ping}ms ⚡`,
    `│ • Uptime: ${uptime}`,
    `│ • Version: v${version}`,
    `│ • Bot: ${botName}`,
    `│ • Owner: ${ownerName || '—'}`,
    '╰─ ✅ Running ───────╯',
    '> Note: Subscription is active and fully functional.',
    '> ©️ 2025 BMM V2. All rights reserved.'
  ].join('\n');

  // Final styled message via sendToChat so your context/forwarding/quoted applies
  await sock.sendMessage(chatId, { text, contextInfo }, { quoted: msg });
}

module.exports = pingCommand;