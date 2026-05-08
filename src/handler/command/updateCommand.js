const { checkUpdate, normalUpdate, forceUpdate } = require('../features/gitUpdate');
const { exec } = require('child_process');
const pm2 = require('pm2');

function restartThisProcess() {
  pm2.connect(err => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    pm2.list((err, list) => {
      if (err) {
        console.error(err);
        pm2.disconnect();
        return;
      }

      // find current process by PID
      const current = list.find(p => p.pid === process.pid);

      if (!current) {
        console.log('❌ PM2 process not found for this PID');
        pm2.disconnect();
        return;
      }

      console.log(`🔁 Restarting PM2 process: ${current.name} (id: ${current.pm_id})`);

      pm2.restart(current.pm_id, (err) => {
        pm2.disconnect();

        if (err) {
          console.error('❌ PM2 restart failed:', err);
        }
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

  // Helper to format changelog
  const formatChangelog = (changelog) => {
    return changelog && changelog.length
      ? changelog.map(line => `• ${line}`).join('\n')
      : 'No changelog available';
  };

  try {
    /* 🔍 CHECK - DEFAULT BEHAVIOR */
    if (!sub || sub === 'check') {
      const res = await checkUpdate();
      console.log(`Update command executed ${res.localVersion} and ${res.remoteVersion}`);

      if (res.upToDate) {
        return sock.sendMessage(jid, {
          text: `✅ Bot is up to date

📦 Version: v${res.localVersion}
🔖 Commit: ${res.localCommit}`
        });
      } else {
        const changelogText = formatChangelog(res.changelog);

        return sock.sendMessage(jid, {
          text:
`⬆️ Update available

📦 Version:
From: v${res.localVersion}
To:   v${res.remoteVersion}

🔖 Commit:
Local:  ${res.localCommit}
Remote: ${res.remoteCommit}

🆕 What's new:
${changelogText}

Use *.update bot* to apply`
        });
      }
    }

    /* 🤖 UPDATE BOT */
    if (sub === 'bot') {
      await sock.sendMessage(jid, { text: '🔄 Updating bot...' });

      const res = await normalUpdate();

      if (!res.updated) {
        return sock.sendMessage(jid, {
          text:
`✅ Already up to date

📦 Version: v${res.toVersion}
🔖 Commit: ${res.toCommit}`
        });
      }

      const changelogText = formatChangelog(res.changelog);

      await sock.sendMessage(jid, {
        text:
`⬆️ Bot updated successfully

📦 Version:
From: v${res.fromVersion}
To:   v${res.toVersion}

🔖 Commit:
From: ${res.fromCommit}
To:   ${res.toCommit}

🆕 What's new:
${changelogText}

🔁 Restarting bot...`
      });

      return setTimeout(() => restartThisProcess(), 1500);
    }

    /* 🔥 FORCE UPDATE */
    if (sub === 'force') {
      await sock.sendMessage(jid, { text: '🔥 Force updating bot...' });

      const res = await forceUpdate();
      const changelogText = formatChangelog(res.changelog);

      await sock.sendMessage(jid, {
        text:
`✅ Force update completed

📦 Version:
From: v${res.fromVersion}
To:   v${res.toVersion}

🔖 Commit:
From: ${res.fromCommit}
To:   ${res.toCommit}

🆕 What's new:
${changelogText}

🔁 Restarting bot...`
      });

      return setTimeout(() => restartThisProcess(), 1500);
    }

  } catch (err) {
    await sock.sendMessage(jid, {
      text: `❌ Update failed:\n${err.toString()}`
    });
  }
}

module.exports = { updateCommand };