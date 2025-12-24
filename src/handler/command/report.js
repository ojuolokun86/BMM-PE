const { sendErrorToDevelopers } = require('../../utils/devMessenger');
module.exports = {
  name: 'report',
  description: 'Report an issue to the developers',
  async execute({ sock, msg, textMsg, args }) {
    const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
    const name = sock.user?.name;
    const reportText = args.join(' ');
    const contextInfo = {
      serverId: process.env.SERVER_ID || 'default',
      botId: botId,
      name: name,
    };
    // Do NOT pass sock as first argument, so sendErrorToDevelopers will use a dev sock
    await sendErrorToDevelopers(undefined, `User report: ${reportText}`, contextInfo);
    await sock.sendMessage(msg.key.remoteJid, { text: '✅ Your report has been sent to the developers. Thank you!' });
  }
};