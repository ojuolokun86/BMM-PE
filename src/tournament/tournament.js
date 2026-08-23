const {
  getCategoryEvents,
  getCompetitionTable
} = require('./copafacil.browser');

const tourSessions = new Map();

async function handleTourCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;

  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    '';

  const args = body.trim().split(' ');
  const url = args[1];

  console.log('[TOUR] URL:', url);

  if (!url) {
    return sock.sendMessage(from, {
      text: '❌ Usage: !tour <url>'
    }, { quoted: msg });
  }

  await sock.sendMessage(from, {
    text: '⏳ Loading tournaments...'
  }, { quoted: msg });

  const events = await getCategoryEvents(url);

  const menuText =
    `🏆 *COMPETITIONS*\n\n` +
    events.map((e, i) => `${i + 1}. ${e.title}`).join('\n') +
    `\n\nReply with number`;

  const sent = await sock.sendMessage(from, {
    text: menuText
  }, { quoted: msg });

  const menuMsgId = sent.key.id;

  tourSessions.set(from, {
    url,
    events,
    step: 'event',
    menuMsgId,
    sender
  });

  const listener = async (m) => {
    const msg2 = m.messages?.[0];
    if (!msg2) return;

    const jid = msg2.key.remoteJid;
    const sender2 = msg2.key.participant || msg2.key.remoteJid;

    if (jid !== from || sender2 !== sender) return;

    const context = msg2.message?.extendedTextMessage?.contextInfo;
    if (!context || context.stanzaId !== menuMsgId) return;

    const text =
      msg2.message?.conversation ||
      msg2.message?.extendedTextMessage?.text ||
      '';

    const session = tourSessions.get(from);
    if (!session) return sock.ev.off('messages.upsert', listener);

    const choice = parseInt(text.trim());

    if (session.step === 'event') {
      const selected = session.events[choice - 1];
      if (!selected) {
        return sock.sendMessage(from, {
          text: '❌ Invalid choice'
        }, { quoted: msg2 });
      }

      session.step = 'table';

      await sock.sendMessage(from, {
        text: '⏳ Loading standings...'
      }, { quoted: msg2 });

      const table = await getCompetitionTable(selected.id);

      if (!table.success) {
        console.log('[TABLE ERROR]', table);
        return sock.sendMessage(from, {
          text: '❌ No standings found'
        }, { quoted: msg2 });
      }

      let out = `🏆 *${selected.title}*\n\n`;

      table.data.forEach(t => {
        out += `${t.position || '-'} ${t.name || t.team}\n`;
        out += `Points: ${t.points || 0}\n\n`;
      });

      await sock.sendMessage(from, { text: out }, { quoted: msg2 });
      if (table.source.includes('/request/event')) {
        console.log('\n========== EVENT JSON ==========');
        console.log(JSON.stringify(table.data, null, 2));
        console.log('===============================\n');
      }

      tourSessions.delete(from);
      sock.ev.off('messages.upsert', listener);
    }
  };

  sock.ev.on('messages.upsert', listener);
}

module.exports = handleTourCommand;