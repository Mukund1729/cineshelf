import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import BoxOffice from '../models/BoxOffice.js';
import { fetchTmdb } from './tmdbService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
};

const currencyQidMap = {
  Q4917: 'USD',
  Q80524: 'INR',
  Q134135: 'GBP',
  Q8138: 'EUR',
  Q4916: 'CAD',
  Q259507: 'AUD',
  Q2009: 'JPY',
  Q17063: 'JPY',
  Q134376: 'CNY',
};

// Clean and parse wikitext currency values
function parseCurrencyString(str, preferredCurrency = 'USD') {
  if (!str) return null;
  let cleaned = str.replace(/<ref[^>]*>([\s\S]*?)<\/ref>/gi, '')
                   .replace(/<ref[^>]*\/>/gi, '')
                   .replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1')
                   .replace(/\[\[([^\]]+)\]\]/g, '$1')
                   .replace(/\{\{[^}]*\}\}/g, '')
                   .replace(/&nbsp;/g, ' ')
                   .replace(/\s+/g, ' ')
                   .trim();

  const parts = cleaned.split(/[()]/);
  for (const part of parts) {
    if (!part.trim()) continue;
    let hasCurrency = false;
    if (preferredCurrency === 'INR') {
      hasCurrency = part.includes('₹') || part.toLowerCase().includes('inr') || part.toLowerCase().includes('rs');
    } else if (preferredCurrency === 'USD') {
      hasCurrency = part.includes('$') || part.toLowerCase().includes('usd');
    } else {
      hasCurrency = true;
    }

    if (hasCurrency) {
      const regex = /([\d,.]+)\s*(crore|cr|lakh|l|million|m|billion|b)?/i;
      const match = part.match(regex);
      if (match) {
        let value = parseFloat(match[1].replace(/,/g, ''));
        if (isNaN(value)) continue;

        const multiplier = match[2] ? match[2].toLowerCase() : '';
        if (multiplier === 'crore' || multiplier === 'cr') {
          value = value * 10000000;
        } else if (multiplier === 'lakh' || multiplier === 'l') {
          value = value * 100000;
        } else if (multiplier === 'million' || multiplier === 'm') {
          value = value * 1000000;
        } else if (multiplier === 'billion' || multiplier === 'b') {
          value = value * 1000000000;
        }
        return { value, currency: preferredCurrency };
      }
    }
  }
  return null;
}

// Load static fallback lists
function loadStaticFallbackCatalog() {
  try {
    const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/boxoffice_fallback.json'), 'utf8'));
    const india = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/boxoffice_india.json'), 'utf8'));
    const daywise = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/boxoffice_daywise.json'), 'utf8'));
    return { fb, india, daywise };
  } catch (err) {
    console.error('[boxoffice pipeline] Failed to load static JSON files:', err.message);
    return { fb: [], india: [], daywise: [] };
  }
}

// Fetch from TMDb API
async function fetchFromTMDb(tmdbId) {
  try {
    const data = await fetchTmdb(`movie/${tmdbId}`);
    return {
      title: data.title,
      budget: data.budget && data.budget > 0 ? { value: data.budget, currency: 'USD' } : null,
      worldwideGross: data.revenue && data.revenue > 0 ? { value: data.revenue, currency: 'USD' } : null,
      releaseDate: data.release_date || null
    };
  } catch (err) {
    console.warn(`[TMDb Fetcher] Failed to fetch for ${tmdbId}:`, err.message);
    return null;
  }
}

// Fetch external IDs and Wikidata claims
async function fetchFromWikidata(tmdbId) {
  try {
    const extData = await fetchTmdb(`movie/${tmdbId}/external_ids`);
    const wikidataId = extData?.wikidata_id;
    if (!wikidataId) return null;

    const wikiUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=claims|sitelinks&format=json`;
    const wikiRes = await axios.get(wikiUrl, { headers: UA, timeout: 15000 });
    const entity = wikiRes.data?.entities?.[wikidataId];
    if (!entity) return null;

    const claims = entity.claims || {};
    const sitelinks = entity.sitelinks || {};
    const enwikiTitle = sitelinks.enwiki?.title || null;

    // Parse Box office P2142
    let worldwideGross = null;
    const boxOfficeClaims = claims.P2142 || [];
    if (boxOfficeClaims.length > 0) {
      const claim = boxOfficeClaims[0];
      const valObj = claim.mainsnak?.datavalue?.value;
      if (valObj) {
        const amount = parseFloat(valObj.amount);
        const unitQid = valObj.unit.split('/').pop();
        const currency = currencyQidMap[unitQid] || 'USD';
        worldwideGross = { value: amount, currency };
      }
    }

    // Parse Budget P2769
    let budget = null;
    const budgetClaims = claims.P2769 || [];
    if (budgetClaims.length > 0) {
      const claim = budgetClaims[0];
      const valObj = claim.mainsnak?.datavalue?.value;
      if (valObj) {
        const amount = parseFloat(valObj.amount);
        const unitQid = valObj.unit.split('/').pop();
        const currency = currencyQidMap[unitQid] || 'USD';
        budget = { value: amount, currency };
      }
    }

    return { enwikiTitle, worldwideGross, budget };
  } catch (err) {
    console.warn(`[Wikidata Fetcher] Failed for ${tmdbId}:`, err.message);
    return null;
  }
}

// Fetch from English Wikipedia
async function fetchFromWikipedia(wikipediaTitle) {
  if (!wikipediaTitle) return null;
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&titles=${encodeURIComponent(wikipediaTitle)}&format=json&redirects=1`;
    const res = await axios.get(url, { headers: UA, timeout: 15000 });
    const pages = res.data?.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    if (!pageId || pageId === '-1') return null;

    const wikitext = pages[pageId].revisions?.[0]?.['*'] || '';

    // Regex parsing for infobox values
    const budgetMatch = wikitext.match(/\|\s*budget\s*=\s*([^|\n}]+)/i);
    const grossMatch = wikitext.match(/\|\s*gross\s*=\s*([^|\n}]+)/i);

    const budgetVal = budgetMatch ? parseCurrencyString(budgetMatch[1]) : null;
    const grossVal = grossMatch ? parseCurrencyString(grossMatch[1]) : null;

    return {
      budget: budgetVal,
      worldwideGross: grossVal
    };
  } catch (err) {
    console.warn(`[Wikipedia Fetcher] Failed for ${wikipediaTitle}:`, err.message);
    return null;
  }
}

// Scrape dynamic values from Sacnilk
async function fetchFromSacnilk(title, year) {
  try {
    const slug = title
      .replace(/[.:'"!@#%^&*()\-+=]/g, '')
      .replace(/\s+/g, '_');
    const url = `https://www.sacnilk.com/news/${slug}_Box_Office_Collection_Day_Wise_Worldwide`;
    const res = await axios.get(url, { headers: UA, timeout: 12000 });
    const html = res.data;

    // Reject generic daily box office summary pages
    const pageTitleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const pageTitle = pageTitleMatch ? pageTitleMatch[1].toLowerCase() : '';
    const cleanTitle = title.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const isCorrectPage = pageTitle.includes(cleanTitle) || html.toLowerCase().includes(cleanTitle);
    if (!isCorrectPage) {
      return null;
    }

    // Parse Daywise collections
    const dayMap = new Map();
    for (const m of html.matchAll(/Day\s*(\d{1,2})[^\₹]*₹\s*([\d,.]+)\s*Cr/gi)) {
      const day = parseInt(m[1], 10);
      if (day < 1 || day > 60) continue;
      const inr = parseFloat(m[2]) * 10000000;
      if (!isNaN(inr)) {
        dayMap.set(day, {
          day,
          date: '',
          amount: inr,
          currency: 'INR',
          source: 'sacnilk'
        });
      }
    }
    const daywise = [...dayMap.values()].sort((a, b) => a.day - b.day);

    const indiaNetMatch = html.match(/India Net Collection[^₹$]*₹\s*([\d,.]+)\s*Cr/i);
    const indiaGrossMatch = html.match(/India Gross Collection[^₹$]*₹\s*([\d,.]+)\s*Cr/i);
    const worldwideMatch = html.match(/Worldwide Collection[^₹$]*₹\s*([\d,.]+)\s*Cr/i);
    const overseasMatch = html.match(/Overseas Collection[^₹$]*₹\s*([\d,.]+)\s*Cr/i);
    const verdictMatch = html.match(/Verdict[^:\n]*:\s*([^\n<|]+)/i);

    return {
      indiaNet: indiaNetMatch ? { value: parseFloat(indiaNetMatch[1]) * 10000000, currency: 'INR' } : null,
      indiaGross: indiaGrossMatch ? { value: parseFloat(indiaGrossMatch[1]) * 10000000, currency: 'INR' } : null,
      worldwideGross: worldwideMatch ? { value: parseFloat(worldwideMatch[1]) * 10000000, currency: 'INR' } : null,
      overseasGross: overseasMatch ? { value: parseFloat(overseasMatch[1]) * 10000000, currency: 'INR' } : null,
      verdict: verdictMatch ? { value: verdictMatch[1].trim(), currency: '' } : null,
      daywiseCollection: daywise.length > 0 ? daywise : null
    };
  } catch (err) {
    // If not found or blocked, fail silently
    return null;
  }
}

// Check local static JSON files
function fetchFromStatic(title, year) {
  const { fb, india, daywise } = loadStaticFallbackCatalog();

  // Search in fallback
  const fallbackMatch = fb.find(
    m => m.title.toLowerCase() === title.toLowerCase() && String(m.year) === String(year)
  );

  // Search in india block
  let indiaMatch = null;
  for (const block of india) {
    if (String(block.year) === String(year)) {
      const match = block.movies?.find(m => m.title.toLowerCase() === title.toLowerCase());
      if (match) {
        // Parse Rupees from "₹1,64,00,00,000" or similar
        const digits = match.revenue.replace(/[^\d]/g, '');
        const amount = parseInt(digits, 10);
        indiaMatch = {
          title: match.title,
          year: block.year,
          language: block.language,
          revenue_inr: amount
        };
        break;
      }
    }
  }

  // Search in daywise
  const daywiseMatch = daywise.find(
    m => m.title.toLowerCase() === title.toLowerCase() && String(m.year) === String(year)
  );

  const res = {};
  if (fallbackMatch) {
    res.worldwideGross = { value: fallbackMatch.revenue_inr, currency: 'INR' };
    res.budget = fallbackMatch.budget_inr ? { value: fallbackMatch.budget_inr, currency: 'INR' } : null;
  } else if (indiaMatch) {
    res.worldwideGross = { value: indiaMatch.revenue_inr, currency: 'INR' };
  }

  if (daywiseMatch) {
    const sumNet = daywiseMatch.daywise_data.reduce((sum, d) => sum + (d.revenue_inr || 0), 0);
    res.indiaNet = sumNet > 0 ? { value: sumNet, currency: 'INR' } : null;
    res.daywiseCollection = daywiseMatch.daywise_data.map(d => ({
      day: d.day,
      date: d.date,
      amount: d.revenue_inr,
      currency: 'INR',
      source: 'static'
    }));
  }

  return Object.keys(res).length > 0 ? res : null;
}

// Priority lists for field-level merging
const FieldPriorities = {
  budget: ['static', 'wikidata', 'wikipedia', 'tmdb'],
  worldwideGross: ['static', 'wikidata', 'wikipedia', 'tmdb'],
  indiaNet: ['sacnilk', 'static'],
  indiaGross: ['sacnilk', 'static'],
  overseasGross: ['sacnilk', 'static'],
  verdict: ['sacnilk', 'static'],
  daywiseCollection: ['sacnilk', 'static'],
};

export async function syncMovieBoxOffice(tmdbId) {
  try {
    // 1. Fetch from TMDb
    const tmdbData = await fetchFromTMDb(tmdbId);
    if (!tmdbData) return null;

    const { title, releaseDate } = tmdbData;
    const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : new Date().getFullYear();

    // 2. Fetch from Wikidata & Wikipedia
    const wikidataData = await fetchFromWikidata(tmdbId);
    let wikipediaData = null;
    if (wikidataData?.enwikiTitle) {
      wikipediaData = await fetchFromWikipedia(wikidataData.enwikiTitle);
    }

    // 3. Fetch from Sacnilk & Static fallbacks
    const sacnilkData = await fetchFromSacnilk(title, releaseYear);
    const staticData = fetchFromStatic(title, releaseYear);

    // 4. Merge values with priority system
    const merged = { tmdbId, title };
    const sourceUrls = {
      tmdb: `https://www.themoviedb.org/movie/${tmdbId}`,
      wikidata: wikidataData ? `https://www.wikidata.org/wiki/Special:EntityData` : null,
      wikipedia: wikidataData?.enwikiTitle ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikidataData.enwikiTitle)}` : null,
      sacnilk: sacnilkData ? `https://www.sacnilk.com` : null,
      static: 'local_database_fallback'
    };

    // Helper to merge fields
    const mergeField = (fieldKey) => {
      const priorities = FieldPriorities[fieldKey] || ['static', 'wikidata', 'wikipedia', 'tmdb'];
      for (const source of priorities) {
        let sourceObj = null;
        if (source === 'tmdb') sourceObj = tmdbData;
        if (source === 'wikidata') sourceObj = wikidataData;
        if (source === 'wikipedia') sourceObj = wikipediaData;
        if (source === 'sacnilk') sourceObj = sacnilkData;
        if (source === 'static') sourceObj = staticData;

        if (sourceObj && sourceObj[fieldKey] !== undefined && sourceObj[fieldKey] !== null) {
          const fieldVal = sourceObj[fieldKey];
          return {
            value: fieldVal.value !== undefined ? fieldVal.value : fieldVal,
            currency: fieldVal.currency !== undefined ? fieldVal.currency : (fieldKey.toLowerCase().includes('india') || fieldKey.toLowerCase().includes('weekend') || fieldKey.toLowerCase().includes('day') ? 'INR' : 'USD'),
            source: source,
            sourceUrl: sourceUrls[source] || null,
            lastUpdated: new Date()
          };
        }
      }
      return null;
    };

    // Populate fields
    merged.budget = mergeField('budget');
    merged.worldwideGross = mergeField('worldwideGross');
    merged.indiaNet = mergeField('indiaNet');
    merged.indiaGross = mergeField('indiaGross');
    merged.overseasGross = mergeField('overseasGross');
    merged.verdict = mergeField('verdict');

    // Handle daywise collection specially (keeps nested value structure)
    const daywiseMerged = mergeField('daywiseCollection');
    if (daywiseMerged) {
      merged.daywiseCollection = {
        value: daywiseMerged.value,
        source: daywiseMerged.source,
        sourceUrl: daywiseMerged.sourceUrl,
        lastUpdated: new Date()
      };
    }

    // Save or update in database
    const updated = await BoxOffice.findOneAndUpdate(
      { tmdbId },
      merged,
      { new: true, upsert: true }
    );

    return updated;
  } catch (err) {
    console.error(`[BoxOffice Sync] Error for ${tmdbId}:`, err);
    return null;
  }
}
