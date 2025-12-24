const sendToChat = require('../../utils/sendToChat');
const { setAntilinkSettings, getAntilinkSettings } = require('../../database/antilinkDb');
const { isBotOwner } = require('../../database/database');
const { checkIfAdmin } = require('../command/groupCommand');
const menu = (settings) => 
`🛡️ [*Antilink Security Module*]
  
🖥️ [CONFIGURATION]
> • Warn Limit: ${settings.warnLimit || 2}
> • Admin Bypass: ${settings.bypassAdmins ? '🟢 Enabled' : '🔴 Disabled'}
> • Mode: ${settings.mode || 'Off'}
  
🖥️ [COMMAND OPTIONS]
> 0 → Disable Antilink
> 1 → Warn User Only
> 2 → Warn & Remove User
> 3 → Remove User Immediately
> 4 → Set Warn Limit (Current: ${settings.warnLimit || 2})
> 5 → Toggle Admin Bypass
  
*Action Required: Reply with a number to execute command.*`;
  
async function isGroupAdmin(sock, chatId, userId) {
  try {
      const metadata = await sock.groupMetadata(chatId);
      const participant = metadata.participants.find(p => p.id === userId);
      return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
  } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
  }
}


async function handleAntilinkCommand(sock, msg, phoneNumber) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
  const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
  const groupId = from;
  const senderId = sender?.split('@')[0];
   if (!groupId || !groupId.endsWith('@g.us')) {
      return sendToChat(sock, groupId, { message: '> ❌ This command only works in groups.' }, { quoted: msg });
    }
    const isBotAdmin = await isGroupAdmin(sock, groupId, sender); 
    if (!isBotAdmin) {
      return sendToChat(sock, groupId, { message: '> ❌ I need to be an admin to activate antilink.' }, { quoted: msg });
    }
  if (!msg.key.fromMe && !isBotOwner(senderId, botId, botLid)) {
    return await sendToChat(sock, from, {
      message: '> ❌ Only the bot owner can change the Antilink settings.'
    });
  }

  const current = getAntilinkSettings(groupId, botId);
  const sent = await sock.sendMessage(from, { text: menu(current) }, { quoted: msg });
  const menuMsgId = sent.key.id;

  const listener = async (m) => {
    const reply = m.messages?.[0];
    if (!reply) return;

    const replyFrom = reply.key.remoteJid;
    const replySender = reply.key.participant || reply.key.remoteJid;
    if (replyFrom !== from || replySender !== sender) return;

    const context = reply.message?.extendedTextMessage?.contextInfo;
    const isReplyToMenu = context?.stanzaId === menuMsgId;
    if (!isReplyToMenu) return;

    const body = reply?.message?.conversation || reply?.message?.extendedTextMessage?.text || '';
    const option = parseInt(body.trim());

    if (isNaN(option) || ![0, 1, 2, 3, 4, 5].includes(option)) {
      await sendToChat(sock, from, { message: '❌ Invalid choice. Try again.' });
      sock.ev.off('messages.upsert', listener);
      return;
    }

    switch (option) {
      case 0:
        setAntilinkSettings(groupId, botId, { mode: 'off' });
        await sendToChat(sock, from, { message: '🔕 Antilink *disabled*.' });
        break;
      case 1:
        setAntilinkSettings(groupId, botId, { mode: 'warn' });
        await sendToChat(sock, from, { message: '⚠️ Antilink set to *warn only*.' });
        break;
      case 2:
        setAntilinkSettings(groupId, botId, { mode: 'warn-remove' });
        await sendToChat(sock, from, { message: '🚫 Antilink set to *warn & remove*.' });
        break;
      case 3:
        setAntilinkSettings(groupId, botId, { mode: 'remove' });
        await sendToChat(sock, from, { message: '❌ Antilink set to *remove immediately*.' });
        break;
      case 4:
        await sock.sendMessage(from, {
          text: '✏️ Reply with the number of allowed warnings (e.g. 2)'
        }, { quoted: reply });

        const subListener = async (m2) => {
          const r2 = m2.messages?.[0];
          if (!r2 || r2.key.fromMe) return;

          const r2From = r2.key.remoteJid;
          const r2Sender = r2.key.participant || r2.key.remoteJid;
          const subCtx = r2.message?.extendedTextMessage?.contextInfo;
          if (r2From !== from || r2Sender !== sender || !subCtx?.stanzaId) return;

          const text = r2?.message?.conversation || r2?.message?.extendedTextMessage?.text || '';
          const count = parseInt(text.trim());

          if (isNaN(count) || count < 1) {
            await sendToChat(sock, from, { message: '❌ Invalid number.' });
          } else {
            setAntilinkSettings(groupId, botId, { warnLimit: count });
            await sendToChat(sock, from, {
              message: `🔁 Warn limit set to *${count} times*.`
            });
          }

          sock.ev.off('messages.upsert', subListener);
        };

        sock.ev.on('messages.upsert', subListener);
        break;

     case 5:
      const newVal = current.bypassAdmins ? 0 : 1;
      setAntilinkSettings(groupId, botId, { bypassAdmins: newVal });
      await sendToChat(sock, from, {
        message: `👮 Admin bypass is now *${newVal ? 'enabled' : 'disabled'}*.`
      });
      break;
    }

    sock.ev.off('messages.upsert', listener);
  };

  sock.ev.on('messages.upsert', listener);
}

module.exports = handleAntilinkCommand;
