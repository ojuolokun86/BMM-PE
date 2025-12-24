// src/commands/commandRegistry.js
const { version } = require('../../../package.json');

/*
  Central command registry matching the menu structure.
  - Use the command objects here (no duplicated keys for different meanings).
  - Add aliases within the command entry via `aliases: []`.
  - export: commandRegistry, commandsByCategory, categoryOrder, version, registerCommand
*/

// Menu category order (used by help/menu)
const categoryOrder = [
  'Core',
  'Moderation',
  'Group',
  'Media',
  'Sports',
  'Games',
  'Utilities',
  'AI',
  'Fun',
  'Features',
  'Settings'
];

// Base registry (primary command names only)
const commandRegistry = {
  // Core (Bot Control)
  restart: {
    description: 'Reboot system',
    usage: 'restart',
    category: 'Core',
    ownerOnly: true
  },
  ping: {
    description: 'Check bot responsiveness',
    usage: 'ping',
    category: 'Core'
  },
  settings: {
    description: 'Configure system settings',
    usage: 'settings',
    category: 'Core',
    ownerOnly: true
  },
  prefix: {
    description: 'Change command prefix',
    usage: 'prefix <new_prefix>',
    category: 'Core',
    ownerOnly: true
  },
  mode: {
    description: 'Switch system mode',
    usage: 'mode [public|private|admin]',
    category: 'Core',
    ownerOnly: true
  },
  help: {
    description: 'Command manual',
    usage: 'help [command]',
    category: 'Core',
    aliases: ['h', 'ajuda']
  },
  menu: {
    description: 'Display system menu',
    usage: 'menu',
    category: 'Core'
  },
  info: {
    description: 'System information',
    usage: 'info',
    category: 'Core'
  },
  logout: {
    description: 'Logout session',
    usage: 'logout',
    category: 'Core',
    ownerOnly: true
  },
  react: {
    description: 'React to commands',
    usage: 'react [on|off]',
    category: 'Core',
    ownerOnly: true
  },

  // Moderation & Security
  antilink: {
    description: 'Block external links',
    usage: 'antilink [on|off]',
    category: 'Moderation',
    adminOnly: true
  },
  antidelete: {
    description: 'Monitor message deletions',
    usage: 'antidelete [on|off]',
    category: 'Moderation',
    adminOnly: true
  },
  warnlist: {
    description: 'View warnings list',
    usage: 'warnlist',
    category: 'Moderation',
    adminOnly: true
  },
  resetwarn: {
    description: 'Reset warnings for a user or all',
    usage: 'resetwarn @user | resetwarn all',
    category: 'Moderation',
    ownerOnly: true
  },

  // Group Management
  listgroup: {
    description: 'List all groups the bot is in',
    usage: 'listgroup',
    category: 'Group',
    ownerOnly: true
  },
  group: {
    description: 'Group management commands (link, stats, info, desc, pic, revoke)',
    usage: 'group <subcommand>',
    category: 'Group',
    adminOnly: true
  },
  tag: {
    description: 'Mention all group members (hide tag style if supported)',
    usage: 'tag [message]',
    category: 'Group',
    adminOnly: true
  },
  tagall: {
    description: 'Mention all group members with stats',
    usage: 'tagall [message]',
    category: 'Group',
    adminOnly: true
  },
  add: {
    description: 'Add a user to the group',
    usage: 'add <number>',
    category: 'Group',
    adminOnly: true
  },
  kick: {
    description: 'Kick a user or members (admin only)',
    usage: 'kick @user | kick members | kick inactive',
    category: 'Group',
    adminOnly: true
  },
  promote: {
    description: 'Promote a user to admin',
    usage: 'promote @user',
    category: 'Group',
    adminOnly: true
  },
  demote: {
    description: 'Demote a user from admin',
    usage: 'demote @user',
    category: 'Group',
    adminOnly: true
  },
  mute: {
    description: 'Mute group (announcement only)',
    usage: 'mute',
    category: 'Group',
    adminOnly: true
  },
  unmute: {
    description: 'Unmute group (allow all members)',
    usage: 'unmute',
    category: 'Group',
    adminOnly: true
  },
  lockinfo: {
    description: 'Lock group info (admins only)',
    usage: 'lockinfo',
    category: 'Group',
    adminOnly: true
  },
  unlockinfo: {
    description: 'Unlock group info (all members)',
    usage: 'unlockinfo',
    category: 'Group',
    adminOnly: true
  },
  requestlist: {
    description: 'List pending group join requests',
    usage: 'requestlist',
    category: 'Group',
    adminOnly: true
  },
  acceptall: {
    description: 'Accept all pending join requests',
    usage: 'acceptall',
    category: 'Group',
    adminOnly: true
  },
  rejectall: {
    description: 'Reject all pending join requests',
    usage: 'rejectall',
    category: 'Group',
    adminOnly: true
  },
  listinactive: {
    description: 'List inactive members (no messages in 30 days)',
    usage: 'listinactive',
    category: 'Group',
    adminOnly: true
  },
  destroy: {
    description: 'Destroy this current group',
    usage: 'destroy',
    category: 'Group',
    adminOnly: true
  },
  // group-specific utilities mentioned in menu
  'group-link': {
    description: 'Fetch group invite link',
    usage: 'group link',
    category: 'Group',
    adminOnly: true
  },
  'group-stats': {
    description: 'Display group stats',
    usage: 'group stats',
    category: 'Group',
    adminOnly: true
  },

  // Media
  ss: {
    description: 'Take screenshot of a webpage',
    usage: 'ss <url>',
    category: 'Media',
    aliases: ['ssweb', 'screenshot']
  },
  imagine: {
    description: 'Generate AI image',
    usage: 'imagine <prompt>',
    category: 'Media'
  },
  song: {
    description: 'Download a song from YouTube',
    usage: 'song [name or link]',
    category: 'Media'
  },
  play: {
    description: 'Play a song from YouTube',
    usage: 'play [song name]',
    category: 'Media'
  },
  video: {
    description: 'Download video from url',
    usage: 'video <url>',
    category: 'Media'
  },
  yt: {
    description: 'YouTube helper (download/search)',
    usage: 'yt [video|audio|search] <query or url>',
    category: 'Media'
  },
  dstatus: {
    description: 'Download a status by replying to it',
    usage: 'dstatus (reply)',
    category: 'Media'
  },
  stimage: {
    description: 'Convert sticker to image',
    usage: 'stimage (reply)',
    category: 'Media'
  },
  sttoimg: {
    description: 'Alias for stimage',
    usage: 'sttoimg (reply)',
    category: 'Media'
  },
  stgif: {
    description: 'Convert animated sticker to GIF',
    usage: 'stgif (reply)',
    category: 'Media'
  },
  sticker: {
    description: 'Create sticker from image/video/GIF',
    usage: 'sticker (reply to image/video/GIF)',
    category: 'Media'
  },

  // Sports
  football: {
    description: 'Football commands & news',
    usage: 'football [search|follow|myteams|help]',
    category: 'Sports'
  },

  // Games
  game: {
    description: 'Play word chain game with friends',
    usage: 'game [wordchain|start|end]',
    category: 'Games',
    aliases: ['chain', 'wordgame']
  },
  trivia: {
    description: 'Play trivia game with various categories',
    usage: 'trivia [start|join|stop] [category] [difficulty]',
    category: 'Games'
  },
  rpg: {
    description: 'Start or continue an adventure game (dm or group)',
    usage: 'rpg [start|help|action]',
    category: 'Games',
    aliases: ['adv', 'adventure']
  },

  // Utilities
  status: {
    description: 'Setup status view and status reactions',
    usage: 'status [on|off]',
    category: 'Utilities'
  },
  vv: {
    description: 'Repost view-once media to chat',
    usage: 'vv (reply)',
    category: 'Utilities'
  },
  view: {
    description: 'Send view-once media to your DM',
    usage: 'view (reply)',
    category: 'Utilities'
  },
  online: {
    description: 'Configure bot presence (online/typing/recording)',
    usage: 'online [on|off]',
    category: 'Utilities',
    ownerOnly: true
  },
  setprofile: {
    description: 'Update bot profile (name, pic, bio, blocklist)',
    usage: 'setprofile',
    category: 'Utilities',
    ownerOnly: true
  },
  report: {
    description: 'Report an issue to the developers',
    usage: 'report [message]',
    category: 'Utilities'
  },
  news: {
    description: 'Get the latest headlines from Google News',
    usage: 'news [country]',
    category: 'Utilities'
  },
  delete: {
    description: 'Delete a message (admin/owner only)',
    usage: 'delete <message_id>',
    category: 'Utilities',
    ownerOnly: true
  },
  del: {
    description: 'Alias for delete',
    usage: 'del <message_id>',
    category: 'Utilities',
    ownerOnly: true
  },
  clear: {
    description: 'Clear all messages in a chat',
    usage: 'clear',
    category: 'Utilities',
    ownerOnly: true
  },
  time: {
    description: 'Get current time in a country',
    usage: 'time [country]',
    category: 'Utilities'
  },
  poll: {
    description: 'Create a poll',
    usage: 'poll <question> | <option1> | <option2> ...',
    category: 'Utilities',
    adminOnly: true
  },
  bg: {
    description: 'Remove background from image',
    usage: 'Reply to an image with .bg',
    category: 'Media'
  },

  // AI
  ai: {
    description: 'Chat with AI',
    usage: 'ai <message>',
    category: 'AI'
  },
  gpt: {
    description: 'Chat with GPT',
    usage: 'gpt <message>',
    category: 'AI'
  },
  llama: {
    description: 'Chat with Meta Llama AI',
    usage: 'llama <message>',
    category: 'AI'
  },
  mistral: {
    description: 'Chat with Mistral AI',
    usage: 'mistral <message>',
    category: 'AI'
  },
  deepseek: {
    description: 'Chat with DeepSeek V3 AI',
    usage: 'deepseek <message>',
    category: 'AI',
    aliases: ['ds']
  },

  // Fun (interactive / memes / gifs)
  sticker_fun: {
    description: 'Convert image/video to sticker (alias shown as sticker in menu)',
    usage: 'sticker (reply)',
    category: 'Fun',
    aliases: ['sticker']
  },
  quote: {
    description: 'Get a random inspirational quote',
    usage: 'quote',
    category: 'Fun'
  },
  joke: {
    description: 'Get a random joke',
    usage: 'joke',
    category: 'Fun'
  },
  fact: {
    description: 'Get a random fact',
    usage: 'fact',
    category: 'Fun'
  },
  echo: {
    description: 'Echo back your message',
    usage: 'echo <text>',
    category: 'Fun'
  },
  translate: {
    description: 'Translate text to another language',
    usage: 'translate <lang_code> <text>',
    category: 'Fun'
  },
  slap: { description: 'Slap someone with a GIF', usage: 'slap [@user]', category: 'Fun' },
  hug: { description: 'Hug someone with a GIF', usage: 'hug [@user]', category: 'Fun' },
  fun_kick: { description: 'Kick someone with a GIF', usage: 'kick [@user]', category: 'Fun' },
  poke: { description: 'Poke someone with a GIF', usage: 'poke [@user]', category: 'Fun' },
  tickle: { description: 'Tickle someone with a GIF', usage: 'tickle [@user]', category: 'Fun' },
  cry: { description: 'Show a crying GIF', usage: 'cry', category: 'Fun' },
  pat: { description: 'Pat someone with a GIF', usage: 'pat [@user]', category: 'Fun' },
  kiss: { description: 'Kiss someone with a GIF', usage: 'kiss [@user]', category: 'Fun' },
  wave: { description: 'Wave with a GIF', usage: 'wave', category: 'Fun' },
  blush: { description: 'Show a blushing GIF', usage: 'blush', category: 'Fun' },
  shrug: { description: 'Shrug with a GIF', usage: 'shrug', category: 'Fun' },
  smile: { description: 'Show a smiling GIF', usage: 'smile', category: 'Fun' },
  laugh: { description: 'Show a laughing GIF', usage: 'laugh', category: 'Fun' },
  lick: { description: 'Lick someone with a GIF', usage: 'lick [@user]', category: 'Fun' },
  bored: { description: 'Show a bored GIF', usage: 'bored', category: 'Fun' },
  stare: { description: 'Stare with a GIF', usage: 'stare [@user]', category: 'Fun' },
  yeet: { description: 'Yeet with a GIF', usage: 'yeet [@user]', category: 'Fun' },
  feed: { description: 'Feed someone with a GIF', usage: 'feed [@user]', category: 'Fun' },
  dance: { description: 'Show a dancing GIF', usage: 'dance', category: 'Fun' },
  cuddle: { description: 'Cuddle with someone with a GIF', usage: 'cuddle [@user]', category: 'Fun' },
  highfive: { description: 'High five with a GIF', usage: 'highfive [@user]', category: 'Fun' },
  facepalm: { description: 'Show a facepalm GIF', usage: 'facepalm', category: 'Fun' },
  thumbsup: { description: 'Show a thumbs up GIF', usage: 'thumbsup', category: 'Fun' },
  think: { description: 'Show a thinking GIF', usage: 'think', category: 'Fun' },
  shoot: { description: 'Shoot with a GIF', usage: 'shoot [@user]', category: 'Fun' },
  pout: { description: 'Show a pouting GIF', usage: 'pout', category: 'Fun' },
  bite: { description: 'Bite someone with a GIF', usage: 'bite [@user]', category: 'Fun' },
  smug: { description: 'Show a smug GIF', usage: 'smug', category: 'Fun' },
  baka: { description: 'Call someone baka with a GIF', usage: 'baka [@user]', category: 'Fun' },

  // Features (welcome etc.)
  welcome: {
    description: 'Configure welcome/goodbye messages',
    usage: 'welcome',
    category: 'Features',
    adminOnly: true
  },

  // Settings (privacy/profile/disappear)
  privacy: {
    description: 'Configure privacy settings',
    usage: 'privacy',
    category: 'Settings',
    ownerOnly: true
  },
  setprofile: {
    description: 'Bot profile settings (name, pic, bio, blocklist)',
    usage: 'setprofile',
    category: 'Settings',
    ownerOnly: true
  },
  disappear: {
    description: 'Configure disappearing messages',
    usage: 'disappear',
    category: 'Settings',
    ownerOnly: true,
    aliases: ['disappearing']
  }
};

// Register helper (allows modules to add commands at runtime)
function registerCommand(name, info) {
  if (!name || typeof name !== 'string') return;
  if (commandRegistry[name]) {
    // already exists — skip to avoid duplicates
    // console.log(`Command ${name} already registered. Skipping...`);
    return false;
  }
  commandRegistry[name] = info;
  return true;
}

// Build commandsByCategory from registry, preserving categoryOrder
const commandsByCategory = {};
Object.entries(commandRegistry).forEach(([cmd, info]) => {
  const cat = info.category || 'Unsorted';
  if (!commandsByCategory[cat]) commandsByCategory[cat] = [];
  // push the canonical entry (include aliases/property flags)
  commandsByCategory[cat].push({ name: cmd, ...info });
});

// Ensure categories exist in categoryOrder (append any missing at end)
Object.keys(commandsByCategory).forEach(cat => {
  if (!categoryOrder.includes(cat)) categoryOrder.push(cat);
});

// Sort commands inside each category by name
Object.keys(commandsByCategory).forEach(cat => {
  commandsByCategory[cat].sort((a, b) => a.name.localeCompare(b.name));
});

// Export registry
module.exports = {
  commandRegistry,
  commandsByCategory,
  categoryOrder,
  version,
  registerCommand
};