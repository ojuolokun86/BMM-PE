const axios = require("axios");
const https = require("https");
const { exec } = require("child_process");

const client = axios.create({
  httpsAgent: new https.Agent({ keepAlive: true })
});

/**
 * Fallback to system curl when Sofascore blocks axios
 */
async function curlRequest(url) {
  return new Promise((resolve, reject) => {
    exec(`curl -sL "${url}" -H "User-Agent: Mozilla/5.0" -H "Accept: application/json"`, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Universal Football App
 * @param {string} type - ("live", "event", "team", "player", "news", "fixtures", "results", "search")
 * @param {string|number} id - ID for team, player, or event (if required)
 */
exports.footballApp = async function footballApp(type, id = null, params = {}) {
  console.log(`[footballApp] Request - Type: ${type}, ID: ${id}, Params:`, params);
  let url = "";

  switch (type) {
    case "live":
      url = "https://api.sofascore.com/api/v1/sport/football/events/live";
      break;

    case "search":
      if (!id) throw new Error("Team or player name required for search");
      url = `https://api.sofascore.com/api/v1/search/all?q=${encodeURIComponent(id)}`;
      break;

    case "event":
      if (!id) throw new Error("Event ID required");
      url = `https://api.sofascore.com/api/v1/event/${id}`;
      break;

    case "team":
      if (!id) throw new Error("Team ID required");
      url = `https://api.sofascore.com/api/v1/team/${id}`;
      break;

    case "fixtures":
      if (!id) throw new Error("Team ID required for fixtures");
      url = `https://api.sofascore.com/api/v1/team/${id}/events/next/0`;
      break;

    case "results":
      if (!id) throw new Error("Team ID required for results");
      url = `https://api.sofascore.com/api/v1/team/${id}/events/last/0`;
      break;

    case "player":
      if (!id) throw new Error("Player ID required");
      url = `https://api.sofascore.com/api/v1/player/${id}`;
      break;

    case "news":
      url = "https://api.sofascore.com/api/v1/news/football";
      break;

    case "standings":
      if (!id) throw new Error("Team ID required for standings");
      url = `https://api.sofascore.com/api/v1/team/${id}/standings`;
      break;
    
    // Add these new cases to your switch statement in footballApp.js
    case "standingByLeague":
      if (!id) throw new Error("League name required for standings by league");
      
      try {
        // Map of common league names to their SofaScore tournament slugs and IDs
        const leagues = {
          'premier league': { id: 17, slug: 'premier-league', name: 'Premier League' },
          'epl': { id: 17, slug: 'premier-league', name: 'Premier League' },
          'la liga': { id: 8, slug: 'spain/laliga', name: 'La Liga' },
          'laliga': { id: 8, slug: 'spain/laliga', name: 'La Liga' },
          'serie a': { id: 23, slug: 'italy/serie-a', name: 'Serie A' },
          'bundesliga': { id: 35, slug: 'germany/bundesliga', name: 'Bundesliga' },
          'ligue 1': { id: 34, slug: 'france/ligue-1', name: 'Ligue 1' },
          'champions league': { id: 7, slug: 'champions-league', name: 'Champions League' },
          'europa league': { id: 679, slug: 'europa-league', name: 'Europa League' },
          'conference league': { id: 1700, slug: 'europa-conference-league', name: 'Conference League' },
          'eredivisie': { id: 37, slug: 'netherlands/eredivisie', name: 'Eredivisie' },
          'primeira liga': { id: 38, slug: 'portugal/liga-portugal', name: 'Primeira Liga' },
          'mls': { id: 39, slug: 'usa/mls', name: 'MLS' },
          'brasileirão': { id: 325, slug: 'brazil/brasileirao', name: 'Brasileirão' },
          'super lig': { id: 52, slug: 'turkey/super-lig', name: 'Süper Lig' },
          'premier liga': { id: 203, slug: 'russia/premier-liga', name: 'Premier Liga' }
        };

        // Get the league info from the mapping
        const league = leagues[id.toLowerCase()];
        
        if (!league) {
          return { error: { code: 404, message: 'League not found in our database' }};
        }
        
        // First, get the current season ID for the league
        const seasonResponse = await curlRequest(`https://api.sofascore.com/api/v1/unique-tournament/${league.id}/seasons`);
        if (seasonResponse.error || !seasonResponse.seasons || seasonResponse.seasons.length === 0) {
          return { error: { code: 404, message: 'Could not find season information for this league' }};
        }
        
        // Get the current season (usually the first one in the list)
        const currentSeason = seasonResponse.seasons[0].id;
        
        // Get the standings for the current season
        const standingsUrl = `https://api.sofascore.com/api/v1/unique-tournament/${league.id}/season/${currentSeason}/standings/total`;
        const response = await curlRequest(standingsUrl);
        
        if (response.error || !response.standings) {
          return { error: { code: 404, message: 'Could not fetch league standings' }};
        }
        
        // Add league name to the response for better display
        response.leagueName = league.name;
        return response;

      } catch (error) {
        console.error('Error in standingByLeague:', error);
        return { error: { code: 500, message: 'Error fetching league data' } };
      }
      break;
      
    case "teamMatches":
      if (!id) throw new Error("Team ID required for team matches");
      url = `https://api.sofascore.com/api/v1/team/${id}/events`;
      if (params?.date) {
        const dateStr = new Date(params.date).toISOString().split('T')[0];
        url += `/date/${dateStr}`;
      } else if (params?.next) {
        url += `/next/0`;
      } else if (params?.last) {
        url += `/last/0`;
      }
      break;
      
    case "matchDetails":
      if (!id) throw new Error("Match ID required");
      url = `https://api.sofascore.com/api/v1/event/${id}`;
      break;
      
    case "leagues":
      url = "https://api.sofascore.com/api/v1/config/top-unique-tournaments/MA/football";
      break;
      
    case "liveMatches":
      url = "https://api.sofascore.com/api/v1/sport/football/events/live";
      break;
      
    case "featuredEvents":
      url = "https://api.sofascore.com/api/v1/odds/1/featured-events/football";
      break;
      
    case "matchesByDate":
      if (!params?.date) throw new Error("Date parameter (YYYY-MM-DD) is required");
      url = `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${params.date}`;
      break;

    default:
      throw new Error("Invalid request type");
  }

  try {
    // --- First try Axios ---
    let res;
    try {
      res = await client.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Referer": "https://www.sofascore.com/",
          "Origin": "https://www.sofascore.com"
        }
      });
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.warn("⚠️ Sofascore blocked Axios. Retrying with curl...");
        res = { data: await curlRequest(url) };
      } else {
        throw err;
      }
    }

    let data = res.data;

    // --- Normalize search results ---
    if (type === "search") {
      const results = data.results || [];
      const teams = results
        .filter(r => r.type === "team")
        .map(r => ({
          id: r.entity.id,
          name: r.entity.name,
          country: r.entity.country?.name || null,
          slug: r.entity.slug,
          gender: r.entity.gender,
          teamColors: r.entity.teamColors
        }));

      const players = results
        .filter(r => r.type === "player")
        .map(r => ({
          id: r.entity.id,
          name: r.entity.name,
          shortName: r.entity.shortName,
          country: r.entity.country?.name || null,
          team: r.entity.team?.name || null,
          position: r.entity.position
        }));

      data = { teams, players };
    }

    // --- Log summary ---
    console.log(
      `[footballApp] ✅ Response - Type: ${type}, ID: ${id}`,
      type === "team" ? `Team: ${data.team?.name || "N/A"}` :
      type === "fixtures" ? `Fixtures: ${data.events?.length || 0} found` :
      type === "results" ? `Results: ${data.events?.length || 0} found` :
      type === "news" ? `News: ${data.length || 0} articles` :
      type === "search" ? `Found: ${(data?.teams?.length || 0)} teams, ${(data?.players?.length || 0)} players` :
      "Response received"
    );

    return data;
  } catch (err) {
    console.error("❌ Error fetching data:");
    console.error("URL:", url);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Headers:", err.response.headers);
      console.error("Data:", err.response.data);
    } else if (err.request) {
      console.error("No response received:", err.request);
    } else {
      console.error("Setup error:", err.message);
    }
    return { error: err.message, status: err.response?.status || null };
  }
};
