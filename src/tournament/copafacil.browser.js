const { chromium } = require('playwright');
const {} = require('puppet')
const fs = require('fs');

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * =========================
 * LOAD PAGE (FULL DEBUG MODE)
 * =========================
 */
async function loadPage(url) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const apiCalls = [];

  console.log('\n[SCRAPER V3] Starting:', url);

  // =========================
  // 1. CAPTURE ALL REQUESTS
  // =========================
  page.on('request', (request) => {
  const url = request.url();

  if (
    request.resourceType() === 'xhr' ||
    request.resourceType() === 'fetch'
  ) {
    console.log('[XHR]', url);
  }
});

  // =========================
  // 2. CAPTURE ALL RESPONSES
  // =========================
 page.on('response', async (response) => {
  const url = response.url();

  if (
    response.request().resourceType() === 'xhr' ||
    response.request().resourceType() === 'fetch'
  ) {
    console.log('\n[API RESPONSE]', url);
    try {
      const text = await response.text();
      console.log(text.slice(0, 1000));
    } catch (e) {}
  }
});

  // =========================
  // 3. BROWSER CONSOLE LOGS
  // =========================
  page.on('console', (msg) => {
    console.log('[BROWSER]', msg.type(), msg.text());
  });

  // =========================
  // 4. OPEN PAGE (IMPORTANT)
  // =========================
  await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 90000
  });

  // wait for JS API calls (VERY IMPORTANT)
  await page.waitForTimeout(10000);

  // =========================
  // 5. SAVE FINAL HTML AFTER LOAD
  // =========================
  const html = await page.content();

  fs.writeFileSync('copafacil.html', html);

  console.log('\n[HTML SAVED] Length:', html.length);

  return { browser, page, apiCalls };
}

/**
 * =========================
 * EXTRACT EVENTS (IMPROVED)
 * =========================
 */
function getCategoryEventsFromCalls(apiCalls) {
  const found = [];

  for (const call of apiCalls) {
    const data = call.data;

    if (!data || typeof data !== 'object') continue;

    // EVENT TITLE
    if (data.info?.title) {
      found.push({
        id: data.url_c || data.id || null,
        title: data.info.title
      });
    }

    const evt = data.m_evt;
    if (!evt) continue;

    const parse = (item) => {
      if (!item) return null;

      return {
        id:
          item.id ||
          item.slug ||
          item.competition_id ||
          item.stage_id ||
          item.url?.split('/').pop() ||
          null,
        title:
          item.title ||
          item.name ||
          item.group_name ||
          null
      };
    };

    // ARRAY FORMAT
    if (Array.isArray(evt)) {
      evt.forEach(e => {
        const r = parse(e);
        if (r?.title) found.push(r);
      });
    }

    // OBJECT FORMAT
    else {
      if (evt.groups) {
        evt.groups.forEach(g => {
          const r = parse(g);
          if (r?.title) found.push(r);
        });
      }

      if (evt.tournaments) {
        evt.tournaments.forEach(t => {
          const r = parse(t);
          if (r?.title) found.push(r);
        });
      }
    }
  }

  // remove duplicates
  const unique = [...new Map(found.map(x => [x.title, x])).values()];

  return unique;
}

/**
 * =========================
 * MAIN ENTRY
 * =========================
 */
async function getCategoryEvents(url) {
  const { browser, apiCalls } = await loadPage(url);

  await browser.close();

  console.log('\n[DEBUG] TOTAL API CALLS:', apiCalls.length);

  // PRINT ALL URLs (VERY IMPORTANT)
  apiCalls.forEach(c => {
    console.log('[API]', c.url);
  });

  const events = getCategoryEventsFromCalls(apiCalls);

  console.log('\n[FINAL EVENTS V3]', events);

  return events.length
    ? events
    : [{ id: null, title: 'NO EVENTS FOUND' }];
}

/**
 * =========================
 * TABLE FETCHER (UNCHANGED BUT SAFE)
 * =========================
 */
async function getCompetitionTable(eventId) {
  console.log('\n[TABLE V3 START]', eventId);

  if (!eventId) {
    return { success: false, data: [] };
  }

  const urls = [
    `https://copafacil.com/request/classificacao?id=${eventId}`,
    `https://copafacil.com/request/ranking?id=${eventId}`
  ];

  for (const url of urls) {
    try {
      console.log('[TABLE TRY]', url);

      const res = await fetch(url);
      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.log('[TABLE ERROR] Not JSON:', text.slice(0, 200));
        continue;
      }

      const table =
        data?.classificacao ||
        data?.ranking ||
        data?.teams ||
        data?.groups ||
        [];

      if (Array.isArray(table) && table.length > 0) {
        return {
          success: true,
          source: url,
          data: table
        };
      }

    } catch (err) {
      console.log('[TABLE ERROR]', err.message);
    }
  }

  return { success: false, data: [] };
}

module.exports = {
  loadPage,
  getCategoryEvents,
  getCompetitionTable
};