const CHANNEL_JID_PATTERN = /^[A-Za-z0-9._-]+@newsletter$/i;
const CHANNEL_INVITE_URL_PATTERN = /^https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)\/?$/i;
const CHANNEL_COMMANDS = new Set([
  'ai', 'baka', 'bg', 'bite', 'bmm', 'bored', 'blush', 'cry', 'cuddle', 'dance',
  'fact', 'facepalm', 'feed', 'fun', 'gpt', 'help', 'highfive', 'hug',
  'imagine', 'info', 'joke', 'kill', 'kiss', 'laugh', 'lick', 'menu',
  'news', 'pat', 'ping', 'play', 'poke', 'pout', 'quote', 'screenshot',
  'shrug', 'slap', 'smile', 'smug', 'song', 'ss', 'ssweb', 'stare',
  'shoot', 'sticker', 'stimage', 'think', 'tickle', 'time', 'thumbsup',
  'translate', 'video', 'wave', 'yeet', 'yt'
]);

function isChannelCommandAllowed(command) {
  return CHANNEL_COMMANDS.has(command);
}

async function channelCommand(sock, msg, args, prefix, isOwner) {
  const from = msg.key.remoteJid;
  const isPrivateChat = from.endsWith('@s.whatsapp.net') || from.endsWith('@lid');

  if (!isPrivateChat) {
    await sock.sendMessage(from, { text: '❌ Use this command in a private chat with the bot.' });
    return;
  }

  if (!isOwner) {
    await sock.sendMessage(from, { text: '❌ Only the bot owner can publish to a channel.' });
    return;
  }

  const action = args[0]?.toLowerCase();
  const target = args[1];
  const text = args.slice(2).join(' ').trim();

  if (action !== 'send' || !target || !text) {
    await sock.sendMessage(from, {
      text: `Usage: ${prefix}channel send <channel link or JID> <message>\nExample: ${prefix}channel send https://whatsapp.com/channel/INVITECODE Hello everyone!`
    });
    return;
  }

  let metadataType;
  let metadataKey;
  if (CHANNEL_JID_PATTERN.test(target)) {
    metadataType = 'jid';
    metadataKey = target;
  } else {
    const inviteMatch = target.match(CHANNEL_INVITE_URL_PATTERN);
    if (!inviteMatch) {
      await sock.sendMessage(from, {
        text: '❌ Provide a WhatsApp channel invite link or a channel JID ending in @newsletter.'
      });
      return;
    }
    metadataType = 'invite';
    metadataKey = inviteMatch[1];
  }

  const metadata = await sock.newsletterMetadata(metadataType, metadataKey);
  const channelJid = metadata?.id;
  if (!channelJid || !CHANNEL_JID_PATTERN.test(channelJid)) {
    throw new Error('Could not resolve that channel. Check the link or JID and try again.');
  }

  try {
    await sock.sendMessage(channelJid, { text });
  } catch (error) {
    console.error('[channelCommand] Channel publish failed:', error);
    throw new Error(`Could not publish to the channel. Confirm the bot account is a channel admin. WhatsApp error: ${error.message || error}`);
  }

  await sock.sendMessage(from, {
    text: `✅ Message published to *${metadata.name || channelJid}*.`
  });
}

module.exports = channelCommand;
module.exports.isChannelCommandAllowed = isChannelCommandAllowed;
