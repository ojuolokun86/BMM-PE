const BASE_URL = 'https://copafacil.com/api2';
const API_KEY = '519K-ICQ5-HSHT';

async function fetchCopaFacil(endpoint, options = {}) {
  const response = await fetch(`https://copafacil.com/api2${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      'x-api-key': API_KEY,
      'lang': options.headers?.lang || 'en',
      'Content-Type': 'application/json',
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.log('API FULL ERROR:', data); // 🔥 IMPORTANT DEBUG
    throw new Error(
      data?.message || `API Error: ${response.status} ${response.statusText}`
    );
  }

  return data;
}
// 1) List Tournament Stages
async function getTournamentStages(idTournament) {
  return fetchCopaFacil(`/tournament/${idTournament}/stages`);
}

// 2) Stage Standings Table
async function getStageTable(idTournament, stageId, lang = 'en') {
  return fetchCopaFacil(`/tournament/${idTournament}/stages/${stageId}/table`, {
    headers: { lang }
  });
}

// 3) List Stage Rounds
async function getStageRounds(idTournament, stageId) {
  return fetchCopaFacil(`/tournament/${idTournament}/stages/${stageId}/rounds`);
}

// 4) List Matches of a Round
async function getRoundMatches(idTournament, stageId, roundId, lang = 'en', gmt = null) {
  const headers = { lang };
  if (gmt !== null) headers.gmt = gmt.toString();
  return fetchCopaFacil(`/tournament/${idTournament}/stages/${stageId}/rounds/${roundId}/matchs`, {
    headers
  });
}

// 5) List Available Ranking Types
async function getRankingTypes(idTournament, lang = 'en') {
  return fetchCopaFacil(`/tournament/${idTournament}/rankings`, {
    headers: { lang }
  });
}

// 6) List Players of a Ranking
async function getRankingPlayers(idTournament, rankingId, lang = 'en', gmt = null) {
  const headers = { lang };
  if (gmt !== null) headers.gmt = gmt.toString();
  return fetchCopaFacil(`/tournament/${idTournament}/rankings/${rankingId}`, {
    headers
  });
}

// 7) Tournament Gallery
async function getTournamentGallery(idTournament, lang = 'en', gmt = null, max = 20) {
  const headers = { lang };
  if (gmt !== null) headers.gmt = gmt.toString();
  const queryParams = new URLSearchParams({ max: max.toString() });
  return fetchCopaFacil(`/tournament/${idTournament}/gallery?${queryParams}`, {
    headers
  });
}

// 8) Available Keys for Player Report
async function getPlayerKeys(idTournament, lang = 'en') {
  return fetchCopaFacil(`/tournament/${idTournament}/players/keys`, {
    headers: { lang }
  });
}

// 9) Player Report
async function getPlayerReport(idTournament, teamIds, keys = [], lang = 'en', gmt = null, staff = false, stage = null) {
  const headers = { lang };
  if (gmt !== null) headers.gmt = gmt.toString();
  
  const queryParams = new URLSearchParams();
  teamIds.forEach(teamId => queryParams.append('team', teamId));
  keys.forEach(key => queryParams.append('key', key));
  if (staff) queryParams.append('staff', 'true');
  if (stage) queryParams.append('stage', stage);
  
  return fetchCopaFacil(`/tournament/${idTournament}/players?${queryParams}`, {
    headers
  });
}

// 10) Available Keys for Team Report
async function getTeamKeys(idTournament, lang = 'en') {
  return fetchCopaFacil(`/tournament/${idTournament}/teams/keys`, {
    headers: { lang }
  });
}

// 11) List Tournament Teams
async function getTournamentTeams(idTournament, lang = 'en', gmt = null, stage = null) {
  const headers = { lang };
  if (gmt !== null) headers.gmt = gmt.toString();
  
  const queryParams = new URLSearchParams();
  if (stage) queryParams.append('stage', stage);
  
  return fetchCopaFacil(`/tournament/${idTournament}/teams?${queryParams}`, {
    headers
  });
}




module.exports = {
  getTournamentStages,
  getStageTable,
  getStageRounds,
  getRoundMatches,
  getRankingTypes,
  getRankingPlayers,
  getTournamentGallery,
  getPlayerKeys,
  getPlayerReport,
  getTeamKeys,
  getTournamentTeams
};
