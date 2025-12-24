const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { botInstances } = require('./globalStore');
// '2348026977793'
const developerNumbers = ['2348026977793','2348051891310', '2348125313622'];

async function getBotServerUrls() {
  const filePath = path.join(__dirname, 'bot_servers.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Returns the first available dev bot sock on this server, or null
function getAnyDevSock() {
  for (const devNumber of developerNumbers) {
    if (botInstances[devNumber]) return botInstances[devNumber];
  }
  return null;
}

/**
 * Send error/report to all developer numbers:
 * - If a dev bot is live, DM directly using that sock
 * - Always relay to all bot server APIs as well
 */
async function sendErrorToDevelopers(sock, errorMsg, contextInfo, targetNumbers = developerNumbers) {
  let devSock = getAnyDevSock();

  for (const devNumber of targetNumbers) {
    // DM via local dev sock if possible
    if (devSock) {
      try {
        await devSock.sendMessage(devNumber + '@s.whatsapp.net', {
          text: `🚨 Bot Error:\n${errorMsg}\nContext:\n${JSON.stringify(contextInfo, null, 2)}`
        });
        console.log(`Sent error to developer ${devNumber}`);
      } catch (err) {
        console.error('Failed to DM developer', devNumber, err);
      }
    }
  }

  // Always relay to all servers for all dev numbers
  const urls = await getBotServerUrls();
  for (const devNumber of targetNumbers) {
    for (const url of urls) {
      try {
        await axios.post(`${url}/relay-report`, {
          devNumber,
          errorMsg,
          contextInfo
        });
        //console.log(`Relayed error to ${url} for developer ${devNumber}`);
      } catch (err) {
        //console.error(`Failed to relay to ${url}:`, err.message);
      }
    }
  }
}

/**
 * Only delivers the message locally to dev DMs if their bot is live on this server.
 * Returns true if delivered to at least one dev locally. Still always relays to all servers.
 */
async function deliverToDeveloperHere(errorMsg, contextInfo, targetNumbers = developerNumbers) {
  let delivered = false;

  for (const devNumber of targetNumbers) {
    const sock = botInstances[devNumber];
    if (sock) {
      try {
        await sock.sendMessage(devNumber + '@s.whatsapp.net', {
          text: `🚨 Bot Error:\n${errorMsg}\nContext:\n${JSON.stringify(contextInfo, null, 2)}`
        });
        delivered = true;
        //console.log(`Sent error to developer ${devNumber} (local)`);
      } catch (err) {
        //console.error('Failed to DM developer', devNumber, err);
      }
    }
  }

  // Always relay to all servers for all dev numbers
//   const urls = await getBotServerUrls();
//   for (const devNumber of targetNumbers) {
//     for (const url of urls) {
//       try {
//         await axios.post(`${url}/relay-report`, {
//           devNumber,
//           errorMsg,
//           contextInfo
//         });
//         //console.log(`Relayed error to ${url} for developer ${devNumber}`);
//       } catch (err) {
//         //console.error(`Failed to relay to ${url}:`, err.message);
//       }
//     }
//   }

//   return delivered;
}

module.exports = {
  sendErrorToDevelopers,
  getAnyDevSock,
  deliverToDeveloperHere
};