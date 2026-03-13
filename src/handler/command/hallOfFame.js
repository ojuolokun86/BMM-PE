const supabase = require('../../supabaseClient')
const { checkIfAdmin } = require('./kick')
const { getGroupProfilePicBuffer, getContextInfo } = require('../../utils/groupImagePreview')

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

    // Combine args after @user and split by first comma
    const input = args.slice(1).join(' ')
    const [leagueRaw, ...teamParts] = input.split(',')
    const league = leagueRaw?.trim()
    const team = teamParts.join(',').trim()

    if (!league || !team) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: .addfame @user League, Team'
      })
    }

    // Step 1: Check if exact same user + league + team exists
    const { data: existing } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)
      .eq('user_jid', userJid)
      .eq('league', league)
      .eq('team', team)
      .single()

    let newTrophyCount = 1
    if (existing) {
      // Same team, same league → increment trophies
      newTrophyCount = existing.trophies + 1
      await supabase
        .from('hall_of_fame')
        .update({ trophies: newTrophyCount })
        .eq('id', existing.id)
    } else {
      // Step 2 & 3: Insert new row (new team or new user)
      await supabase.from('hall_of_fame').insert({
        community_jid: community.communityJid,
        community_name: community.communityName,
        user_jid: userJid,
        league,
        team,
        trophies: 1
      })
    }

    // Get user's total trophies in this community
    const { data: userAllTrophies } = await supabase
      .from('hall_of_fame')
      .select('trophies')
      .eq('community_jid', community.communityJid)
      .eq('user_jid', userJid)

    const totalTrophies = userAllTrophies?.reduce((sum, record) => sum + record.trophies, 0) || 0

    // Get total trophies in this community (all users)
    const { data: communityAllTrophies } = await supabase
      .from('hall_of_fame')
      .select('trophies')
      .eq('community_jid', community.communityJid)

    const communityTotalTrophies = communityAllTrophies?.reduce((sum, record) => sum + record.trophies, 0) || 0

    // Get user's total trophies across ALL communities
    const userGlobalTrophies = await supabase
      .from('hall_of_fame')
      .select('trophies')
      .eq('user_jid', userJid)
      .then(({ data }) => data?.reduce((sum, record) => sum + record.trophies, 0) || 0)

    // Get user's rank category
    function getRankCategory(trophies) {
      if (trophies >= 10) return { category: 'LEGEND', emoji: '👑', stars: '⭐⭐⭐⭐⭐⭐', nextTier: 'Already at the top!' }
      if (trophies >= 7) return { category: 'CHAMPION', emoji: '🏆', stars: '⭐⭐⭐⭐⭐', nextTier: 'Legend (10 trophies)', needed: 10 - trophies }
      if (trophies >= 5) return { category: 'MASTER', emoji: '🥇', stars: '⭐⭐⭐⭐', nextTier: 'Champion (7 trophies)', needed: 7 - trophies }
      if (trophies >= 3) return { category: 'EXPERT', emoji: '🥈', stars: '⭐⭐⭐', nextTier: 'Master (5 trophies)', needed: 5 - trophies }
      if (trophies >= 2) return { category: 'RISING STAR', emoji: '🌟', stars: '⭐⭐', nextTier: 'Expert (3 trophies)', needed: 3 - trophies }
      if (trophies >= 1) return { category: 'ROOKIE', emoji: '🔰', stars: '⭐', nextTier: 'Rising Star (2 trophies)', needed: 2 - trophies }
      return { category: 'NEWCOMER', emoji: '🌱', stars: '', nextTier: 'Rookie (1 trophy)', needed: 1 }
    }

    const rankInfo = getRankCategory(totalTrophies)

    // Create personalized message
    let message = `🏆 *HALL OF FAME UPDATE*\n\n`
    message += `🎉 Congratulations @${userJid.split('@')[0]}! 🎉\n\n`
    message += `📝 You've been added to the *Hall of Fame* in **${community.communityName}** community!\n\n`
    message += `🏟️ *Achievement:* ${league} - ${team}\n`
    message += `🏆 *Trophies in this entry:* ${newTrophyCount}\n`
    message += `📊 *Total trophies in community:* ${communityTotalTrophies}\n`
    message += `🏅 *Total trophies won by you:* ${totalTrophies}\n\n`
    message += `${rankInfo.emoji} *Current Rank:* ${rankInfo.category} ${rankInfo.stars}\n\n`

    if (totalTrophies === 1) {
      message += `🌟 *Amazing start!* You've earned your first trophy and are now a **ROOKIE**!\n`
      message += `🎯 *Next goal:* Earn 1 more trophy to become a **Rising Star**!`
    } else if (totalTrophies === 2) {
      message += `🌟 *Great progress!* You're now a **RISING STAR**!\n`
      message += `🎯 *Next goal:* Earn 1 more trophy to become an **EXPERT**!`
    } else if (totalTrophies === 3) {
      message += `⭐ *Impressive!* You've reached **EXPERT** level!\n`
      message += `🎯 *Next goal:* Earn 2 more trophies to become a **MASTER**!`
    } else if (totalTrophies === 5) {
      message += `⭐⭐ *Outstanding!* You're now a **MASTER**!\n`
      message += `🎯 *Next goal:* Earn 2 more trophies to become a **CHAMPION**!`
    } else if (totalTrophies === 7) {
      message += `⭐⭐⭐ *Incredible!* You've achieved **CHAMPION** status!\n`
      message += `🎯 *Next goal:* Earn 3 more trophies to become a **LEGEND**!`
    } else if (totalTrophies >= 10) {
      message += `👑 *LEGENDARY!* You're a true **LEGEND** of this community!\n`
      message += `🏆 *You've reached the pinnacle of success!*`
    } else {
      message += `🎯 *Next goal:* Earn ${rankInfo.needed} more trophy${rankInfo.needed > 1 ? 's' : ''} to become a **${rankInfo.nextTier.split('(')[0].trim()}**!`
    }

    message += `\n\n━━━━━━━━━━━━━━━━━━\n`
    message += `🔥 Keep climbing the ranks! 🔥`

    await sock.sendMessage(chatId, {
      text: message,
      mentions: [userJid]
    })
  } catch (e) {
    console.error(e)
    sock.sendMessage(chatId, { text: '❌ Failed to add fame.' })
  }
}


// Helper to normalize league names
function normalizeLeague(name) {
  if (!name) return 'Unknown League'
  // Remove "season", "season X", "1", "2" etc at the end
  return name
    .toLowerCase()
    .replace(/season\s*\d+/i, '')
    .replace(/\d+$/, '')
    .trim()
    .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letters
}

async function showFame(sock, chatId) {
  try {
    const groupPicBuffer = await getGroupProfilePicBuffer(sock, chatId)
    const community = await getCommunityInfo(sock, chatId)
    if (!community) return sock.sendMessage(chatId, { text: '📜 This group is not part of a community.' })

    const { data: winners, error } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)
      .order('trophies', { ascending: false })

    if (error) throw error
    if (!winners || winners.length === 0) {
      return sock.sendMessage(chatId, {
        text: `📜 No Hall of Fame entries yet.\n👑 Community Owner: @${community.communityJid.split('@')[0]}`,
        mentions: [community.communityJid]
      })
    }

    // Group by normalized league
    const leagueMap = {}
    for (const win of winners) {
      const leagueName = normalizeLeague(win.league)
      if (!leagueMap[leagueName]) leagueMap[leagueName] = {}
      if (!leagueMap[leagueName][win.user_jid]) leagueMap[leagueName][win.user_jid] = []
      leagueMap[leagueName][win.user_jid].push({ team: win.team, trophies: win.trophies })
    }

    let text = `🏆 *HALL OF FAME — ${community.communityName}*\n`
    text += `━━━━━━━━━━━━━━━━━━\n`
    text += `🔥 *LEGENDS* 🔥\n\n`

    const mentions = []

    const communityMeta = await sock.groupMetadata(community.communityJid)
    if (communityMeta.owner) {
      mentions.push(communityMeta.owner)
      text += `👑 Community Owner: @${communityMeta.owner.split('@')[0]}\n\n`
    }

    for (const leagueName of Object.keys(leagueMap)) {
      text += `🏟️ ${leagueName}\n`
      const users = leagueMap[leagueName]
      for (const userJid of Object.keys(users)) {
        mentions.push(userJid)
        const teamStr = users[userJid]
          .map(t => `${t.team} x${t.trophies}`)
          .join(', ')
        const totalTrophies = users[userJid].reduce((sum, t) => sum + t.trophies, 0)
        text += `🥇 @${userJid.split('@')[0]} — [${teamStr}] ${'🏆'.repeat(totalTrophies)}\n`
      }
      text += '\n'
    }

    text += `━━━━━━━━━━━━━━━━━━\n`
    text += `🔥 Only Legends made it up here 🔥`

    await sock.sendMessage(chatId, { text, mentions, contextInfo: getContextInfo({
      title: community.communityName,
      body: 'Hall of Fame',
      thumbnail: groupPicBuffer
    }) })
  } catch (e) {
    console.error(e)
    await sock.sendMessage(chatId, { text: '❌ Failed to load Hall of Fame.' })
  }
}

async function showStats(sock, chatId) {
  try {
    const groupPicBuffer = await getGroupProfilePicBuffer(sock, chatId)
    const community = await getCommunityInfo(sock, chatId)
    if (!community) return sock.sendMessage(chatId, { text: '📜 This group is not part of a community.' })

    const { data: allWinners, error } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)

    if (error) throw error
    if (!allWinners || allWinners.length === 0) {
      return sock.sendMessage(chatId, {
        text: `📊 No trophy data yet.\n👑 Community Owner: @${community.communityJid.split('@')[0]}`,
        mentions: [community.communityJid]
      })
    }

    // Aggregate trophies per user
    const userStats = {}
    for (const win of allWinners) {
      if (!userStats[win.user_jid]) {
        userStats[win.user_jid] = {
          userJid: win.user_jid,
          totalTrophies: 0,
          leagues: {},
          communityName: win.community_name
        }
      }
      userStats[win.user_jid].totalTrophies += win.trophies
      
      // Use normalized league name (same as showFame)
      const normalizedLeague = normalizeLeague(win.league)
      if (!userStats[win.user_jid].leagues[normalizedLeague]) {
        userStats[win.user_jid].leagues[normalizedLeague] = []
      }
      userStats[win.user_jid].leagues[normalizedLeague].push({
        team: win.team,
        trophies: win.trophies,
        originalLeague: win.league // Keep original for reference
      })
    }

    // Sort users by total trophies (highest to lowest)
    const sortedUsers = Object.values(userStats).sort((a, b) => b.totalTrophies - a.totalTrophies)

    // Categorize users based on trophy count
    function getRankCategory(trophies) {
      if (trophies >= 10) return { category: 'LEGEND', emoji: '👑', stars: '⭐⭐⭐⭐⭐⭐' }
      if (trophies >= 7) return { category: 'CHAMPION', emoji: '🏆', stars: '⭐⭐⭐⭐⭐' }
      if (trophies >= 5) return { category: 'MASTER', emoji: '🥇', stars: '⭐⭐⭐⭐' }
      if (trophies >= 3) return { category: 'EXPERT', emoji: '🥈', stars: '⭐⭐⭐' }
      if (trophies >= 2) return { category: 'RISING STAR', emoji: '🌟', stars: '⭐⭐' }
      if (trophies >= 1) return { category: 'ROOKIE', emoji: '🔰', stars: '⭐' }
      return { category: 'NEWCOMER', emoji: '🌱', stars: '' }
    }

    let text = `🏆 *TROPHY STATS — ${community.communityName}*\n`
    text += `━━━━━━━━━━━━━━━━━━\n`
    text += `📊 Total Players: ${sortedUsers.length}\n`
    text += `🏆 Total Trophies: ${sortedUsers.reduce((sum, u) => sum + u.totalTrophies, 0)}\n\n`

    const mentions = []
    
    // Display top 10 users
    const topUsers = sortedUsers.slice(0, 10)
    
    for (let i = 0; i < topUsers.length; i++) {
      const user = topUsers[i]
      const rank = i + 1
      const category = getRankCategory(user.totalTrophies)
      
      mentions.push(user.userJid)
      
      // Rank number with medal
      let rankEmoji = ''
      if (rank === 1) rankEmoji = '🥇'
      else if (rank === 2) rankEmoji = '🥈'
      else if (rank === 3) rankEmoji = '🥉'
      else rankEmoji = `${rank}.`
      
      text += `${rankEmoji} ${category.emoji} @${user.userJid.split('@')[0]}\n`
      text += `   🏆 ${user.totalTrophies} trophies | ${category.category} ${category.stars}\n`
      
      // Show top 3 leagues for this user
      const userLeagues = Object.entries(user.leagues)
        .map(([league, teams]) => ({
          league,
          totalTrophies: teams.reduce((sum, t) => sum + t.trophies, 0),
          teams
        }))
        .sort((a, b) => b.totalTrophies - a.totalTrophies)
        .slice(0, 3)
      
      if (userLeagues.length > 0) {
        text += `   📋 Top Leagues:\n`
        userLeagues.forEach((leagueData, idx) => {
          const teamStr = leagueData.teams
            .map(t => `${t.team} x${t.trophies}`)
            .join(', ')
          text += `      ${idx + 1}. ${leagueData.league}: ${teamStr}\n`
        })
      }
      text += '\n'
    }

    // Show category breakdown
    text += `━━━━━━━━━━━━━━━━━━\n`
    text += `📊 *CATEGORY BREAKDOWN*\n\n`
    
    const categoryCount = {}
    sortedUsers.forEach(user => {
      const category = getRankCategory(user.totalTrophies).category
      categoryCount[category] = (categoryCount[category] || 0) + 1
    })

    const categories = ['LEGEND', 'CHAMPION', 'MASTER', 'EXPERT', 'RISING STAR', 'ROOKIE']
    categories.forEach(cat => {
      const count = categoryCount[cat] || 0
      const catInfo = getRankCategory(
        cat === 'LEGEND' ? 10 :
        cat === 'CHAMPION' ? 7 :
        cat === 'MASTER' ? 5 :
        cat === 'EXPERT' ? 3 :
        cat === 'RISING STAR' ? 1 : 0
      )
      text += `${catInfo.emoji} ${cat}: ${count} player${count !== 1 ? 's' : ''}\n`
    })

    text += `\n⭐ *1-2 trophies: Rising Star*\n`
    text += `⭐⭐ *3-4 trophies: Expert*\n`
    text += `⭐⭐⭐ *5-6 trophies: Master*\n`
    text += `⭐⭐⭐⭐ *7-9 trophies: Champion*\n`
    text += `⭐⭐⭐⭐⭐ *10+ trophies: Legend*\n`

    await sock.sendMessage(chatId, { 
      text, 
      mentions, 
      contextInfo: getContextInfo({
        title: community.communityName,
        body: 'Trophy Statistics',
        thumbnail: groupPicBuffer
      })
    })
  } catch (e) {
    console.error(e)
    await sock.sendMessage(chatId, { text: '❌ Failed to load trophy statistics.' })
  }
}

module.exports = {
  addFame,
  showFame,
  showStats
}