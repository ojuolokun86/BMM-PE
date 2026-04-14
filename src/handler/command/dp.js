// const { registerCommand } = require('./commandRegistry');
// const sendToChat = require('../../utils/sendToChat');
// const nodeQueryModule = require('../../utils/nodeQuery');

// // Direct access to functions
// const getProfilePicture = nodeQueryModule.getProfilePicture;
// const extractPictureUrl = nodeQueryModule.extractPictureUrl;
// const S_WHATSAPP_NET = nodeQueryModule.S_WHATSAPP_NET;

// /**
//  * Example command: .dp 234xxxxxxxxxx
//  */
// async function handleDpCommand(sock, msg, args) {
//     try {
//         if (!args[0]) {
//             return await sock.sendMessage(msg.key.remoteJid, {
//                 text: '❌ Please provide a number\nExample: .dp 2348012345678'
//             });
//         }

//         let number = args[0].replace(/\D/g, '');

//         if (number.length < 10) {
//             return await sock.sendMessage(msg.key.remoteJid, {
//                 text: '❌ Invalid phone number'
//             });
//         }

//         // Convert to JID
//         const jid = `${number}@${S_WHATSAPP_NET}`;

//         // Fetch profile picture
//         const raw = await getProfilePicture(sock, jid);

//         // Extract URL
//         const url = extractPictureUrl(raw);

//         if (!url) {
//             return await sock.sendMessage(msg.key.remoteJid, {
//                 text: '⚠️ User has no profile picture or it is private'
//             });
//         }

//         // Send image
//         await sock.sendMessage(msg.key.remoteJid, {
//             image: { url },
//             caption: `📸 Profile picture of ${number}` 
//         });

//     } catch (error) {
//         console.error('[DP Command Error]:', error);

//         await sock.sendMessage(msg.key.remoteJid, {
//             text: '❌ Failed to fetch profile picture'
//         });
//     }
// }

// // Register command
// registerCommand('dp', {
//     description: 'Get profile picture of any WhatsApp user',
//     usage: 'dp <phone_number>',
//     category: 'Utilities'
// });

// module.exports = handleDpCommand;
