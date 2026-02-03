const { checkUpdate, normalUpdate, forceUpdate } = require('../features/gitUpdate');
const pm2 = require('pm2');

async function restartCurrentBot() {
  return new Promise((resolve, reject) => {
    pm2.connect(err => {
      if (err) return reject(err);

      const currentPid = process.pid;

      pm2.list((err, list) => {
        if (err) {
          pm2.disconnect();
          return reject(err);
        }

        const proc = list.find(p => p.pid === currentPid);
        if (!proc) {
          pm2.disconnect();
          return reject(new Error('❌ Could not find this process in PM2 list'));
        }

        console.log(`🔁 Restarting bot: ${proc.name} (PM2 ID: ${proc.pm_id})`);

        pm2.restart(proc.pm_id, (err) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve(proc.pm_id);
        });
      });
    });
  });
}

async function updateCommand(sock, msg, isOwner, args) {
  const fromMe = msg.key.fromMe;
  if (!fromMe) {
    return sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Owner only command'
    });
  }

  const jid = msg.key.remoteJid;
  const sub = args[0];

  try {
    /* 🔍 CHECK - DEFAULT BEHAVIOR */
    if (!sub || sub === 'check') {
      const res = await checkUpdate();
      return sock.sendMessage(jid, {
        text: res.upToDate
          ? `✅ Bot is up to date\n\n📦 Version: v${res.localVersion}\n🔖 Commit: ${res.localCommit}`
          : `⬆️ Update available\n\n📦 Version:\nFrom: v${res.localVersion}\nTo:   v${res.remoteVersion}\n\n🔖 Commit:\nLocal:  ${res.localCommit}\nRemote: ${res.remoteCommit}\n\nUse *.update bot* to apply`
      });
    }

    /* 🤖 UPDATE BOT */ 
    //not funny
    if (sub === 'bot') {
      await sock.sendMessage(jid, { text: '🔄 Updating bot...' });
      const res = await normalUpdate();

      if (!res.updated) {
        return sock.sendMessage(jid, {
          text: `✅ Already up to date\n\n📦 Version: v${res.toVersion}\n🔖 Commit: ${res.toCommit}`
        });
      }

      await sock.sendMessage(jid, {
        text: `⬆️ Bot updated successfully\n\n📦 Version:\nFrom: v${res.fromVersion}\nTo:   v${res.toVersion}\n\n🔖 Commit:\nFrom: ${res.fromCommit}\nTo:   ${res.toCommit}\n\n🔁 Restarting bot...`
      });

      try {
        await restartCurrentBot();
      } catch (err) {
        console.error('Restart failed:', err);
        await sock.sendMessage(jid, { text: `❌ Bot update succeeded but restart failed:\n${err.message}` });
      }
    }

    /* 🔥 FORCE UPDATE */
    if (sub === 'force') {
      await sock.sendMessage(jid, { text: '🔥 Force updating bot...' });
      const res = await forceUpdate();

      await sock.sendMessage(jid, {
        text: `✅ Force update completed\n\n📦 Version:\nFrom: v${res.fromVersion}\nTo:   v${res.toVersion}\n\n🔖 Commit:\nFrom: ${res.fromCommit}\nTo:   ${res.toCommit}\n\n🔁 Restarting bot...`
      });

      try {
        await restartCurrentBot();
      } catch (err) {
        console.error('Restart failed:', err);
        await sock.sendMessage(jid, { text: `❌ Force update succeeded but restart failed:\n${err.message}` });
      }
    }

  } catch (err) {
    console.error('Update command failed:', err);
    await sock.sendMessage(jid, {
      text: `❌ Update failed:\n${err.toString()}`
    });
  }
}

module.exports = { updateCommand };
