const { checkUpdate, normalUpdate, forceUpdate } = require('../features/gitUpdate');
const { exec } = require('child_process');

const pmId = process.env.PM2_PROCESS_NAME || process.env.PM2_PROCESS_ID


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
      console.log(`Update command executed ${res.localVersion} and ${res.remoteVersion}`);
      return sock.sendMessage(jid, {
        text: res.upToDate
          ? `✅ Bot is up to date

📦 Version: v${res.localVersion}
🔖 Commit: ${res.localCommit}`
          : `⬆️ Update available



📦 Version:
From: v${res.localVersion}
To:   v${res.remoteVersion}

🔖 Commit:
Local:  ${res.localCommit}
Remote: ${res.remoteCommit}

Use *.update bot* to apply`
      });
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

      await sock.sendMessage(jid, {
        text:
`⬆️ Bot updated successfully

📦 Version:
From: v${res.fromVersion}
To:   v${res.toVersion}

🔖 Commit:
From: ${res.fromCommit}
To:   ${res.toCommit}

🔁 Restarting bot...`
      });
      console.log(`Restarting bot with pm2 process ID: ${pmId}`);
      return setTimeout(() => exec(`pm2 restart ${pmId}`), 1500);
    }

    /* 🔥 FORCE UPDATE */
    if (sub === 'force') {
      await sock.sendMessage(jid, { text: '🔥 Force updating bot...' });

      const res = await forceUpdate();

      await sock.sendMessage(jid, {
        text:
`✅ Force update completed

📦 Version:
From: v${res.fromVersion}
To:   v${res.toVersion}

🔖 Commit:
From: ${res.fromCommit}
To:   ${res.toCommit}

🔁 Restarting bot...`
      });
      console.log(`Restarting bot with pm2 process ID: ${pmId}`);
      return setTimeout(() => exec(`pm2 restart ${pmId}`), 1500);
    }

  } catch (err) {
    await sock.sendMessage(jid, {
      text: `❌ Update failed:\n${err.toString()}`
    });
  }
}

module.exports = { updateCommand };
