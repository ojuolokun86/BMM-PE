const CHANNEL_JID_PATTERN = /^[A-Za-z0-9._-]+@newsletter$/i;
const CHANNEL_INVITE_URL_PATTERN = /^https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)\/?$/i;
const CHANNEL_COMMANDS = new Set([
  'ai', 'baka', 'bg', 'bite', 'bmm', 'bored', 'blush', 'channel', 'cry', 'cuddle', 'dance',
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
  const isNewsletter = from.endsWith('@newsletter');
  const isPrivateChat = from.endsWith('@s.whatsapp.net') || from.endsWith('@lid');

  if (!isPrivateChat && !isNewsletter) {
    await sock.sendMessage(from, { text: '❌ Use this command in a private chat or in the channel you want to post to.' });
    return;
  }

  if (!isNewsletter && !isOwner) {
    await sock.sendMessage(from, { text: '❌ Only the bot owner can publish to a channel.' });
    return;
  }

  const action = args[0]?.toLowerCase();
  const target = isNewsletter ? from : args[1];
  const text = args.slice(isNewsletter ? 1 : 2).join(' ').trim();

  if (action !== 'send' || !target || !text) {
    await sock.sendMessage(from, {
      text: isNewsletter
        ? `Usage: ${prefix}channel send <message>\nExample: ${prefix}channel send Hello everyone!`
        : `Usage: ${prefix}channel send <channel link or JID> <message>\nExample: ${prefix}channel send https://whatsapp.com/channel/INVITECODE Hello everyone!`
    });
    return;
  }

  let channelJid = target;
  let channelName;
  if (!isNewsletter) {
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
    channelJid = metadata?.id;
    channelName = metadata?.name;
    if (!channelJid || !CHANNEL_JID_PATTERN.test(channelJid)) {
      await sock.sendMessage(from, {
        text: '❌ Could not resolve that channel. Check the link or JID and try again.'
      });
      return;
    }
  }

  try {
    await sock.sendMessage(channelJid, { text });
  } catch (error) {
    console.error('[channelCommand] Channel publish failed:', error);
    throw new Error(`Could not publish to the channel. Confirm the connected account is a channel admin. WhatsApp error: ${error.message || error}`);
  }

  if (!isNewsletter) {
    await sock.sendMessage(from, {
      text: `✅ Message published to *${channelName || channelJid}*.`
    });
  }
}

module.exports = channelCommand;
module.exports.isChannelCommandAllowed = isChannelCommandAllowed;
