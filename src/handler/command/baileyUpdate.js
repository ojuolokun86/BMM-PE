// baileyUpdate.js
const { exec } = require('child_process');

function updateBaileys() {
  return new Promise((resolve, reject) => {
    exec(
      'npm install @whiskeysockets/baileys@latest',
      { cwd: process.cwd() },
      (error, stdout, stderr) => {
        if (error) {
          return reject(stderr || error.message);
        }

        resolve({
          stdout,
          updated:
            stdout.includes('added') ||
            stdout.includes('changed') ||
            stdout.includes('updated')
        });
      }
    );
  });
}

async function updateBaileysCommand(sock, msg, isOwner) {
  if (!isOwner) {
    return sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Owner only command'
    });
  }

  const jid = msg.key.remoteJid;

  await sock.sendMessage(jid, {
    text: '🔄 Checking for Baileys update...'
  });

  try {
    const { stdout, updated } = await updateBaileys();

    // Trim output (WhatsApp has message limits)
    const shortLog = stdout.split('\n').slice(-8).join('\n');

    if (!updated) {
      return sock.sendMessage(jid, {
        text: `✅ Baileys is already up to date.\n\n🧾 Log:\n${shortLog}`
      });
    }

    await sock.sendMessage(jid, {
      text: `✅ Baileys updated successfully.\n\n🧾 Log:\n${shortLog}\n\n🔁 Restarting bot...`
    });

    // Small delay so message is delivered
    setTimeout(() => {
      exec('pm2 restart 0');
    }, 1500);

  } catch (err) {
    await sock.sendMessage(jid, {
      text: `❌ Update failed:\n${err.toString()}`
    });
  }
}

module.exports = { updateBaileysCommand };
