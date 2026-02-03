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
  disk: '💾',
  react: '😊',

  // Moderation & Security
  antilink: '🔗',
  link: '🔗',
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
  hall: '🏆',
  fame: '🏆',
  requestlist: '📋',
  acceptall: '✅',
  rejectall: '❌',
  welcome: '👋',

  // Media & Fun
  sticker: '🖼️',
  stimage: '🖼️',
  sttoimg: '🖼️',
  stgif: '🎞️',
  ss: '📸',
  screenshot: '📸',
  imagine: '🎨',
  song: '🎵',
  play: '▶️',
  video: '🎬',
  dstatus: '📥',
  'yt video': '📹',
  'yt audio': '🎧',
  'yt search': '🔍',
  yt: '📺',
  bg: '🎨',

  // Sports
  football: '⚽',

  // Games
  game: '🎮',
  chain: '🔗',
  wordgame: '📝',
  trivia: '🧠',
  rpg: '⚔️',
  adv: '🗺️',
  adventure: '🗺️',

  // Utilities
  status: '📌',
  vv: '👁️',
  view: '📤',
  online: '🟢',
  setprofile: '👤',
  report: '📝',
  news: '📰',
  translate: '🌐',
  npm: '📦',
  update: '🔄',
  contacts: '📇',
  fun: '🎉',
  broadcast: '📢',
  chatbot: '💬',
  echo: '🔊',

  // AI
  ai: '🤖',
  gpt: '🧠',
  llama: '🦙',
  mistral: '🌌',
  deepseek: '🔮',
  ds: '🔮',

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
  baka: '🐤',
  fun_kick: '👟',
  tickle: '🤣',
  cry: '😢',
  wave: '👋',
  bored: '😴',
  dance: '💃',
  thumbsup: '👍'
};

const randomEmojis = ['🤖', '✨', '🎲', '🚀', '💡', '🎯', '🧠', '🎉', '⚙️', '💥'];

function getEmojiForCommand(command) {
  return (
    commandEmojis[command] ||
    randomEmojis[Math.floor(Math.random() * randomEmojis.length)]
  );
}

module.exports = { getEmojiForCommand };
