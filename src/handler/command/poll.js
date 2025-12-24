const sendToChat = require('../../utils/sendToChat');

/**
 * Usage: .poll <question> | <option1> | <option2> | ... [| <selectableCount>]
 * Example: .poll Which is your favorite team? | Arsenal | Barcelona | Chelsea | Man City | 1
 */
module.exports = async function pollCommand(sock, msg, textMsg) {
  const jid = msg.key.remoteJid;
  if (!jid.endsWith('@g.us') && !jid.endsWith('@s.whatsapp.net')) {
    return sendToChat(sock, jid, { message: '❌ Polls can only be sent in groups or direct chats.' }, { quoted: msg });
  }

  // Parse command: .poll Question | Option1 | Option2 | ... | selectableCount
  const parts = textMsg.replace(/^\.poll\s*/i, '').split('|').map(p => p.trim()).filter(Boolean);
  if (parts.length < 3) {
    return sendToChat(sock, jid, { message: '❌ Usage: .poll <question> | <option1> | <option2> | ... [| <selectableCount>]' }, { quoted: msg });
  }

  let selectableCount = 1;
  if (!isNaN(parts[parts.length - 1])) {
    selectableCount = Math.max(1, parseInt(parts.pop()));
  }
  const question = parts.shift();
  const values = parts;

  if (values.length < 2) {
    return sendToChat(sock, jid, { message: '❌ Please provide at least two options for the poll.' }, { quoted: msg });
  }

  await sock.sendMessage(jid, {
    poll: {
      name: question,
      values,
      selectableCount
    }
  }, { quoted: msg });

  //await sendToChat(sock, jid, { message: `✅ Poll sent!\n*${question}*\nOptions: ${values.join(', ')}\nSelectable: ${selectableCount}` }, { quoted: msg });
};