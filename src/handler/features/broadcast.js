
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function broadcastToGroupMembers(sock, groupJid, content, {
  delayMinMs = 5_000,
  delayMaxMs = 10_000,
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
      await sock.sendMessage(jid, content);
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

async function broadcastToAllGroups(sock, content, { delayMinMs, delayMaxMs, excludeJids } = {}) {
  const groups = await sock.groupFetchAllParticipating();
  const groupJids = Object.keys(groups);
  const targets = groupJids.filter(jid => !excludeJids.includes(jid));
  const result = { total: targets.length, sent: 0, failed: 0, failures: [] };

  for (let i = 0; i < targets.length; i++) {
    const jid = targets[i];
    try {
      await sock.sendMessage(jid, content);
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

async function broadcastToAllContacts(sock, content, { delayMinMs, delayMaxMs, excludeJids } = {}) {
  const store = require('../../utils/store');
  const contacts = store.contacts || {};
  const contactsJids = Object.keys(contacts).filter(jid => jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'));
  const targets = contactsJids.filter(jid => !excludeJids.includes(jid));
  const result = { total: targets.length, sent: 0, failed: 0, failures: [] };

  for (let i = 0; i < targets.length; i++) {
    const jid = targets[i];
    try {
      await sock.sendMessage(jid, content);
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

async function getUserGroupsWithNumbers(sock) {
  const groups = await sock.groupFetchAllParticipating();
  const entries = Object.values(groups);
  const list = entries.map((g, idx) => ({
    number: idx + 1,
    jid: g.id,
    subject: g.subject
  }));
  return list;
}

module.exports = {
  broadcastToGroupMembers,
  broadcastToAllGroups,
  broadcastToAllContacts,
  getUserGroupsWithNumbers
};
