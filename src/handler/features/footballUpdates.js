// e:\Bot development\BOT V2\BMM DEV V2\src\features\footballUpdates.js

const { db } = require('../../database/database');
const { footballApp } = require('./footballApp');
const sendToUser = require('../../utils/sendToChat');

// Cache for storing temporary data to avoid too many API calls
const cache = {
  lastUpdate: null,
  fixtures: {
    today: null,
    tomorrow: null,
    dayAfter: null
  },
  standings: {},
  news: [],
  results: {}
};

/**
 * Get all followed teams from all users
 * @returns {Array} Array of all followed teams with user info
 */
function getAllFollowedTeams() {
    try {
      // Get all users and handle the JSON parsing more carefully
      const users = db.prepare(`
        SELECT user_id, followed_teams 
        FROM users 
        WHERE followed_teams IS NOT NULL 
        AND followed_teams != '[]' 
        AND followed_teams != ''
        AND json_valid(followed_teams) = 1
      `).all();
      
      const allTeams = [];
      
      users.forEach(user => {
        try {
          let teams;
          try {
            teams = JSON.parse(user.followed_teams);
          } catch (e) {
            console.error(`Invalid JSON in followed_teams for user ${user.user_id}:`, user.followed_teams);
            return;
          }
          
          if (Array.isArray(teams)) {
            teams.forEach(team => {
              if (team && typeof team === 'object' && team.id) {
                allTeams.push({
                  userId: user.user_id,
                  teamId: team.id,
                  teamName: team.name || `Team ${team.id}`
                });
              }
            });
          }
        } catch (e) {
          console.error(`Error processing teams for user ${user.user_id}:`, e);
        }
      });
      
      return allTeams;
    } catch (error) {
      console.error('Error in getAllFollowedTeams:', error);
      return [];
    }
  }

/**
 * Get fixtures for a specific date
 * @param {Date|string} date - Date object or date string (YYYY-MM-DD) to get fixtures for
 * @returns {Promise<Array>} Array of fixtures
 */
async function getFixturesByDate(date) {
  try {
    let dateStr;
    if (date instanceof Date) {
      dateStr = date.toISOString().split('T')[0];
    } else if (typeof date === 'string') {
      // Validate date string format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD');
      }
      dateStr = date;
    } else {
      throw new Error('Invalid date parameter. Expected Date object or YYYY-MM-DD string');
    }
    
    // Get all followed teams first
    const followedTeams = getAllFollowedTeams();
    const teamIds = [...new Set(followedTeams.map(t => t.teamId))];
    
    if (teamIds.length === 0) return [];
    
    // Get fixtures for each team and combine results
    const allFixtures = [];
    for (const teamId of teamIds) {
      try {
        const response = await footballApp('teamMatches', teamId, { date: dateStr });
        if (response && Array.isArray(response.events)) {
          allFixtures.push(...response.events);
        }
      } catch (error) {
        console.error(`Error getting fixtures for team ${teamId}:`, error);
      }
    }
    
    return allFixtures;
  } catch (error) {
    console.error('Error getting fixtures:', error);
    return [];
  }
}

/**
 * Get yesterday's results for followed teams
 * @returns {Promise<Array>} Array of results
 */
async function getYesterdaysResults() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    // Get all followed teams first
    const followedTeams = getAllFollowedTeams();
    const teamIds = [...new Set(followedTeams.map(t => t.teamId))];
    
    if (teamIds.length === 0) return [];
    
    // Get results for each team and combine them
    const allResults = [];
    for (const teamId of teamIds) {
      try {
        const response = await footballApp('teamMatches', teamId, { date: dateStr });
        if (response && Array.isArray(response.events)) {
          allResults.push(...response.events);
        }
      } catch (error) {
        console.error(`Error getting results for team ${teamId}:`, error);
      }
    }
    
    return allResults;
  } catch (error) {
    console.error('Error getting yesterday\'s results:', error);
    return [];
  }
}

/**
 * Get league standings
 * @param {string} leagueId - League ID
 * @returns {Promise<Object>} League standings
 */
async function getLeagueStandings(leagueId) {
  try {
    if (cache.standings[leagueId] && 
        cache.standings[leagueId].timestamp > Date.now() - 3600000) { // 1 hour cache
      return cache.standings[leagueId].data;
    }

    const response = await footballApp('standings', { league: leagueId });
    cache.standings[leagueId] = {
      data: response,
      timestamp: Date.now()
    };
    return response;
  } catch (error) {
    console.error(`Error getting standings for league ${leagueId}:`, error);
    return null;
  }
}

/**
 * Get latest football news
 * @returns {Promise<Array>} Array of news articles
 */
async function getFootballNews() {
  try {
    // Check cache first
    if (cache.news.length > 0 && cache.lastUpdate > Date.now() - 3600000) { // 1 hour cache
      return cache.news;
    }

    // In a real implementation, you would fetch from a news API
    // This is a placeholder - replace with actual news API call
    const news = []; // await newsApi.getFootballNews();
    
    cache.news = news;
    cache.lastUpdate = Date.now();
    return news;
  } catch (error) {
    console.error('Error getting football news:', error);
    return [];
  }
}

/**
 * Format date with timezone support
 * @param {string|Date} date - Date to format
 * @param {string} timeZone - IANA timezone (e.g., 'Europe/London')
 * @returns {string} Formatted date string
 */
function formatDateWithTimezone(date, timeZone = 'UTC') {
    return new Date(date).toLocaleString('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  
  /**
   * Check for upcoming matches and send notifications
   */
  async function checkUpcomingMatches() {
    try {
      const now = new Date();
      const today = new Date(now);
      const tomorrow = new Date(now);
      const dayAfter = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dayAfter.setDate(dayAfter.getDate() + 2);
  
      // Format dates for API (YYYY-MM-DD)
      const formatDate = (date) => date.toISOString().split('T')[0];
      
      // Get fixtures for today, tomorrow, and day after
      const [todayFixtures, tomorrowFixtures, dayAfterFixtures] = await Promise.all([
        getFixturesByDate(today),
        getFixturesByDate(tomorrow),
        getFixturesByDate(dayAfter)
      ]);
  
      // Process and store fixtures with timezone handling
      const processWithTZ = (fixtures) => {
        const processed = processFixtures(fixtures);
        // Add formatted date with timezone for display
        return processed.map(match => ({
          ...match,
          formattedDate: formatDateWithTimezone(match.date, 'Europe/London') // Adjust timezone as needed
        }));
      };
  
      cache.fixtures = {
        today: processWithTZ(todayFixtures),
        tomorrow: processWithTZ(tomorrowFixtures),
        dayAfter: processWithTZ(dayAfterFixtures)
      };
  
      // Get all followed teams
      const followedTeams = getAllFollowedTeams();
      
      // Check each user's followed teams for upcoming matches
      const userMatches = new Map(); // userId -> { matches: Map<matchId, match>, teams: [] }
  
      followedTeams.forEach(({ userId, teamId, teamName }) => {
        const upcomingMatches = [
          ...findTeamMatches(cache.fixtures.today, teamId),
          ...findTeamMatches(cache.fixtures.tomorrow, teamId),
          ...findTeamMatches(cache.fixtures.dayAfter, teamId)
        ];
  
        if (upcomingMatches.length > 0) {
          if (!userMatches.has(userId)) {
            userMatches.set(userId, { 
              matches: new Map(), // Using Map to deduplicate by match ID
              teams: new Map()    // Using Map to store unique teams
            });
          }
          
          const userData = userMatches.get(userId);
          
          // Add matches, using match ID as key to prevent duplicates
          upcomingMatches.forEach(match => {
            userData.matches.set(match.id, match);
          });
          
          // Add team if not already present
          if (!userData.teams.has(teamId)) {
            userData.teams.set(teamId, { id: teamId, name: teamName });
          }
        }
      });
  
      // Process and send notifications for each user
      for (const [userId, data] of userMatches.entries()) {
        // Convert Map values back to array for compatibility
        const uniqueMatches = Array.from(data.matches.values());
        const userTeams = Array.from(data.teams.values());
        
        if (uniqueMatches.length > 0) {
          await sendUpcomingMatchesNotification(userId, uniqueMatches, userTeams);
        }
      }
  
    } catch (error) {
      console.error('Error checking upcoming matches:', error);
    }
  }

/**
 * Process raw fixtures data
 */
function processFixtures(fixtures) {
  return fixtures.map(match => ({
    id: match.id,
    homeTeam: match.homeTeam?.name || 'Unknown',
    awayTeam: match.awayTeam?.name || 'Unknown',
    homeTeamId: match.homeTeam?.id,
    awayTeamId: match.awayTeam?.id,
    competition: match.competition?.name || 'Unknown',
    date: match.utcDate,
    status: match.status,
    score: match.score?.fullTime || {}
  }));
}

/**
 * Find matches for a specific team
 */
function findTeamMatches(fixtures, teamId) {
  if (!fixtures) return [];
  return fixtures.filter(match => 
    match.homeTeamId === teamId || match.awayTeamId === teamId
  );
}

/**
 * Send upcoming matches notification to a user
 */
async function sendUpcomingMatchesNotification(userId, matches, teams) {
  if (matches.length === 0) return;

  try {
    // Group matches by date
    const matchesByDate = {};
    matches.forEach(match => {
      const matchDate = new Date(match.date).toDateString();
      if (!matchesByDate[matchDate]) {
        matchesByDate[matchDate] = [];
      }
      matchesByDate[matchDate].push(match);
    });

    // Create message
    let message = '📅 *Upcoming Matches*\n\n';
    teams.forEach(team => {
      message += `⚽ *${team.name}*\n`;
    });
    message += '\n';

    Object.entries(matchesByDate).forEach(([date, dateMatches]) => {
      message += `📆 *${new Date(date).toLocaleDateString()}*\n`;
      dateMatches.forEach(match => {
        const matchTime = new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        message += `🕒 ${matchTime} - ${match.homeTeam} vs ${match.awayTeam}\n`;
        message += `   ${match.competition}\n\n`;
      });
    });

    // Get the user's chat ID from database
    const user = db.prepare('SELECT user_id, phone_number FROM users WHERE user_id = ?').get(userId);
    
    if (user && user.phone_number) {
      const chatId = `${user.phone_number}@s.whatsapp.net`;
      
      // Add a small delay to ensure connection is stable
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        // Get the bot instance from global store
        const { getBotInstance } = require('../../utils/globalStore');
        const bot = getBotInstance(userId);
        
        if (bot && bot.sock) {
          await bot.sock.sendMessage(chatId, { text: message });
          console.log(`[NOTIFICATION] Sent to user ${userId} (${chatId})`);
        } else {
          console.error(`[NOTIFICATION] Bot instance not found for user ${userId}`);
        }
      } catch (error) {
        console.error(`[NOTIFICATION] Error sending to user ${userId}:`, error);
      }
    } else {
      console.error(`[NOTIFICATION] User ${userId} has no phone number registered`);
    }

  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
  }
}

/**
 * Check for yesterday's results and send notifications
 */
async function checkYesterdaysResults() {
    try {
      const followedTeams = getAllFollowedTeams();
      if (followedTeams.length === 0) return;
  
      // Group by user ID
      const userTeams = new Map();
      followedTeams.forEach(({ userId, teamId, teamName }) => {
        if (!userTeams.has(userId)) {
          userTeams.set(userId, []);
        }
        userTeams.get(userId).push({ id: teamId, name: teamName });
      });
  
      // Get yesterday's date in YYYY-MM-DD format
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
  
      // Get matches for yesterday
      const matches = await getFixturesByDate(dateStr);
      if (!matches || matches.length === 0) return;
  
      // Process results for each user
      for (const [userId, teams] of userTeams.entries()) {
        const userMatches = matches.filter(match => 
          teams.some(team => 
            match.homeTeam?.id === team.id || 
            match.awayTeam?.id === team.id
          )
        );
  
        if (userMatches.length > 0) {
          await sendResultsNotification(userId, userMatches);
        }
      }
  
    } catch (error) {
      console.error('Error checking yesterday\'s results:', error);
    }
  }

/**
 * Send match results notification to a user
 */

async function sendResultsNotification(userId, matches) {
  if (matches.length === 0) {
    console.log(`[FOOTBALL] No matches to send for user ${userId}`);
    return;
  }

  try {
    // Group matches by competition
    const matchesByCompetition = {};
    matches.forEach(match => {
      const comp = match.competition?.name || match.competition || 'Other Competitions';
      if (!matchesByCompetition[comp]) {
        matchesByCompetition[comp] = [];
      }
      matchesByCompetition[comp].push(match);
    });

    // Create message
    let message = '⚽ *Match Results* ⚽\n\n';
    
    Object.entries(matchesByCompetition).forEach(([competition, compMatches]) => {
      message += `🏆 *${competition}*\n\n`;
      
      compMatches.forEach(match => {
        const homeTeam = match.homeTeam?.name || match.homeTeam || 'Unknown';
        const awayTeam = match.awayTeam?.name || match.awayTeam || 'Unknown';
        const homeScore = match.score?.fullTime?.homeTeam ?? '?';
        const awayScore = match.score?.fullTime?.awayTeam ?? '?';
        const matchStatus = match.status || 'FT';
        
        message += `⚽ *${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}*\n`;
        message += `⏱️ ${matchStatus}\n`;
        
        if (match.goals && match.goals.length > 0) {
          message += '🎯 Goals: ';
          const scorers = match.goals
            .filter(g => g.scorer) // Ensure scorer exists
            .map(g => `${g.scorer} (${g.minute || '??'})`);
          
          if (scorers.length > 0) {
            message += scorers.join(', ');
          } else {
            message += 'No scorer information available';
          }
          message += '\n';
        }
        
        message += '\n';
      });
    });

    console.log(`[FOOTBALL] Preparing to send updates for user ${userId}`);
    
    // Get the user's chat ID from database with error handling
    let user;
    try {
      user = db.prepare('SELECT user_id, phone_number FROM users WHERE user_id = ?').get(userId);
      if (!user) {
        throw new Error('User not found in database');
      }
      if (!user.phone_number) {
        throw new Error('User phone number not found');
      }
      console.log(`[FOOTBALL] Found user ${userId} in database`);
    } catch (dbError) {
      console.error(`[FOOTBALL] Database error for user ${userId}:`, dbError.message);
      return; // Exit if we can't get user data
    }
    
    const chatId = `${user.phone_number}@s.whatsapp.net`;
    console.log(`[FOOTBALL] Prepared chat ID: ${chatId}`);
    
    // Add a small delay to ensure connection is stable
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get the bot instance from global store
    let bot;
    try {
      const { getBotInstance } = require('../../utils/globalStore');
      bot = getBotInstance(userId);
      
      if (!bot) {
        throw new Error('Bot instance not found');
      }
      if (!bot.sock) {
        throw new Error('Bot socket not available');
      }
      console.log(`[FOOTBALL] Retrieved bot instance for user ${userId}`);
    } catch (botError) {
      console.error(`[FOOTBALL] Bot instance error for user ${userId}:`, botError.message);
      return; // Exit if we can't get bot instance
    }
    
    // Send the message with retry logic
    const maxRetries = 2;
    let attempt = 0;
    let success = false;
    
    while (attempt <= maxRetries && !success) {
      try {
        const startTime = Date.now();
        await bot.sock.sendMessage(chatId, { text: message });
        const endTime = Date.now();
        console.log(`[FOOTBALL] Successfully sent update to ${userId} in ${endTime - startTime}ms (attempt ${attempt + 1})`);
        success = true;
      } catch (sendError) {
        attempt++;
        if (attempt > maxRetries) {
          console.error(`[FOOTBALL] Failed to send update to ${userId} after ${maxRetries} attempts:`, sendError.message);
        } else {
          console.warn(`[FOOTBALL] Attempt ${attempt} failed for ${userId}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
        }
      }
    }
  } catch (error) {
    console.error(`[FOOTBALL] Error in sendResultsNotification for user ${userId}:`, error);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}
// Export functions
module.exports = {
  checkUpcomingMatches,
  checkYesterdaysResults,
  getFootballNews,
  getAllFollowedTeams,
  getLeagueStandings
};