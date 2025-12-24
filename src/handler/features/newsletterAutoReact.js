// Auto-react to messages from a specific WhatsApp newsletter channel
// Uses Baileys newsletterReactMessage API

/**
 * Reacts with a random emoji to any message from the configured newsletter JID
 * @param {import('@whiskeysockets/baileys').WASocket} sock
 * @param {any} msg
 */
async function handleNewsletterAutoReact(sock, msg) {
  try {
    //const targetNewsletterJid = '120363403127154832@newsletter';  
    const targetNewsletterJid = '120363421699503582@newsletter';

    const remoteJid = msg?.key?.remoteJid;
    if (!remoteJid || remoteJid !== targetNewsletterJid) return;

    // Skip if message is from the bot itself
    if (msg?.key?.fromMe) return;

    // Ensure there's a message payload to react to
    if (!msg?.message) return;

    // Extract serverMessageId (required for newsletter reactions)
    const serverMessageId =
      msg.message?.messageContextInfo?.serverMessageId ||
      msg.key?.id; // fallback

    if (!serverMessageId) {
      console.warn('[newsletterAutoReact] Missing serverMessageId, cannot react');
      return;
    }

    // Debug: log what we’re targeting
    if (process.env.NODE_ENV !== 'production') {
      console.log('[newsletterAutoReact] Targeting newsletter post:', {
        remoteJid,
        serverMessageId,
      });
    }

    // Optional: small random delay to appear natural
    await sleep(200 + Math.floor(Math.random() * 500));

    const emojis = [
      '👍', '❤️', '🔥', '👏', '😄', '🤝', '💯', '⭐', '😎', '🙌', '🚀', '✨', '🧠', '🤖', '🫶', '🩷', '🥳'
    ];
    const pick = emojis[Math.floor(Math.random() * emojis.length)];

    // Use newsletterReactMessage API
    const res = await sock.newsletterReactMessage(remoteJid, serverMessageId, pick);

    console.log('[newsletterAutoReact] Reacted with:', pick, '| result:', res);
  } catch (err) {
    console.warn('[newsletterAutoReact] Failed to react:', err?.message || err);
  }
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

module.exports = handleNewsletterAutoReact;
