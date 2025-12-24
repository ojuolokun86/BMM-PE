// src/handler/command/news.js

// Uses Google News RSS (no API key). Node 21+ has global fetch.
const COUNTRY_MAP = {
    // common names
    nigeria: 'NG', usa: 'US', us: 'US', uk: 'GB', britain: 'GB', england: 'GB',
    india: 'IN', canada: 'CA', germany: 'DE', france: 'FR', italy: 'IT', spain: 'ES',
    brazil: 'BR', mexico: 'MX', southafrica: 'ZA', sa: 'ZA', kenya: 'KE', ghana: 'GH',
    japan: 'JP', china: 'CN', russia: 'RU', australia: 'AU', nz: 'NZ',
    // allow 2-letter to pass through
  };
  
  function toISO2(inputRaw) {
    if (!inputRaw) return null;
    const input = String(inputRaw).trim().toLowerCase();
    if (input.length === 2) return input.toUpperCase();
    return COUNTRY_MAP[input] || null;
  }
  
  function buildFeedUrl(iso2) {
    if (!iso2) {
      // World/Default feed (US English)
      return 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
    }
    const cc = iso2.toUpperCase();
    return `https://news.google.com/rss?hl=en-${cc}&gl=${cc}&ceid=${cc}:en`;
  }
  
  // Super-lightweight XML extraction for RSS items
  function extractItems(rssText, max = 3) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(rssText)) && items.length < max) {
      const block = match[1];

      const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
      const linkMatch = block.match(/<link>(.*?)<\/link>/);
      const pubMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);
      const descMatch = block.match(/<description>([\s\S]*?)<\/description>/);

      const title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : '';
      const link = linkMatch ? linkMatch[1].trim() : '';
      const pub = pubMatch ? pubMatch[1].trim() : '';
      const descRaw = descMatch ? descMatch[1] : '';

      if (title && link) items.push({ title, link, pub, description: descRaw });
    }
    return items;
  }

  function stripHtml(html) {
    try {
      // remove CDATA if any
      const noCdata = html.replace(/^<!\[CDATA\[|\]\]>$/g, '');
      // replace HTML entities minimally
      const decoded = noCdata
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      // strip tags
      return decoded.replace(/<[^>]*>/g, '').trim();
    } catch {
      return html;
    }
  }

  function truncate(text, maxLen = 160) {
    const t = String(text || '').trim();
    if (t.length <= maxLen) return t;
    return t.slice(0, maxLen - 1) + '…';
  }

  async function shortenUrl(url) {
    try {
      const api = 'http://tinyurl.com/api-create.php?url=' + encodeURIComponent(url);
      const res = await fetch(api);
      if (res.ok) {
        const short = await res.text();
        if (short && /^https?:\/\//i.test(short)) return short.trim();
      }
    } catch {}
    return url; // fallback
  }

  module.exports = async function newsCommand(sock, from, msg, { prefix, args }) {
    try {
      // args: [] -> world; [country] -> country feed
      const countryArg = args?.[0];
      const iso2 = toISO2(countryArg);
      const url = buildFeedUrl(iso2);

      await sock.sendMessage(from, { text: '📰 Fetching latest headlines...' }, { quoted: msg });

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Feed request failed (${res.status})`);
      const text = await res.text();

      const items = extractItems(text, 3);
      if (!items.length) {
        return await sock.sendMessage(from, {
          text: `❌ No headlines found${iso2 ? ` for ${iso2}` : ''}. Try again later.`
        }, { quoted: msg });
      }

      const header = iso2 ? `🌍 Top headlines for ${iso2}` : '🌍 Top world headlines';

      const lines = await Promise.all(items.map(async (it, i) => {
        const summary = truncate(stripHtml(it.description || ''));
        const shortLink = await shortenUrl(it.link);
        return `${i + 1}. ${it.title}\n   ${summary ? '📰 ' + summary + '\n   ' : ''}🔗 ${shortLink}`;
      }));

      const body = lines.join('\n\n');

      await sock.sendMessage(from, { text: `${header}\n\n${body}` }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(from, {
        text: `❌ Error fetching news: ${e.message || 'unknown error'}`
      }, { quoted: msg });
    }
  };