const {
  getJoinRequestSettings,
  setJoinRequestSetting
} = require('../../database/database');
const { checkIfAdmin } = require('./kick');

function getBotId(sock) {
  return sock.user?.id?.split(':')[0]?.split('@')[0];
}

function normalizeSetting(value) {
  const setting = String(value || '').toLowerCase();
  if (setting === 'accept') return 'accept';
  if (setting === 'reject') return 'reject';
  return null;
}

async function handleJoinRequestCommand(sock, msg, args, userId) {
  const chatId = msg.key.remoteJid;
  if (!chatId || !chatId.endsWith('@g.us')) {
    return sock.sendMessage(chatId, {
      text: '> ❌ This command only works in groups.'
    }, { quoted: msg });
  }

  const sender = msg.key.participant || msg.key.remoteJid;
  if (!await checkIfAdmin(sock, chatId, sender)) {
    return sock.sendMessage(chatId, {
      text: '> ❌ Only group admins can change join request automation.'
    }, { quoted: msg });
  }

  const setting = normalizeSetting(args[0]);
  const action = String(args[1] || '').toLowerCase();
  if (!setting || !['on', 'off'].includes(action)) {
    const settings = getJoinRequestSettings(getBotId(sock) || userId);
    return sock.sendMessage(chatId, {
      text: `> ❌ Usage: .accept on|off or .reject on|off\n\n` +
        `> Accept requests: ${settings.accept ? 'ON' : 'OFF'}\n` +
        `> Reject requests: ${settings.reject ? 'ON' : 'OFF'}`
    }, { quoted: msg });
  }

  const botId = getBotId(sock) || userId;
  const enabled = action === 'on';
  setJoinRequestSetting(botId, setting, enabled);

  return sock.sendMessage(chatId, {
    text: `> ✅ Automatic ${setting} requests is now *${enabled ? 'ON' : 'OFF'}*.`
  }, { quoted: msg });
}

async function handleJoinRequest(sock, update) {
  const groupJid = update?.id;
  const participant = update?.participant;
  if (update?.action !== 'created' || !groupJid?.endsWith('@g.us') || !participant) return;

  const settings = getJoinRequestSettings(getBotId(sock));
  const action = settings.accept ? 'approve' : settings.reject ? 'reject' : null;
  if (!action) return;

  try {
    await sock.groupRequestParticipantsUpdate(groupJid, [participant], action);
  } catch (error) {
    console.error(`Join request ${action} failed:`, error.message || error);
  }
}

module.exports = {
  handleJoinRequestCommand,
  handleJoinRequest
};
