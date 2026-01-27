const store = require('../../utils/store');

async function contactCommand(sock, msg, args, prefix) {
  const chatId = msg?.key?.remoteJid;
  if (!chatId) return;

  const pageSize = 20;
  const includeAll = (args || []).some(a => String(a).toLowerCase() === 'all');
  const pageArg = (args || []).find(a => /^\d+$/.test(String(a)));
  const page = Math.max(1, parseInt(pageArg || '1', 10));

  const entries = Object.values(store.contacts || {});
  const filtered = includeAll
    ? entries
    : entries.filter(c => typeof c?.id === 'string' && c.id.endsWith('@s.whatsapp.net'));

  filtered.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  const lines = slice.map((c, i) => {
    const id = String(c?.id || '');
    const clean = id.includes('@') ? id.split('@')[0] : id;
    const name = (c?.name || '').trim();
    return `${start + i + 1}. ${clean}${name ? ` - ${name}` : ''}`;
  });

  const title = includeAll
    ? 'Saved contacts (all: numbers + lid)'
    : 'Saved contacts (numbers only)';

  await sock.sendMessage(chatId, {
    text: `${title}\n\n${lines.join('\n') || '(none)'}\n\nPage ${safePage}/${totalPages} | Total: ${total}\n\nUse: ${prefix}contacts <page>\nUse: ${prefix}contacts all <page>`
  }, { quoted: msg });
}

module.exports = contactCommand;