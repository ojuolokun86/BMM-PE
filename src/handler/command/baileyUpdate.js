// // baileyUpdate.js
// const { exec } = require('child_process');

// function run(cmd) {
//   return new Promise((resolve, reject) => {
//     exec(cmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
//       if (err) return reject(stderr || err.message);
//       resolve(stdout.trim());
//     });
//   });
// }

// async function getCurrentVersion() {
//   try {
//     const out = await run('npm list @whiskeysockets/baileys --depth=0');
//     const match = out.match(/baileys@([\d.]+)/);
//     return match ? match[1] : 'unknown';
//   } catch {
//     return 'not installed';
//   }
// }

// async function getLatestVersion() {
//   return await run('npm view @whiskeysockets/baileys version');
// }

// async function updateBaileys() {
//   const before = await getCurrentVersion();
//   const latest = await getLatestVersion();

//   if (before === latest) {
//     return {
//       updated: false,
//       from: before,
//       to: latest
//     };
//   }

//   const installLog = await run(
//     'npm install @whiskeysockets/baileys@latest'
//   );

//   return {
//     updated: true,
//     from: before,
//     to: latest,
//     log: installLog.split('\n').slice(-8).join('\n')
//   };
// }

// /* ───────── WhatsApp Command ───────── */

// async function updateBaileysCommand(sock, msg, isOwner) {
//   if (!isOwner) {
//     return sock.sendMessage(msg.key.remoteJid, {
//       text: '❌ Owner only command'
//     });
//   }

//   const jid = msg.key.remoteJid;

//   await sock.sendMessage(jid, {
//     text: '🔍 Checking Baileys version...'
//   });

//   try {
//     const result = await updateBaileys();

//     if (!result.updated) {
//       return sock.sendMessage(jid, {
//         text:
// `✅ Baileys is already up to date

// 📦 Version: ${result.from}`
//       });
//     }

//     await sock.sendMessage(jid, {
//       text:
// `⬆️ Baileys updated successfully

// 📦 From: ${result.from}
// 📦 To:   ${result.to}

// 🧾 Install log:
// ${result.log}

// 🔁 Restarting bot...`
//     });

//     // allow WhatsApp to send message first
//     setTimeout(() => {
//       exec('pm2 restart 0');
//     }, 1500);

//   } catch (err) {
//     await sock.sendMessage(jid, {
//       text: `❌ Update failed:\n${err.toString()}`
//     });
//   }
// }

// module.exports = { updateBaileysCommand };
