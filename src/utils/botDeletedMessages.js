// Store IDs of messages deleted by the bot to prevent antidelete restoring them
const botDeletedMessages = new Set();

function markMessageAsBotDeleted(msgId) {
  botDeletedMessages.add(msgId);

  // Optional: Auto-remove after 5 minutes to avoid memory overflow
  setTimeout(() => botDeletedMessages.delete(msgId), 5 * 60 * 1000);
}

function wasDeletedByBot(msgId) {
  return botDeletedMessages.has(msgId);
}

module.exports = {
  markMessageAsBotDeleted,
  wasDeletedByBot,
};
