import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
};

const CACHE_MS = 15 * 60 * 1000;
let cache = { at: 0, data: null };

function parseCrToInr(crStr) {
  if (!crStr) return null;
  const n = parseFloat(String(crStr).replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  return Math.round(n * 10000000);
}

/** Full rupee amounts from strings like ₹28,07,00,000 */
function parseRupeeString(revStr) {
  if (!revStr) return null;
  const digits = String(revStr).replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? null : n;
}

function slugToTitle(slug) {
  return slug
    .replace(/_\d{4}_Box_Office.*/i, '')
    .replace(/_Box_Office.*/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function yearFromSlug(slug) {
  const m = slug.match(/_(\d{4})_/);
  return m ? Number(m[1]) : new Date().getFullYear();
}

function loadStaticFallback() {
  try {
    const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/boxoffice_fallback.json'), 'utf8'));
    const india = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/boxoffice_india.json'), 'utf8'));
    const fromIndia = [];
    for (const block of india) {
      for (const m of block.movies || []) {
        const revStr = m.revenue || '';
        const inr = parseRupeeString(revStr);
        fromIndia.push({
          title: m.title,
          year: block.year,
          language: block.language,
          revenue_inr: inr,
          revenue_usd: inr ? Math.round(inr / 83) : null,
          source: 'static',
        });
      }
    }
    const fromFb = fb.map(m => ({
      title: m.title,
      year: m.year,
      language: m.language,
      revenue_inr: m.revenue_inr,
      revenue_usd: m.revenue_usd,
      source: 'static',
    }));
    return [...fromFb, ...fromIndia];
  } catch {
    return [];
  }
}

async function fetchSacnilkTrending() {
  const url = 'https://www.sacnilk.com/news/Box_Office_India_Daily_Collection';
  const res = await axios.get(url, { headers: UA, timeout: 20000 });
  const html = res.data;

  const slugs = new Set();
  for (const m of html.matchAll(/href="(\/news\/[^"]+Box_Office[^"]+)"/gi)) {
    slugs.add(m[1]);
  }
  for (const m of html.matchAll(/href="(\/quicknews\/[^"]+Box_Office[^"]+)"/gi)) {
    slugs.add(m[1]);
  }

  const list = [...slugs].slice(0, 12);
  const movies = [];

  await Promise.all(
    list.map(async (slugPath) => {
      try {
        const full = `https://www.sacnilk.com${slugPath}`;
        const r = await axios.get(full, { headers: UA, timeout: 15000 });
        const page = r.data;
        const slug = slugPath.split('/').pop();
        let title = slugToTitle(slug);
        const h1 = page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (h1) {
          title = h1[1]
            .replace(/Box Office Collection[\s\S]*/i, '')
            .replace(/\s+/g, ' ')
            .trim() || title;
        }
        const indiaNet = page.match(/India Net Collection[^₹$]*₹\s*([\d,.]+)\s*Cr/i);
        const indiaGross = page.match(/India Gross Collection[^₹$]*₹\s*([\d,.]+)\s*Cr/i);
        const worldwide = page.match(/Worldwide Collection[^₹$]*₹\s*([\d,.]+)\s*Cr/i);
        const inr =
          parseCrToInr(indiaNet?.[1]) ||
          parseCrToInr(indiaGross?.[1]) ||
          parseCrToInr(worldwide?.[1]);
        if (!title) return;
        const daywise = parseDaywiseFromSacnilkHtml(page, {
          title,
          year: yearFromSlug(slug),
          language: inferLanguage(title, page),
        });
        movies.push({
          title,
          year: yearFromSlug(slug),
          language: inferLanguage(title, page),
          revenue_inr: inr,
          revenue_usd: inr ? Math.round(inr / 83) : null,
          source: 'sacnilk',
          sourceUrl: full,
          daywiseData: daywise,
        });
      } catch {
        /* skip failed page */
      }
    })
  );

  return movies;
}

function inferLanguage(title, html) {
  const t = title.toLowerCase();
  const h = html.toLowerCase();
  if (h.includes('tollywood') || t.includes('(telugu)')) return 'te';
  if (h.includes('kollywood') || t.includes('(tamil)')) return 'ta';
  if (h.includes('mollywood') || t.includes('(malayalam)')) return 'ml';
  if (h.includes('sandalwood') || t.includes('(kannada)')) return 'kn';
  if (h.includes('bollywood') || t.includes('(hindi)')) return 'hi';
  if (t.includes('english')) return 'en';
  return 'hi';
}

async function fetchBollywoodHungamaSnapshot() {
  const url = 'https://www.bollywoodhungama.com/box-office/';
  const res = await axios.get(url, { headers: UA, timeout: 20000 });
  const html = res.data;
  const movies = [];

  const blocks = [...html.matchAll(/>([^<]{4,80})<\/a>\s*[\s\S]{0,120}?([\d,]+\.?\d*)\s*cr/gi)];
  const seen = new Set();
  for (const m of blocks) {
    const title = m[1].trim();
    if (/box office|favorites|crore club|collection 20/i.test(title)) continue;
    if (seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const inr = parseCrToInr(m[2]);
    if (!inr) continue;
    movies.push({
      title,
      year: new Date().getFullYear(),
      language: 'hi',
      revenue_inr: inr,
      revenue_usd: Math.round(inr / 83),
      source: 'bollywoodhungama',
      sourceUrl: url,
    });
    if (movies.length >= 15) break;
  }
  return movies;
}

function dedupeMerge(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = `${e.title.toLowerCase()}|${e.year}|${e.language || 'hi'}`;
    const prev = map.get(key);
    if (!prev || (e.revenue_inr || 0) > (prev.revenue_inr || 0)) {
      map.set(key, { ...prev, ...e, sources: [...new Set([...(prev?.sources || []), e.source])] });
    } else if (prev) {
      prev.sources = [...new Set([...(prev.sources || [prev.source]), e.source])];
      map.set(key, prev);
    }
  }
  return [...map.values()].map(({ source, ...rest }) => ({
    ...rest,
    source: (rest.sources || [source]).join(', '),
  }));
}

function parseDaywiseFromSacnilkHtml(html, meta = {}) {
  const dayMap = new Map();
  for (const m of html.matchAll(/Day\s*(\d{1,2})[^\₹]*₹\s*([\d,.]+)\s*Cr/gi)) {
    const day = parseInt(m[1], 10);
    if (day < 1 || day > 60) continue;
    const inr = parseCrToInr(m[2]);
    if (!inr) continue;
    if (!dayMap.has(day) || inr > dayMap.get(day).revenue_inr) {
      dayMap.set(day, { day, revenue_inr: inr, revenue_usd: Math.round(inr / 83) });
    }
  }
  const daywise_data = [...dayMap.values()].sort((a, b) => a.day - b.day);
  if (daywise_data.length < 2) return null;
  const total_inr = daywise_data.reduce((s, d) => s + d.revenue_inr, 0);
  return {
    title: meta.title || 'Unknown',
    year: meta.year || new Date().getFullYear(),
    language: meta.language || 'hi',
    daywise_data,
    total_revenue_inr: total_inr,
    total_revenue_usd: Math.round(total_inr / 83),
  };
}

function loadStaticDaywise() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../src/boxoffice_daywise.json'), 'utf8'));
  } catch {
    return [];
  }
}

let daywiseCache = { at: 0, data: null };

export async function getIndianDaywiseCatalog() {
  if (daywiseCache.data && Date.now() - daywiseCache.at < CACHE_MS) {
    return { ...daywiseCache.data, cached: true };
  }

  const catalog = [...loadStaticDaywise()];
  const seen = new Set(catalog.map(m => m.title.toLowerCase()));

  try {
    const trending = await fetchSacnilkTrending();
    const withUrls = trending.filter(m => m.sourceUrl).slice(0, 6);
    await Promise.all(
      withUrls.map(async (movie) => {
        if (seen.has(movie.title.toLowerCase())) return;
        try {
          const r = await axios.get(movie.sourceUrl, { headers: UA, timeout: 15000 });
          const parsed = parseDaywiseFromSacnilkHtml(r.data, {
            title: movie.title,
            year: movie.year,
            language: movie.language,
          });
          if (parsed) {
            catalog.unshift(parsed);
            seen.add(movie.title.toLowerCase());
          }
        } catch { /* skip */ }
      })
    );
  } catch (err) {
    console.warn('[boxoffice] Daywise scrape failed:', err.message);
  }

  const payload = { updatedAt: new Date().toISOString(), movies: catalog };
  daywiseCache = { at: Date.now(), data: payload };
  return { ...payload, cached: false };
}

export async function getIndianBoxOfficeLive() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) {
    return { ...cache.data, cached: true };
  }

  const staticRows = loadStaticFallback();
  let sacnilk = [];
  let hungama = [];

  try {
    sacnilk = await fetchSacnilkTrending();
  } catch (err) {
    console.warn('[boxoffice] Sacnilk fetch failed:', err.message);
  }

  try {
    hungama = await fetchBollywoodHungamaSnapshot();
  } catch (err) {
    console.warn('[boxoffice] Bollywood Hungama fetch failed:', err.message);
  }

  const merged = dedupeMerge([...sacnilk, ...hungama, ...staticRows]).sort(
    (a, b) => (b.revenue_inr || 0) - (a.revenue_inr || 0)
  );

  const daywiseCatalog = loadStaticDaywise();
  const mergedWithDaywise = merged.map(m => {
    const staticMatch = daywiseCatalog.find(
      d => d.title.toLowerCase() === m.title.toLowerCase() && String(d.year) === String(m.year)
    );
    return {
      ...m,
      daywiseData: m.daywiseData || staticMatch || null
    };
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    sources: {
      sacnilk: sacnilk.length,
      bollywoodhungama: hungama.length,
      static: staticRows.length,
    },
    movies: mergedWithDaywise,
  };

  cache = { at: Date.now(), data: payload };
  return { ...payload, cached: false };
}
