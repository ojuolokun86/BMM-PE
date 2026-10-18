// src/handler/command/news.js

// Uses Google News RSS (no API key). Node 21+ has global fetch.
const axios = require('axios');
const { generateImageBuffer } = require('./imagine');

const EFHUB_SITEMAP_URL = 'https://efhub.com/sitemap.xml';
const EFHUB_MAX_ARTICLE_AGE_DAYS = 45;
const EFHUB_MAX_CANDIDATES = 8;
const EFHUB_ARTICLE_LIMIT = 3;
const EFHUB_CRAWL_DELAY_MS = 5000;

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
  
  function buildFeedUrl(iso2, topic) {
    if (topic) {
      const country = iso2 || 'US';
      return `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-${country}&gl=${country}&ceid=${country}:en`;
    }
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

      if (title && link) items.push({ title, link, pub, description: descRaw, block });
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

  function decodeXml(text) {
    return String(text || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;|&#x27;/gi, "'")
      .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
      .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)));
  }

  function extractImageUrl(block, description) {
    const imageMatch = block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*\burl=["']([^"']+)["']/i)
      || description.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
    const imageUrl = imageMatch ? decodeXml(imageMatch[1].trim()) : null;
    return imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : null;
  }

  function extractPageImageUrl(html) {
    const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
    for (const tag of metaTags) {
      const property = tag.match(/\b(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["']/i);
      if (!property) continue;

      const content = tag.match(/\bcontent=["']([^"']+)["']/i);
      if (!content) continue;

      const imageUrl = decodeXml(content[1].trim());
      if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
    }
    return null;
  }

  function extractPageMetaContent(html, names) {
    const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
    for (const name of names) {
      for (const tag of metaTags) {
        const property = tag.match(/\b(?:property|name)=["']([^"']+)["']/i);
        if (!property || property[1].toLowerCase() !== name) continue;

        const content = tag.match(/\bcontent=["']([^"']+)["']/i);
        if (content) return decodeXml(content[1].trim());
      }
    }
    return null;
  }

  function isEfootballTopic(topic) {
    return /\b(?:e[\s-]?football|pes\s?20\d{2})\b/i.test(String(topic || ''));
  }

  function isEfootballNewsTitle(title) {
    const normalized = String(title || '').replace(/[-_]/g, ' ');
    const excluded = /\b(?:guide|how to|rating|rankings?|analysis|builds?|review|skill|tier list|top \d+|why does|which .* best|how strong)\b/i;
    const newsTerms = /\b(?:potw|featured|new season|season reward|new pack|event|campaign|update|maintenance|server|released|arrived|efootball 20\d{2})\b/i;
    return newsTerms.test(normalized) && !excluded.test(normalized);
  }

  function getEfootballArticleDate(url) {
    const slug = new URL(url).pathname.split('/').pop() || '';
    const match = slug.match(/^(\d{2})(\d{2})(\d{2})_/);
    if (!match) return null;

    const [, year, month, day] = match;
    const date = new Date(2000 + Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() !== 2000 + Number(year)
      || date.getMonth() !== Number(month) - 1
      || date.getDate() !== Number(day)) return null;
    return date;
  }

  async function fetchEfootballCommunityArticles() {
    const sitemapResponse = await axios.get(EFHUB_SITEMAP_URL, {
      timeout: 15000,
      maxContentLength: 5 * 1024 * 1024
    });
    const sitemap = String(sitemapResponse.data || '');
    const now = Date.now();
    const maxAge = EFHUB_MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000;
    const candidates = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)]
      .map(([, location]) => decodeXml(location.trim()))
      .filter(location => {
        try {
          const url = new URL(location);
          const publishedAt = getEfootballArticleDate(url.href);
          const age = publishedAt ? now - publishedAt.getTime() : Infinity;
          const slug = decodeURIComponent(url.pathname.split('/').pop() || '');
          return (url.hostname === 'efhub.com' || url.hostname === 'www.efhub.com')
            && url.pathname.startsWith('/articles/')
            && age >= -24 * 60 * 60 * 1000
            && age <= maxAge
            && isEfootballNewsTitle(slug);
        } catch {
          return false;
        }
      })
      .slice(0, EFHUB_MAX_CANDIDATES);

    const articles = [];
    let lastRequestAt = Date.now();
    for (const link of candidates) {
      const wait = EFHUB_CRAWL_DELAY_MS - (Date.now() - lastRequestAt);
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      lastRequestAt = Date.now();

      try {
        const response = await axios.get(link, {
          timeout: 15000,
          maxContentLength: 2 * 1024 * 1024,
          headers: { Accept: 'text/html' }
        });
        if (typeof response.data !== 'string') continue;

        const titleMatch = response.data.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = decodeXml(titleMatch?.[1] || '')
          .replace(/\s*[—|]\s*eFHUB(?:\s*[|]\s*eFHUB)?\s*$/i, '')
          .trim();
        const imageUrl = extractPageImageUrl(response.data);
        const summary = extractPageMetaContent(response.data, ['og:description', 'description']);
        if (!title || !imageUrl) continue;

        articles.push({
          title,
          link,
          pub: getEfootballArticleDate(link)?.toUTCString() || '',
          summary: truncate(stripHtml(summary || ''), 160),
          imageUrl
        });
        if (articles.length === EFHUB_ARTICLE_LIMIT) break;
      } catch (error) {
        console.warn(`[news] Could not load eFHUB article ${link}: ${error.message}`);
      }
    }

    if (!articles.length) {
      throw new Error('No recent eFootball community news with publisher images was found on eFHUB.');
    }
    return articles;
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

  async function fetchNewsArticles({ topic, iso2 } = {}) {
    if (isEfootballTopic(topic)) return fetchEfootballCommunityArticles();

    const res = await fetch(buildFeedUrl(iso2, topic));
    if (!res.ok) throw new Error(`Feed request failed (${res.status})`);

    const items = extractItems(await res.text(), 3);
    if (!items.length) {
      throw new Error(`No headlines found${topic ? ` for "${topic}"` : iso2 ? ` for ${iso2}` : ''}.`);
    }

    return items.map(item => ({
      ...item,
      title: decodeXml(item.title),
      link: decodeXml(item.link),
      summary: truncate(stripHtml(item.description || '')),
      imageUrl: extractImageUrl(item.block, item.description || '')
    }));
  }

  async function getArticleImage(article) {
    const imageUrls = [];
    if (article.imageUrl) imageUrls.push(article.imageUrl);

    if (!article.imageUrl) {
      try {
        const response = await axios.get(article.link, {
          timeout: 15000,
          maxContentLength: 2 * 1024 * 1024,
          headers: { Accept: 'text/html' }
        });
        const articleHost = new URL(article.link).hostname.toLowerCase();
        if (typeof response.data === 'string' && !articleHost.endsWith('google.com')) {
          const pageImageUrl = extractPageImageUrl(response.data);
          if (pageImageUrl && !imageUrls.includes(pageImageUrl)) imageUrls.push(pageImageUrl);
        }
      } catch (error) {
        console.warn(`[news] Could not inspect article page for "${article.title}": ${error.message}`);
      }
    }

    for (const imageUrl of imageUrls) {
      try {
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
          maxContentLength: 10 * 1024 * 1024
        });
        const contentType = response.headers?.['content-type'] || '';
        if (!contentType.toLowerCase().startsWith('image/')) {
          throw new Error(`Article image URL returned ${contentType || 'an unknown content type'}`);
        }
        return Buffer.from(response.data);
      } catch (error) {
        console.warn(`[news] Could not download article image for "${article.title}": ${error.message}`);
      }
    }

    return generateImageBuffer(
      `Create an original editorial illustration for a news story titled "${article.title}". ` +
      'Use a clear, polished visual style appropriate to the story, no words, no logos, and do not depict real people.'
    );
  }

  async function postNews(sock, chatJid, options = {}, quoted) {
    const articles = await fetchNewsArticles(options);
    for (const article of articles) {
      const sourceUrl = await shortenUrl(article.link);
      const caption = `${article.title}\n\n${article.summary ? `📰 ${article.summary}\n\n` : ''}🔗 ${sourceUrl}`;
      const messageOptions = quoted ? { quoted } : undefined;
      try {
        const image = await getArticleImage(article);
        await sock.sendMessage(chatJid, { image, caption }, messageOptions);
      } catch (error) {
        console.error(`[news] Could not create or send an image for "${article.title}": ${error.message}`);
        await sock.sendMessage(chatJid, {
          text: `${caption}\n\n⚠️ Could not attach an image to this story.`
        }, messageOptions);
      }
    }
  }

  module.exports = async function newsCommand(sock, from, msg, { prefix, args }) {
    try {
      const country = args?.length === 1 ? toISO2(args[0]) : null;
      const topic = country ? null : args?.join(' ').trim() || null;

      await sock.sendMessage(from, { text: '📰 Fetching latest headlines...' }, { quoted: msg });
      await postNews(sock, from, { topic, iso2: country }, msg);
    } catch (e) {
      await sock.sendMessage(from, {
        text: `❌ Error fetching news: ${e.message || 'unknown error'}`
      }, { quoted: msg });
    }
  };

  module.exports.fetchNewsArticles = fetchNewsArticles;
  module.exports.fetchEfootballCommunityArticles = fetchEfootballCommunityArticles;
  module.exports.isEfootballTopic = isEfootballTopic;
  module.exports.isEfootballNewsTitle = isEfootballNewsTitle;
  module.exports.postNews = postNews;
  module.exports.toISO2 = toISO2;