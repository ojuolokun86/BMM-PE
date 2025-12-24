const commandEmojis = {
  // Core Commands
  ping: '🏓',
  settings: '⚙️',
  prefix: '🔤',
  mode: '🔄',
  help: '📖',
  menu: '📋',
  info: 'ℹ️',
  restart: '🔄',
  logout: '🚪',
  clear: '🧹',
  delete: '🗑️',
  del: '❌',
  time: '⏰',

  // Moderation & Security
  antilink: '🔗',
  resetwarn: '🔄',
  warnlist: '📋',
  antidelete: '🗑️',
  privacy: '🔒',
  disappear: '⏳',

  // Group Management
  listgroup: '📋',
  tag: '🏷️',
  tagall: '📢',
  mute: '🔇',
  unmute: '🔊',
  lockinfo: '🔒',
  unlockinfo: '🔓',
  add: '➕',
  kick: '👟',
  promote: '⬆️',
  demote: '⬇️',
  poll: '📊',
  'group link': '🔗',
  'group stats': '📊',
  'group revoke': '♻️',
  'group info': 'ℹ️',
  'group desc': '📝',
  'group pic': '🖼️',
  listinactive: '👻',
  destroy: '💥',

  // Media & Fun
  sticker: '🖼️',
  stimage: '🖼️',
  stgif: '🎞️',
  ss: '📸',
  imagine: '🎨',
  song: '🎵',
  play: '▶️',
  video: '🎬',
  dstatus: '📥',
  'yt video': '📹',
  'yt audio': '🎧',
  'yt search': '🔍',

  // Utilities
  status: '📌',
  vv: '👁️',
  view: '📤',
  online: '🟢',
  setprofile: '👤',
  report: '📝',
  news: '📰',
  translate: '🌐',
  football: '⚽',

  // AI
  ai: '🤖',
  gpt: '🧠',
  llama: '🦙',
  mistral: '🌌',
  deepseek: '🔮',

  // Fun Commands
  kill: '⚔️',
  hug: '🤗',
  joke: '😂',
  fact: '📚',
  quote: '💬',
  slap: '👋',
  poke: '👉',
  tick: '✅',
  shoot: '🔫',
  feed: '🍴',
  pat: '🐾',
  kiss: '💋',
  laugh: '😆',
  lick: '👅',
  blush: '😊',
  shrug: '🤷',
  smile: '😀',
  stare: '👀',
  yeet: '💨',
  cuddle: '🛌',
  highfive: '✋',
  facepalm: '🤦',
  think: '🤔',
  pout: '😡',
  bite: '🦷',
  smug: '😏',
  baka: '🐤'
};

const randomEmojis = ['🤖', '✨', '🎲', '🚀', '💡', '🎯', '🧠', '🎉', '⚙️', '💥'];

function getEmojiForCommand(command) {
  return (
    commandEmojis[command] ||
    randomEmojis[Math.floor(Math.random() * randomEmojis.length)]
  );
}

module.exports = { getEmojiForCommand };
