const supabase = require('../../supabaseClient')
const { checkIfAdmin } = require('./kick')

async function getCommunityInfo(sock, groupJid) {
  try {
    //console.log(`🔍 Fetching metadata for group: ${groupJid}`)
    const groupMeta = await sock.groupMetadata(groupJid)
    //console.log('📋 groupMeta:', groupMeta)

    // Check if the group is part of a community
    if (!groupMeta.linkedParent) {
      //console.log('⚠️ This group is NOT part of any community.')
      return null
    }

    //console.log(`🔗 This group belongs to community: ${groupMeta.linkedParent}`)
    
    const communityMeta = await sock.groupMetadata(groupMeta.linkedParent)
    //console.log('🏘️ communityMeta:', communityMeta)

    return {
      communityJid: groupMeta.linkedParent,
      communityName: communityMeta.subject || 'Unknown Community'
    }
  } catch (error) {
    console.error('❌ getCommunityInfo error:', error)
    return null
  }
}


async function addFame(sock, msg, chatId, sender, args) {
  try {
    const isAdmin = await checkIfAdmin(sock, chatId, sender)
    const community = await getCommunityInfo(sock, chatId)
    if (!community) {
      return sock.sendMessage(chatId, {
        text: '❌ This command works only inside a *community group*.'
      })
    }
    if (!isAdmin) {
      return sock.sendMessage(chatId, {
        text: '❌ You must be an admin to use this command.'
      })
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
    if (!mentioned || mentioned.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ Mention a user.\nUsage: .addfame @user League, Team'
      })
    }

    const userJid = mentioned[0]

    // Rejoin the args into one string, then split by first comma
    const input = args.slice(1).join(' ') // everything after @user
    const [leagueRaw, ...teamParts] = input.split(',')
    const league = leagueRaw?.trim()
    const team = teamParts.join(',').trim() // in case team has commas

    if (!league || !team) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: .addfame @user League, Team'
      })
    }

    // Check if already exists
    const { data: existing } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)
      .eq('user_jid', userJid)
      .eq('league', league)
      .single()

    if (existing) {
      await supabase
        .from('hall_of_fame')
        .update({ trophies: existing.trophies + 1 })
        .eq('id', existing.id)
    } else {
      await supabase.from('hall_of_fame').insert({
        community_jid: community.communityJid,
        community_name: community.communityName,
        user_jid: userJid,
        league,
        team,
        trophies: 1
      })
    }

    await sock.sendMessage(chatId, {
      text: `🏆 Fame added successfully for ${league} - ${team}`,
      mentions: [userJid]
    })
  } catch (e) {
    console.error(e)
    sock.sendMessage(chatId, { text: '❌ Failed to add fame.' })
  }
}


async function showFame(sock, chatId) {
  try {
    const community = await getCommunityInfo(sock, chatId)
    //console.log('community', community)
    if (!community) {
      return sock.sendMessage(chatId, {
        text: '📜 This group is not part of a community.'
      })
    }

    const { data: winners, error } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)
      .order('trophies', { ascending: false })

    if (error) throw error

    let text = `🏆 *HALL OF FAME — ${community.communityName}*\n`
    text += `━━━━━━━━━━━━━━━━━━\n`
    text += `🔥 *LEGENDS* 🔥\n\n`

    const mentions = []

    // Always mention the community owner
    const communityMeta = await sock.groupMetadata(community.communityJid)
    if (communityMeta.owner) {
      mentions.push(communityMeta.owner)
      text += `👑 Community Owner: @${communityMeta.owner.split('@')[0]}\n\n`
    }

    if (!winners || winners.length === 0) {
      text += `📜 No Hall of Fame entries yet.\n`
    } else {
      winners.forEach((winner, index) => {
        const userJid = winner.user_jid
        mentions.push(userJid)
        text += `${index + 1}. @${userJid.split('@')[0]} — ${winner.team} (${winner.league}) 🏆x${winner.trophies}\n`
      })
    }

    text += `━━━━━━━━━━━━━━━━━━\n`
    text += `🔥 Only Legends made it up here 🔥`

    await sock.sendMessage(chatId, {
      text,
      mentions
    })
  } catch (e) {
    console.error(e)
    await sock.sendMessage(chatId, { text: '❌ Failed to load Hall of Fame.' })
  }
}



module.exports = {
  addFame,
  showFame
}