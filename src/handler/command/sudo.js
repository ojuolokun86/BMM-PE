const { addSudoUser, removeSudoUser, checkSudoUser, listSudoUsers, isBotOwner } = require('../../database/database')

// Main sudo command handler
async function handleSudoCommand(sock, msg, chatId, sender, args, matchedOwner) {
  const isOwner = msg.key.fromMe || matchedOwner
  try {
    const sudoCommand = args[0]?.toLowerCase()
    
    // Check if sender has sudo access
    const hasSudoAccess = checkSudoUser(sender)
    console.log('Has sudo access:', hasSudoAccess, 'for sender:', sender)
    console.log('Is bot owner:', isOwner)
    if ( !isOwner) {
      console.log('Access denied for:', sender)
      return sock.sendMessage(chatId, {
        text: '❌ *Access Denied*\n\n🔒 Only Sudo can Use this command.'
      })
    }
    console.log('Sudo command:', sudoCommand)
    
    switch (sudoCommand) {
      case 'add':
        await addSudo(sock, msg, chatId, sender, args)
        break
      case 'remove':
        await removeSudo(sock, msg, chatId, sender, args)
        break
      case 'list':
        await listSudo(sock, msg, chatId, sender)
        break
      default:
        await sock.sendMessage(chatId, {
          text: `❌ Invalid sudo command.\n\n📋 *Available commands:*\n• .sudo add @user\n• .sudo remove @user\n• .sudo list`
        })
    }
  } catch (error) {
    console.error('Error in sudo command:', error)
    sock.sendMessage(chatId, { text: '❌ Failed to execute sudo command.' })
  }
}

// Add user to sudo database
async function addSudo(sock, msg, chatId, sender, args) {
  try {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
    const targetJid = mentioned?.[0] || args[1]

    if (!targetJid) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: .sudo add @user or .sudo add phoneNumber'
      })
    }

    // Add to sudo database
    addSudoUser(targetJid.includes('@') ? targetJid : `${targetJid}@s.whatsapp.net`, sender)

    const username = targetJid.split('@')[0]
    sock.sendMessage(chatId, {
      text: `✅ *Sudo Access Granted*\n\n👤 User: @${username}\n🔑 Status: Authorized\n📅 Added: ${new Date().toLocaleDateString()}`,
      mentions: [targetJid]
    })
  } catch (error) {
    console.error('Error adding sudo user:', error)
    sock.sendMessage(chatId, { text: '❌ Failed to add sudo user.' })
  }
}

// Remove user from sudo database (owner only)
async function removeSudo(sock, msg, chatId, sender, args) {
  try {
    // Check if sender is bot owner
    const isOwner = msg.key.fromMe 
    
    if (!isOwner) {
      return sock.sendMessage(chatId, {
        text: '❌ *Access Denied*\n\n🔒 Only bot owner can remove sudo users.'
      })
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
    const targetJid = mentioned?.[0] || args[1]

    if (!targetJid) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: .sudo remove @user or .sudo remove phoneNumber'
      })
    }

    // Remove from sudo database
    removeSudoUser(targetJid.includes('@') ? targetJid : `${targetJid}@s.whatsapp.net`)

    const username = targetJid.split('@')[0]
    sock.sendMessage(chatId, {
      text: `❌ *Sudo Access Revoked*\n\n👤 User: @${username}\n🔒 Status: Unauthorized\n📅 Removed: ${new Date().toLocaleDateString()}`,
      mentions: [targetJid]
    })
  } catch (error) {
    console.error('Error removing sudo user:', error)
    sock.sendMessage(chatId, { text: '❌ Failed to remove sudo user.' })
  }
}

// List all sudo users (owner only)
async function listSudo(sock, msg, chatId, sender) {
  try {
    // Check if sender is bot owner
    const isOwner = msg.key.fromMe 
    
    if (!isOwner) {
      return sock.sendMessage(chatId, {
        text: '❌ *Access Denied*\n\n🔒 Only bot owner can list sudo users.'
      })
    }

    const sudoUsers = listSudoUsers()

    if (!sudoUsers || sudoUsers.length === 0) {
      return sock.sendMessage(chatId, { text: '📋 No sudo users found.' })
    }

    const lines = sudoUsers.map((user, index) => {
    const jidShort = user.user_jid.split('@')[0];
    const mention = `@${jidShort}`;
    const addedByShort = user.added_by.split('@')[0];
    const addedByMention = `@${addedByShort}`;
    
    return `${index + 1}. ${mention}\n   📅 Added: ${new Date(user.added_at).toLocaleDateString()}\n   👤 Added by: ${addedByMention}`;
  });

  const message = `🔑 *SUDO USERS LIST*\n\n` +
                 `━━━━━━━━━━━━━━━━━━\n\n` +
                 `${lines.join('\n\n')}\n\n` +
                 `━━━━━━━━━━━━━━━━━━\n` +
                 `📊 Total Sudo Users: ${sudoUsers.length}`;

  await sock.sendMessage(chatId, {
    text: message,
    mentions: sudoUsers.map(user => user.user_jid).concat(sudoUsers.map(user => user.added_by))
  });
  } catch (error) {
    console.error('Error listing sudo users:', error)
    sock.sendMessage(chatId, { text: '❌ Failed to fetch sudo users.' })
  }
}

// Check if user has sudo access
async function checkSudo(userJid) {
  try {
    return checkSudoUser(userJid)
  } catch (error) {
    console.error('Error checking sudo access:', error)
    return false
  }
}

module.exports = {
  handleSudoCommand,
  addSudo,
  removeSudo,
  listSudo,
  checkSudo
}
