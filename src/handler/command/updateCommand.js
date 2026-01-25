const { checkUpdate, normalUpdate, forceUpdate } = require('../features/gitUpdate');
const { exec } = require('child_process');

async function updateCommand(sock, msg, isOwner, args) {
  if (!isOwner) {
    return sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Owner only command'
    });
  }

  const jid = msg.key.remoteJid;
  const sub = args[0];

  try {
    /* 🔍 CHECK */
    if (sub === 'check') {
      const res = await checkUpdate();

      return sock.sendMessage(jid, {
        text: res.upToDate
          ? `✅ Bot is up to date\n\n🔖 Commit: ${res.local}`
          : `⬆️ Update available\n\n🔖 Local:  ${res.local}\n🔖 Remote: ${res.remote}\n\nUse *.update* to apply`
      });
    }

    /* 🔥 FORCE */
    if (sub === 'force') {
      await sock.sendMessage(jid, { text: '🔥 Force updating bot...' });

      const res = await forceUpdate();

      await sock.sendMessage(jid, {
        text:
`✅ Force update completed

🔖 From: ${res.from}
🔖 To:   ${res.to}

🔁 Restarting bot...`
      });

      return setTimeout(() => exec('pm2 restart 0'), 1500);
    }

    /* 🔄 NORMAL UPDATE */
    await sock.sendMessage(jid, { text: '🔄 Updating bot from GitHub...' });

    const res = await normalUpdate();

    if (res.failed) {
      return sock.sendMessage(jid, {
        text: `❌ Update blocked\n${res.reason}`
      });
    }

    if (!res.updated) {
      return sock.sendMessage(jid, {
        text: `✅ Already up to date\n🔖 Commit: ${res.commit}`
      });
    }

    await sock.sendMessage(jid, {
      text:
`⬆️ Bot updated successfully

🔖 From: ${res.from}
🔖 To:   ${res.to}

🔁 Restarting bot...`
    });

    setTimeout(() => exec('pm2 restart 0'), 1500);

  } catch (err) {
    await sock.sendMessage(jid, {
      text: `❌ Update failed:\n${err.toString()}`
    });
  }
}

module.exports = { updateCommand };
