const { checkSudo } = require('../command/sudo')
const { isBotOwner } = require('../../database/database')

// Middleware to check sudo access
async function sudoMiddleware(sock, msg, chatId, sender, next) {
  // Check if sender is bot owner using existing system
  const botOwner = isBotOwner(sender)
  console.log('Bot owner:', botOwner, 'for sender:', sender)
  
  if (botOwner) {
    return next() // Bot owner always has access
  }
  
  // Check if user has sudo access
  const hasSudo = await checkSudo(sender)
  
  if (hasSudo) {
    return next() // User has sudo access
  }
  
  // User doesn't have access
  return sock.sendMessage(chatId, {
    text: '❌ *Access Denied*\n\n🔒 You need sudo access to use this command.\n\n📞 Contact bot owner for access.'
  })
}

module.exports = { sudoMiddleware }
