const { footballApp } = require('../features/footballApp');
const sendToChat = require('../../utils/sendToChat');
const { followedTeams, addFollowedTeam, removeFollowedTeam, isFollowingTeam } = require('../../database/database');

/**
 * Main command handler for football commands
 */
class FootballCommands {
  constructor(sock, msg, from, textMsg, prefix, userId) {
    this.sock = sock;
    this.msg = msg;
    this.from = from;
    this.textMsg = textMsg;
    this.prefix = prefix;
    this.userId = userId;
    this.leagues = {
      'epl': 'Premier League',
      'premier league': 'Premier League',
      'laliga': 'La Liga',
      'la liga': 'La Liga',
      'serie a': 'Serie A',
      'bundesliga': 'Bundesliga',
      'ligue 1': 'Ligue 1',
      'ligue one': 'Ligue 1',
      'champions league': 'UEFA Champions League',
      'europa league': 'UEFA Europa League',
      'conference league': 'UEFA Europa Conference League',
      'eredivisie': 'Eredivisie',
      'primeira liga': 'Liga Portugal',
      'süper lig': 'Süper Lig',
      'mls': 'MLS',
      'brasileirão': 'Brasileirão',
      'super liga': 'Superliga Argentina'
    };
    this.commands = {
      search: this.handleSearch.bind(this),
      follow: this.handleFollowTeam.bind(this),
      myteams: this.handleMyTeams.bind(this),
      league: this.handleLeagueStandings.bind(this),
      featured: this.handleFeaturedMatches.bind(this),
      help: this.showHelp.bind(this)
    };
  }

  /**
 * Handle follow team command
 * @param {string} query - Team number from search results
 */
  async handleFollowTeam(query) {
    if (!query) {
      return this.sendMessage(
        `Please specify a team name to follow.\nExample: *${this.prefix}football follow [team name]*`
      );
    }
  
    try {
      // Search for the team
      const searchResult = await footballApp('search', query);
      
      if (!searchResult?.teams?.length) {
        return this.sendMessage(`❌ No teams found matching "${query}".`);
      }
      
      const team = searchResult.teams[0];
      const teamId = team.id;
      const teamName = team.name;
      
      // Check if already following
      if (isFollowingTeam(this.userId, teamId)) {
        // Unfollow the team
        const success = removeFollowedTeam(this.userId, teamId);
        if (success) {
          return this.sendMessage(`✅ You have unfollowed *${teamName}*.`);
        } else {
          return this.sendMessage('❌ Failed to unfollow the team. Please try again.');
        }
      } else {
        // Follow the team
        const success = addFollowedTeam(this.userId, { id: teamId, name: teamName });
        if (success) {
          return this.sendMessage(`✅ You are now following *${teamName}*! You'll receive updates about this team.`);
        } else {
          return this.sendMessage('❌ Failed to follow the team. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error in follow team:', error);
      return this.sendMessage('❌ An error occurred while processing your request. Please try again.');
    }
  }
  /**
   * Handle my teams command
   * list all followed teams
   */
  
  // Add a new function to list followed teams
  async handleMyTeams() {
    try {
      //console.log(`[DEBUG] Getting teams for user ${this.userId}`);
      const teams = followedTeams(this.userId);
      //console.log(`[DEBUG] Retrieved teams:`, teams);
      
      if (teams.length === 0) {
        //console.log(`[DEBUG] No teams found for user ${this.userId}`);
        return this.sendMessage('You are not following any teams yet. Use the search command to find and follow teams!');
      }
      
      //console.log(`[DEBUG] Building teams list for display`);
      let message = '⚽ *Your Followed Teams* ⚽\n\n';
      teams.forEach((team, index) => {
        const followDate = new Date(team.followedAt).toLocaleDateString();
        message += `${index + 1}. *${team.name}*\n   Followed on: ${followDate}\n\n`;
      });
      
      //console.log(`[DEBUG] Sending teams list to user`);
      return this.sendMessage(message);
    } catch (error) {
      console.error('[ERROR] Error in handleMyTeams:', error);
      return this.sendMessage('❌ Failed to get your followed teams. Please try again.');
    }
  }

  /**
   * Process the incoming command
   */
  async process() {
    try {
      // Remove the command prefix and any extra spaces
      let commandText = this.textMsg.trim();
      
      // Handle both prefixed (.football) and non-prefixed (football) commands
      if (commandText.toLowerCase().startsWith(this.prefix + 'football')) {
        commandText = commandText.substring((this.prefix + 'football').length).trim();
      } else if (commandText.toLowerCase().startsWith('football')) {
        commandText = commandText.substring('football'.length).trim();
      }

      // If no subcommand, show help
      if (!commandText) {
        return this.showHelp();
      }

      // Split into command and arguments
      const [command, ...args] = commandText.split(' ');
      const query = args.join(' ').trim();

      // Execute the command if it exists
      if (this.commands[command.toLowerCase()]) {
        return await this.commands[command.toLowerCase()](query);
      } else {
        return this.sendMessage(`❌ Unknown command: ${command}. Use *${this.prefix}football help* for available commands.`);
      }
    } catch (error) {
      console.error('Error in football command:', error);
      return this.sendMessage('❌ An error occurred. Please try again later.');
    }
  }

  /**
   * Search for a football team
   * @param {string} query - Search query
   */
  async handleSearch(query) {
    if (!query) {
      return this.sendMessage(
        `Example: *${this.prefix}football search manchester united*`
      );
    }

    try {
      // Show typing indicator
      await this.sock.presenceSubscribe(this.from);
      await this.sock.sendPresenceUpdate('composing', this.from);

      const searchResults = await footballApp('search', query);
      
      if (!searchResults?.teams?.length) {
        await this.sock.sendMessage(this.from, { text: `❌ No teams found matching "${query}".` }, { quoted: this.msg });
        return;
      }

      // Get first 5 results
      const results = searchResults.teams.slice(0, 5);
      let message = '🔍 *Search Results* 🔍\n\n';
      
      results.forEach((team, index) => {
        // Safely get team name and country
        const teamName = team?.name || 'Unknown Team';
        const countryName = team?.country?.name ? ` (${team.country.name})` : '';
        
        message += `${index + 1}. *${teamName}*${countryName}\n`;
        message += '   ❌ Not following\n\n';
      });
      
      message += '\nReply with *follow [number]* to follow a team.';
      
      await this.sock.sendMessage(this.from, { text: message }, { quoted: this.msg });
      
    } catch (error) {
      console.error('Error in team search:', error);
      await this.sock.sendMessage(this.from, { text: '❌ Failed to search for teams. Please try again later.' }, { quoted: this.msg });
    } finally {
      // Stop typing indicator
      await this.sock.sendPresenceUpdate('paused', this.from);
    }
  }

  /**
   * Handle league standings command
   * @param {string} leagueName - Name of the league to show standings for
   */
  async handleLeagueStandings(leagueName = '') {
    const leagueKey = leagueName.toLowerCase().trim();
    
    if (!leagueName) {
      // If no league specified, show available leagues in a more organized way
      let message = '🏆 *Available Leagues* 🏆\n\n';
      message += 'Use: .football league [league_code]\n\n';
      
      // Group leagues by region/type
      message += '*🌍 Major Leagues*\n';
      message += '• epl - Premier League\n';
      message += '• laliga - La Liga\n';
      message += '• serie a - Serie A\n';
      message += '• bundesliga - Bundesliga\n';
      message += '• ligue 1 - Ligue 1\n\n';
      
      message += '*🏆 European Competitions*\n';
      message += '• champions league - UEFA Champions League\n';
      message += '• europa league - UEFA Europa League\n';
      message += '• conference league - UEFA Conference League\n\n';
      
      message += '*🌎 Other Leagues*\n';
      message += '• eredivisie - Eredivisie\n';
      message += '• primeira liga - Liga Portugal\n';
      message += '• süper lig - Süper Lig\n';
      message += '• mls - MLS\n';
      message += '• brasileirão - Brasileirão\n';
      message += '• super liga - Superliga Argentina\n\n';
      
      message += `Example: *${this.prefix}football league epl*`;
      
      return this.sock.sendMessage(this.from, { text: message }, { quoted: this.msg });
    }
    
    try {
      // Show typing indicator
      await this.sock.presenceSubscribe(this.from);
      await this.sock.sendPresenceUpdate('composing', this.from);

      // Use the standingByLeague endpoint with the league name
      const result = await footballApp('standingByLeague', leagueKey);
      
      //console.log('Standings response:', JSON.stringify(result, null, 2));
      
      if (result?.error) {
        console.log(`Error fetching ${leagueName} standings:`, result.error);
        
        // Show available leagues if the requested one isn't found
        if (result.error.code === 404) {
          const availableLeagues = Object.entries(this.leagues)
            .filter(([key]) => !key.includes(' '))
            .map(([key, name]) => `• ${key} (${name})`)
            .join('\n');
          
          return this.sock.sendMessage(this.from, { text: `❌ League not found. Available leagues:\n\n${availableLeagues}\n\n` +
            `Example: *${this.prefix}football league epl*` }, { quoted: this.msg });
        }
        
        return this.sock.sendMessage(this.from, { text: `❌ Could not fetch ${leagueName} standings. Please try again later.` }, { quoted: this.msg });
      }

      const leagueName = result.leagueName || this.leagues[leagueKey] || leagueKey;
      const standings = result.standings?.[0]?.rows;
      
      if (!standings?.length) {
        console.log(`No standings data for ${leagueName}:`, result);
        return this.sock.sendMessage(this.from, { text: `❌ No standings data available for ${leagueName}.` }, { quoted: this.msg });
      }

      let message = `🏆 *${leagueName} Standings* 🏆\n\n`;
      
      // Show all teams in the standings
      standings.forEach((team) => {
        const position = team.position.toString().padEnd(2);
        const points = team.points.toString().padStart(2);
        const played = team.matches.toString().padStart(2);
        const won = team.wins.toString().padStart(2);
        const drawn = team.draws.toString().padStart(2);
        const lost = team.losses.toString().padStart(2);
        const goalsFor = team.scoresFor.toString().padStart(2);
        const goalsAgainst = team.scoresAgainst.toString().padStart(2);
        const goalDiff = team.scoreDiffFormatted || '0';
        
        // Add promotion/relegation emoji if applicable
        let positionEmoji = '';
        if (team.promotion) {
          if (team.promotion.text.includes('Champions League')) positionEmoji = '🏆';
          else if (team.promotion.text.includes('Europa')) positionEmoji = '🏆';
          else if (team.promotion.text.includes('Relegation')) positionEmoji = '⚠️';
        }
        
        message += `${position}. ${team.team.name.padEnd(20)} ${points} pts ${positionEmoji}\n`;
        message += `   📊 P: ${played} | W: ${won} | D: ${drawn} | L: ${lost} | GF: ${goalsFor} | GA: ${goalsAgainst} | GD: ${goalDiff}\n\n`;
      });
      
      // Add league info and last updated time
      const lastUpdated = new Date(standings[0]?.updatedAtTimestamp * 1000 || Date.now());
      message += `\n*Last updated*: ${lastUpdated.toLocaleString()}`;
      //console.log(message);
      return this.sock.sendMessage(this.from, { text: message }, { quoted: this.msg });
      
    } catch (error) {
      console.error('Error fetching league standings:', error);
      console.log(error);
      return this.sock.sendMessage(this.from, { text: '❌ Failed to fetch league standings. Please try again later.' }, { quoted: this.msg });
    } finally {
      // Stop typing indicator
      await this.sock.sendPresenceUpdate('paused', this.from);
    }
  }

  /**
   * Handle featured matches with odds
   */
  async handleFeaturedMatches() {
    try {
      // Show typing indicator
      await this.sock.presenceSubscribe(this.from);
      await this.sock.sendPresenceUpdate('composing', this.from);

      // Get featured events with odds
      const result = await footballApp('featuredEvents');
      
      if (result?.error) {
        console.log('Error fetching featured matches:', result.error);
        return this.sock.sendMessage(this.from, { text: '❌ Could not fetch featured matches. Please try again later.' }, { quoted: this.msg });
      }

      const events = result?.events || [];
      
      if (events.length === 0) {
        return this.sock.sendMessage(this.from, { text: 'ℹ️ No featured matches at the moment. Check back later!' }, { quoted: this.msg });
      }

      let message = '⭐ *Featured Matches* ⭐\n\n';
      
      // Get top 5 featured matches
      events.slice(0, 5).forEach((event, index) => {
        const homeTeam = event.homeTeam?.name || 'TBD';
        const awayTeam = event.awayTeam?.name || 'TBD';
        const league = event.tournament?.name || 'Unknown League';
        
        // Get match time
        let matchTime = 'LIVE';
        if (event.status?.type === 'notstarted') {
          const matchDate = new Date(event.startTimestamp * 1000);
          matchTime = matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Get odds if available
        let oddsInfo = '';
        if (event.odds?.home && event.odds?.draw && event.odds?.away) {
          oddsInfo = `\n  1️⃣ ${event.odds.home.toFixed(2)} | X ${event.odds.draw.toFixed(2)} | 2 ${event.odds.away.toFixed(2)}`;
        }
        
        message += `*${index + 1}.* ${homeTeam} vs ${awayTeam}\n` +
                  `   🏆 ${league} • ⏰ ${matchTime}${oddsInfo}\n\n`;
      });
      
      message += `\nUse *${this.prefix}match [number]* to see more details about a match.`;
      
      return this.sock.sendMessage(this.from, { text: message }, { quoted: this.msg });
      
    } catch (error) {
      console.error('Error in handleFeaturedMatches:', error);
      return this.sock.sendMessage(this.from, { text: '❌ An error occurred while fetching featured matches.' }, { quoted: this.msg });
    } finally {
      // Stop typing indicator
      await this.sock.sendPresenceUpdate('paused', this.from);
    }
  }

  /**
   * Show help message
   */
  async showHelp() {
    const helpMessage = `⚽ *Football Bot Commands* ⚽

*${this.prefix}football search [team/player]* - Search for teams or players
*${this.prefix}football follow [number]* - Follow a team from search results
*${this.prefix}football myteams* - Show your followed teams
*${this.prefix}football league [league name]* - Show league standings
*${this.prefix}football featured* - Show featured matches with odds
*${this.prefix}football help* - Show this help message`;

    this.sock.sendMessage(this.from, { text: helpMessage }, { quoted: this.msg });
  }

  /**
   * Helper to send a message
   * @param {string} message - Message to send
   */
  async sendMessage(message) {
    try {
      // Show typing indicator
      await this.sock.presenceSubscribe(this.from);
      await this.sock.sendPresenceUpdate('composing', this.from);
      
      // Send the message using sendToChat
      await this.sock.sendMessage(this.from, { text: message }, { quoted: this.msg });
      
      // Stop typing indicator
      await this.sock.sendPresenceUpdate('paused', this.from);
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw error; // Re-throw to be handled by the command handler
    }
  }
}

/**
 * Handle football command
 */
module.exports = {
  handleFootballCommand: async (params) => {
    const { sock, msg, from, textMsg, prefix, userId } = params;
    const football = new FootballCommands(sock, msg, from, textMsg, prefix, userId);
    return football.process();
  }
};