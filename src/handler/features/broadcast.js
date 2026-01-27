
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function broadcastToGroupMembers(sock, groupJid, text, {
  quoted,
  delayMinMs = 10_000,
  delayMaxMs = 20_000,
  excludeJids = []
} = {}) {
  const result = {
    total: 0,
    sent: 0,
    failed: 0,
    failures: []
  };

  const metadata = await sock.groupMetadata(groupJid);
  const participants = (metadata?.participants || []).map(p => p.id).filter(Boolean);

  const unique = [...new Set(participants)];
  const targets = unique.filter(jid => !excludeJids.includes(jid));
  result.total = targets.length;

  for (let i = 0; i < targets.length; i++) {
    const jid = targets[i];
    try {
      await sock.sendMessage(jid, { text }, quoted ? { quoted } : undefined);
      result.sent++;
    } catch (err) {
      result.failed++;
      result.failures.push({ jid, error: err?.message || String(err) });
    }

    if (i < targets.length - 1) {
      const delay = randomInt(delayMinMs, delayMaxMs);
      await sleep(delay);
    }
  }

  return result;
}

module.exports = {
  broadcastToGroupMembers
};
