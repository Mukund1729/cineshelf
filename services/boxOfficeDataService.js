import { randomUUID } from 'node:crypto';
import axios from 'axios';
import BoxOfficeCache from '../models/BoxOfficeCache.js';
import BoxOfficeDaily from '../models/BoxOfficeDaily.js';
import BoxOfficeLifetime from '../models/BoxOfficeLifetime.js';
import BoxOfficeSyncState from '../models/BoxOfficeSyncState.js';
import { fetchTmdb } from './tmdbService.js';
import { ensureBoxOfficeCacheWritesAllowed } from './storageMonitor.js';

const INDIAN_BOX_OFFICE_FEED_URL = 'https://indian-boxoffice.com/feed.xml';
const INDIAN_BOX_OFFICE_DAILY_URL = 'https://indian-boxoffice.com/daily-box-office/';
const BOX_OFFICE_HISTORY_API = 'https://www.boxofficehistory.com/api/v1';
const INDIA_PROVIDER = 'indian-boxoffice-rss';
const HISTORY_PROVIDER = 'box-office-history';
const CRORE_INR = 10_000_000;
const MAX_RSS_BYTES = 1_000_000;
const MAX_HTML_BYTES = 2_000_000;
const MAX_CACHE_PAYLOAD_BYTES = 128 * 1024;
const MAX_HISTORY_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_HISTORY_MEMORY_ENTRY_BYTES = 2 * 1024 * 1024;
const MAX_HISTORY_MEMORY_CACHE_BYTES = 8 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 100;
const MAX_DAILY_REPORTS = 1000;
const MAX_LIFETIME_REPORTS = 300;
const DEFAULT_MAX_TMDB_LOOKUPS_PER_SYNC = 60;
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60;
const DEFAULT_REPORT_TTL_DAYS = 30;
const SYNC_LEASE_MS = 30 * 60 * 1000;
const inFlight = new Map();
const historyMemoryCache = new Map();
let historyMemoryCacheBytes = 0;

function envInteger(name, fallback, min, max) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function maxTmdbLookupsPerSync() {
  return envInteger('BOX_OFFICE_MAX_TMDB_LOOKUPS', DEFAULT_MAX_TMDB_LOOKUPS_PER_SYNC, 10, 120);
}

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlTag(item, name) {
  const match = item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function dateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function finiteAmount(value) {
  if (value == null || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function sourcePath(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'indian-boxoffice.com') return null;
    return parsed.pathname.split('/').filter(Boolean).join('/');
  } catch {
    return null;
  }
}

function parseCrores(value) {
  const amount = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * CRORE_INR) : null;
}

function getSourceMovieKey(path, title) {
  const moviePath = path.match(/(?:^|\/)movies\/([^/]+)/i);
  // Preserve publisher slug casing — indian-boxoffice.com paths are case-sensitive.
  if (moviePath) return decodeURIComponent(moviePath[1]).replace(/\/+$/, '');
  const normalized = normalizeTitle(title).replace(/\s+/g, '-');
  return `title-${normalized || 'unknown'}`;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceMovieKeyFilter(sourceMovieKey) {
  const key = String(sourceMovieKey || '').replace(/^\/?movies\//i, '').replace(/\/+$/, '').trim();
  if (!key) return null;
  return { $regex: `^${escapeRegex(key)}$`, $options: 'i' };
}

function parseCroreCell(value) {
  const text = decodeXml(value).replace(/\s+/g, ' ').trim();
  if (!text || text === '—' || text === '-' || /^n\/?a$/i.test(text)) return null;
  const match = text.match(/₹\s*([\d,.]+)\s*Cr/i) || text.match(/^([\d,.]+)\s*Cr$/i);
  if (!match) return null;
  return {
    amount: parseCrores(match[1]),
    reported: match[0].startsWith('₹') ? match[0] : `₹${match[1]} Cr`,
  };
}

function pushDailyReport(target, report) {
  if (!report?.movieTitle || !report.reportDate || report.dailyCollection == null) return;
  const key = `${normalizeTitle(report.movieTitle)}|${report.reportDate}`;
  const existing = target.get(key);
  if (!existing) {
    target.set(key, report);
    return;
  }
  const preferRanked = report.rank != null && existing.rank == null;
  const preferLaterDay = Number(report.dayNumber || 0) > Number(existing.dayNumber || 0);
  if (preferRanked || preferLaterDay) target.set(key, report);
}

function pushLifetimeReport(target, report) {
  if (!report?.movieTitle || !report.reportDate || report.amount == null) return;
  const key = `${normalizeTitle(report.movieTitle)}|${report.collectionType}|${report.reportDate}`;
  const existing = target.get(key);
  if (!existing || report.amount >= existing.amount) {
    target.set(key, report);
  }
}

function cleanBriefMovieTitle(value) {
  return String(value || '')
    .replace(/\b\d{1,2}:\d{2}\s*(?:IST|UTC|GMT)?\s*:?\s*/gi, ' ')
    .replace(/\bIST\s*:?\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCompactBriefEntries(text, reportDate, reportedAt, sourceUrl, lifetimeByTitle) {
  const daily = new Map();
  const lifetime = new Map();
  const matches = [...String(text || '').matchAll(
    /(?:^|[;\n]|\d{1,2}:\d{2}\s*(?:IST|UTC|GMT)?\s*:)\s*([A-Za-z][\w .'&:-]{1,80}?)\s+Day\s+(\d+)\s*:\s*₹\s*([\d,.]+)\s*Cr(?:\s+India\s+nett)?/gi
  )];
  for (const match of matches) {
    const movieTitle = cleanBriefMovieTitle(match[1]);
    if (!movieTitle || /^(india box office|daily indian|latest|update)/i.test(movieTitle)) continue;
    const dailyCollection = parseCrores(match[3]);
    if (dailyCollection == null || !reportDate) continue;
    const movieInfo = lifetimeByTitle.get(normalizeTitle(movieTitle));
    const sourceMovieKey = movieInfo?.sourceMovieKey || getSourceMovieKey(sourceUrl || '', movieTitle);
    pushDailyReport(daily, {
      movieTitle,
      sourceMovieKey,
      reportDate,
      dayNumber: Number(match[2]),
      dailyCollection,
      cumulativeCollection: null,
      sourceReportedValue: `₹${match[3]} Cr`,
      sourceReportedCumulativeValue: null,
      reportedAt,
      sourceUrl,
    });
  }
  return { dailyReports: [...daily.values()], lifetimeReports: [...lifetime.values()] };
}

export function parseIndianDailyChartHtml(html, { reportDate = null, reportedAt = new Date() } = {}) {
  if (typeof html !== 'string' || html.length > MAX_HTML_BYTES) {
    throw new Error('Indian Box Office daily chart HTML is missing or exceeds the size limit.');
  }

  const updatedMatch = html.match(/Updated\s+(\d{4}-\d{2}-\d{2})/i);
  const chartDate = reportDate || updatedMatch?.[1] || dateOnly(reportedAt);
  if (!chartDate) {
    throw new Error('Indian Box Office daily chart date could not be determined.');
  }

  const daily = new Map();
  const lifetime = new Map();
  const rows = [...html.matchAll(/<tr\b[^>]*class="[^"]*\blive\b[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi)];
  if (rows.length > 200) throw new Error('Indian Box Office daily chart exceeds the row limit.');

  for (const rowMatch of rows) {
    const row = rowMatch[1];
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => match[1]);
    if (cells.length < 5) continue;

    const linkMatch = cells[1].match(/href="(\/movies\/[^"]+)"/i);
    const titleMatch = cells[1].match(/aria-label="Open details for ([^"]+)"/i)
      || cells[1].match(/<span>([\s\S]*?)<span class="pill">/i)
      || cells[1].match(/alt="([^"]+?)\s+box office poster"/i);
    const movieTitle = decodeXml(titleMatch?.[1] || '').trim();
    if (!movieTitle) continue;

    const path = linkMatch ? `movies/${linkMatch[1].replace(/^\/movies\//i, '').replace(/\/$/, '')}` : '';
    const sourceMovieKey = getSourceMovieKey(path || linkMatch?.[1] || '', movieTitle);
    const dayMatch = decodeXml(cells[3]).match(/Day\s*(\d+)/i);
    const dayAmount = parseCroreCell(cells[4]);
    const cumulative = cells[6] ? parseCroreCell(cells[6]) : null;
    const worldwide = cells[7] ? parseCroreCell(cells[7]) : null;
    const rank = Number(decodeXml(cells[0]));
    const sourceUrl = linkMatch
      ? `https://indian-boxoffice.com${linkMatch[1]}`
      : INDIAN_BOX_OFFICE_DAILY_URL;

    if (dayAmount?.amount != null) {
      pushDailyReport(daily, {
        movieTitle,
        sourceMovieKey,
        reportDate: chartDate,
        dayNumber: dayMatch ? Number(dayMatch[1]) : null,
        dailyCollection: dayAmount.amount,
        cumulativeCollection: cumulative?.amount ?? null,
        sourceReportedValue: dayAmount.reported,
        sourceReportedCumulativeValue: cumulative?.reported ?? null,
        reportedAt,
        sourceUrl,
        rank: Number.isFinite(rank) ? rank : null,
      });
    }

    if (cumulative?.amount != null) {
      pushLifetimeReport(lifetime, {
        movieTitle,
        sourceMovieKey,
        collectionType: 'india_nett',
        market: 'india',
        territory: 'IN',
        amount: cumulative.amount,
        sourceReportedValue: cumulative.reported,
        reportDate: chartDate,
        reportedAt,
        sourceUrl,
      });
    }

    if (worldwide?.amount != null) {
      pushLifetimeReport(lifetime, {
        movieTitle,
        sourceMovieKey,
        collectionType: 'worldwide_gross',
        market: 'worldwide',
        territory: 'WW',
        amount: worldwide.amount,
        sourceReportedValue: worldwide.reported,
        reportDate: chartDate,
        reportedAt,
        sourceUrl,
      });
    }
  }

  return {
    reportDate: chartDate,
    dailyReports: [...daily.values()],
    lifetimeReports: [...lifetime.values()],
  };
}

export function parseIndianBoxOfficeFeed(xml) {
  if (typeof xml !== 'string' || xml.length > MAX_RSS_BYTES) {
    throw new Error('Indian Box Office RSS is missing or exceeds the size limit.');
  }

  const rawItems = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match => {
    const item = match[1];
    return {
      title: xmlTag(item, 'title'),
      link: xmlTag(item, 'link'),
      description: xmlTag(item, 'description'),
      pubDate: xmlTag(item, 'pubDate'),
    };
  });
  if (rawItems.length > 500) throw new Error('Indian Box Office RSS exceeds the item limit.');

  const lifetimeByTitle = new Map();
  for (const item of rawItems) {
    const path = sourcePath(item.link);
    if (!path || !/^movies\//i.test(path)) continue;
    const movieTitle = item.title.replace(/\s+box office\s*[—-].*$/i, '').trim();
    const key = normalizeTitle(movieTitle);
    if (key && !lifetimeByTitle.has(key)) {
      lifetimeByTitle.set(key, { sourceMovieKey: getSourceMovieKey(path, movieTitle), path });
    }
  }

  const daily = new Map();
  const lifetime = new Map();
  for (const item of rawItems) {
    const path = sourcePath(item.link);
    const reportedAt = new Date(item.pubDate);
    if (!path || Number.isNaN(reportedAt.getTime())) continue;

    const reportDate = (path.match(/^briefs\/(\d{4}-\d{2}-\d{2})$/i) || [])[1]
      || dateOnly(item.pubDate);

    const leadDaily = item.description.match(
      /^(.+?)\s+leads the latest reported daily India nett at\s*₹\s*([\d,.]+)\s*Cr on Day\s*(\d+)([\s\S]*)$/i
    );
    if (leadDaily) {
      const movieTitle = leadDaily[1].trim();
      const dailyCollection = parseCrores(leadDaily[2]);
      const cumulativeMatch = leadDaily[4].match(
        /cumulative India nett (?:to|is)\s*₹\s*([\d,.]+)\s*Cr/i
      );
      const cumulativeCollection = cumulativeMatch ? parseCrores(cumulativeMatch[1]) : null;
      const worldwideMatch = leadDaily[4].match(/worldwide gross to\s*₹\s*([\d,.]+)\s*Cr/i);
      const movieInfo = lifetimeByTitle.get(normalizeTitle(movieTitle));
      const sourceMovieKey = movieInfo?.sourceMovieKey || getSourceMovieKey(path, movieTitle);

      if (dailyCollection !== null && reportDate) {
        pushDailyReport(daily, {
          movieTitle,
          sourceMovieKey,
          reportDate,
          dayNumber: Number(leadDaily[3]),
          dailyCollection,
          cumulativeCollection,
          sourceReportedValue: `₹${leadDaily[2]} Cr`,
          sourceReportedCumulativeValue: cumulativeMatch ? `₹${cumulativeMatch[1]} Cr` : null,
          reportedAt,
          sourceUrl: item.link,
        });
      }

      if (worldwideMatch && reportDate) {
        const amount = parseCrores(worldwideMatch[1]);
        if (amount !== null) {
          pushLifetimeReport(lifetime, {
            movieTitle,
            sourceMovieKey,
            collectionType: 'worldwide_gross',
            market: 'worldwide',
            territory: 'WW',
            amount,
            sourceReportedValue: `₹${worldwideMatch[1]} Cr`,
            reportDate,
            reportedAt,
            sourceUrl: item.link,
          });
        }
      }
      if (cumulativeCollection != null && reportDate) {
        pushLifetimeReport(lifetime, {
          movieTitle,
          sourceMovieKey,
          collectionType: 'india_nett',
          market: 'india',
          territory: 'IN',
          amount: cumulativeCollection,
          sourceReportedValue: cumulativeMatch ? `₹${cumulativeMatch[1]} Cr` : null,
          reportDate,
          reportedAt,
          sourceUrl: item.link,
        });
      }
      continue;
    }

    // Newer brief style: "Ramayana Day 16: ₹15.75 Cr India nett"
    if (/^briefs?(?:\/|$)/i.test(path) || /day\s+\d+\s*:/i.test(item.title) || /day\s+\d+\s*:/i.test(item.description)) {
      const compact = parseCompactBriefEntries(
        `${item.title}\n${item.description}`,
        reportDate,
        reportedAt,
        item.link,
        lifetimeByTitle
      );
      for (const report of compact.dailyReports) pushDailyReport(daily, report);
      for (const report of compact.lifetimeReports) pushLifetimeReport(lifetime, report);
      if (compact.dailyReports.length) continue;
    }

    if (!/^movies\//i.test(path)) continue;
    const movieTitle = item.title.replace(/\s+box office\s*[—-].*$/i, '').trim();
    if (!movieTitle || !reportDate) continue;

    const languageMatch = item.description.match(/\((Hindi|Telugu|Tamil|Malayalam|Kannada|English)\)/i);
    const languageCodes = {
      hindi: 'hi',
      telugu: 'te',
      tamil: 'ta',
      malayalam: 'ml',
      kannada: 'kn',
      english: 'en',
    };
    const language = languageMatch ? languageCodes[languageMatch[1].toLowerCase()] : null;
    const netMatch = item.description.match(/India nett\s*₹\s*([\d,.]+)\s*Cr/i);
    const worldwideMatch = item.description.match(/worldwide\s*₹\s*([\d,.]+)\s*Cr/i);
    const sourceMovieKey = getSourceMovieKey(path, movieTitle);

    if (netMatch) {
      const amount = parseCrores(netMatch[1]);
      if (amount !== null) {
        pushLifetimeReport(lifetime, {
          movieTitle,
          sourceMovieKey,
          collectionType: 'india_nett',
          market: 'india',
          territory: 'IN',
          amount,
          sourceReportedValue: `₹${netMatch[1]} Cr`,
          reportDate,
          reportedAt,
          sourceUrl: item.link,
          language,
        });
      }
    }
    if (worldwideMatch) {
      const amount = parseCrores(worldwideMatch[1]);
      if (amount !== null) {
        pushLifetimeReport(lifetime, {
          movieTitle,
          sourceMovieKey,
          collectionType: 'worldwide_gross',
          market: 'worldwide',
          territory: 'WW',
          amount,
          sourceReportedValue: `₹${worldwideMatch[1]} Cr`,
          reportDate,
          reportedAt,
          sourceUrl: item.link,
          language,
        });
      }
    }
  }

  return {
    dailyReports: [...daily.values()],
    lifetimeReports: [...lifetime.values()],
  };
}

function reportDateValue(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function reportTtlDate() {
  const days = envInteger('BOX_OFFICE_REPORT_TTL_DAYS', DEFAULT_REPORT_TTL_DAYS, 1, 365);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function reportIdentity(source, sourceMovieKey, collectionType, reportDate) {
  return `${source}:${sourceMovieKey}:${collectionType}:${reportDate}`;
}

function toTmdbMatch(match) {
  if (!match?.id) return null;
  return {
    tmdbId: Number(match.id),
    originalTitle: match.original_title || null,
    posterPath: match.poster_path || null,
    releaseDate: match.release_date || null,
    releaseYear: match.release_date ? Number(match.release_date.slice(0, 4)) : null,
    originalLanguage: match.original_language || null,
  };
}

async function findTmdbMatch(title, year) {
  const params = { query: title };
  if (year) params.year = year;

  let response;
  try {
    response = await fetchTmdb('search/movie', params);
  } catch (error) {
    // One short retry for transient TMDB blips during sync.
    await new Promise(resolve => setTimeout(resolve, 350));
    response = await fetchTmdb('search/movie', params);
  }

  const target = normalizeTitle(title);
  const results = response.results || [];
  let candidates = results.filter(movie => (
    normalizeTitle(movie.title) === target || normalizeTitle(movie.original_title) === target
  ));
  if (year) {
    const matchingYear = candidates.filter(movie => movie.release_date?.startsWith(String(year)));
    if (matchingYear.length) candidates = matchingYear;
  }
  if (candidates.length === 1) return toTmdbMatch(candidates[0]);

  // Soft fallback: prefer year match, then near-title first hit.
  if (year) {
    const byYear = results.find(movie => movie.release_date?.startsWith(String(year)));
    if (byYear) return toTmdbMatch(byYear);
  }
  const near = results.find(movie => {
    const name = normalizeTitle(movie.title);
    const original = normalizeTitle(movie.original_title);
    return name.includes(target) || target.includes(name) || original.includes(target) || target.includes(original);
  });
  return toTmdbMatch(near || null);
}

async function upsertReportBatch(Model, reports, kind) {
  if (!reports.length) return 0;
  await ensureBoxOfficeCacheWritesAllowed();

  const keys = reports.map(report => report.reportKey);
  const currentReports = await Model.find({ reportKey: { $in: keys } }).lean();
  const existingByKey = new Map(currentReports.map(report => [report.reportKey, report]));
  const operations = reports.map(report => {
    const previous = existingByKey.get(report.reportKey);
    const changed = kind === 'daily'
      ? previous && (
        previous.dailyCollection !== report.dailyCollection ||
        previous.cumulativeCollection !== report.cumulativeCollection ||
        previous.sourceReportedValue !== report.sourceReportedValue ||
        previous.sourceReportedCumulativeValue !== report.sourceReportedCumulativeValue
      )
      : previous && (
        previous.amount !== report.amount ||
        previous.currency !== report.currency ||
        previous.sourceReportedValue !== report.sourceReportedValue
      );
    const priorRevision = kind === 'daily'
      ? {
        dailyCollection: previous?.dailyCollection,
        cumulativeCollection: previous?.cumulativeCollection,
        sourceReportedValue: previous?.sourceReportedValue,
        sourceReportedCumulativeValue: previous?.sourceReportedCumulativeValue,
        reportedAt: previous?.reportedAt,
      }
      : {
        amount: previous?.amount,
        currency: previous?.currency,
        sourceReportedValue: previous?.sourceReportedValue,
        reportedAt: previous?.reportedAt,
      };

    return {
      updateOne: {
        filter: { reportKey: report.reportKey },
        update: {
          $set: report,
          ...(changed
            ? { $push: { revisionHistory: { $each: [priorRevision], $slice: -5 } } }
            : { $setOnInsert: { revisionHistory: [] } }),
        },
        upsert: true,
      },
    };
  });

  await Model.bulkWrite(operations, { ordered: false });
  const maxReports = kind === 'daily'
    ? envInteger('BOX_OFFICE_MAX_DAILY_REPORTS', MAX_DAILY_REPORTS, 10, 10000)
    : envInteger('BOX_OFFICE_MAX_LIFETIME_REPORTS', MAX_LIFETIME_REPORTS, 10, 5000);
  const count = await Model.countDocuments();
  if (count > maxReports) {
    const expiredKeys = await Model.find({})
      .sort({ reportedAt: 1 })
      .limit(count - maxReports)
      .select('_id')
      .lean();
    if (expiredKeys.length) {
      await Model.deleteMany({ _id: { $in: expiredKeys.map(report => report._id) } });
    }
  }
  return operations.length;
}

async function syncState(provider, successful, reportsImported, error) {
  const now = new Date();
  const update = {
    lastAttemptAt: now,
    lastErrorCode: successful ? null : String(error?.code || error?.response?.status || 'provider_error').slice(0, 80),
  };
  if (successful) {
    update.lastSuccessfulAt = now;
    update.reportsImported = reportsImported;
  }
  await BoxOfficeSyncState.updateOne({ provider }, { $set: update }, { upsert: true });
}

async function acquireSyncLease(owner) {
  const now = new Date();
  try {
    const lease = await BoxOfficeSyncState.findOneAndUpdate(
      {
        provider: INDIA_PROVIDER,
        $or: [
          { lockExpiresAt: { $lte: now } },
          { lockExpiresAt: null },
        ],
      },
      {
        $set: {
          lockOwner: owner,
          lockExpiresAt: new Date(now.getTime() + SYNC_LEASE_MS),
        },
        $setOnInsert: {
          provider: INDIA_PROVIDER,
          lastAttemptAt: now,
        },
      },
      { upsert: true, new: true }
    );
    return lease?.lockOwner === owner;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

async function releaseSyncLease(owner) {
  await BoxOfficeSyncState.updateOne(
    { provider: INDIA_PROVIDER, lockOwner: owner },
    { $unset: { lockOwner: 1, lockExpiresAt: 1 } }
  );
}

async function fetchIndianText(url, { accept, maxBytes }) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await axios.get(url, {
        timeout: 20_000,
        responseType: 'text',
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        headers: {
          Accept: accept,
          'User-Agent': 'VisualCineasteBoxOffice/1.0 (+https://visualcineaste.local)',
        },
      });
      if (typeof response.data !== 'string') throw new Error('Provider response was not text.');
      return response.data;
    } catch (error) {
      lastError = error;
      if (error.response?.status && error.response.status < 500 && error.response.status !== 429) break;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** attempt)));
    }
  }
  throw lastError;
}

async function fetchIndianFeed() {
  return fetchIndianText(INDIAN_BOX_OFFICE_FEED_URL, {
    accept: 'application/rss+xml, application/xml, text/xml',
    maxBytes: MAX_RSS_BYTES,
  });
}

async function fetchIndianDailyChart() {
  return fetchIndianText(INDIAN_BOX_OFFICE_DAILY_URL, {
    accept: 'text/html,application/xhtml+xml',
    maxBytes: MAX_HTML_BYTES,
  });
}

function mergeParsedReports(...parts) {
  const daily = new Map();
  const lifetime = new Map();
  for (const part of parts) {
    for (const report of part?.dailyReports || []) pushDailyReport(daily, report);
    for (const report of part?.lifetimeReports || []) pushLifetimeReport(lifetime, report);
  }
  return {
    dailyReports: [...daily.values()],
    lifetimeReports: [...lifetime.values()],
  };
}

export async function syncIndianBoxOfficeFeed() {
  const owner = randomUUID();
  if (!await acquireSyncLease(owner)) {
    return { dailyReports: 0, lifetimeReports: 0, skipped: true };
  }

  try {
    const feedXml = await fetchIndianFeed();
    const feedParsed = parseIndianBoxOfficeFeed(feedXml);

    let chartParsed = { dailyReports: [], lifetimeReports: [] };
    try {
      chartParsed = parseIndianDailyChartHtml(await fetchIndianDailyChart(), {
        reportedAt: new Date(),
      });
      console.log(
        `[Box Office] Daily chart parsed: ${chartParsed.dailyReports.length} films for ${chartParsed.reportDate}.`
      );
    } catch (error) {
      console.warn(`[Box Office] Daily chart fetch/parse failed: ${error.message}`);
    }

    const parsed = mergeParsedReports(feedParsed, chartParsed);
    const titles = [...new Set([...parsed.dailyReports, ...parsed.lifetimeReports].map(report => report.movieTitle))];
    const tmdbMatches = new Map();
    const canLookupTmdb = Boolean(process.env.TMDB_READ_ACCESS_TOKEN && process.env.TMDB_READ_ACCESS_TOKEN.length >= 20);
    if (!canLookupTmdb) {
      console.warn('[Box Office] TMDB matching skipped because TMDB_READ_ACCESS_TOKEN is unavailable.');
    }
    for (const title of (canLookupTmdb ? titles.slice(0, maxTmdbLookupsPerSync()) : [])) {
      try {
        const sourceKey = [...parsed.lifetimeReports, ...parsed.dailyReports]
          .find(report => normalizeTitle(report.movieTitle) === normalizeTitle(title))
          ?.sourceMovieKey || '';
        const year = Number((sourceKey.match(/(?:^|[_-])((?:19|20)\d{2})(?:[_-]|$)/) || [])[1]) || null;
        const match = await findTmdbMatch(title, year);
        if (match) tmdbMatches.set(normalizeTitle(title), match);
      } catch (error) {
        console.warn(`[Box Office] TMDB title match unavailable for "${title}": ${error.code || error.message}`);
      }
    }

    const expiresAt = reportTtlDate();
    const daily = parsed.dailyReports.map(report => {
      const match = tmdbMatches.get(normalizeTitle(report.movieTitle));
      const reportKey = reportIdentity(INDIA_PROVIDER, report.sourceMovieKey, 'india_nett', report.reportDate);
      return {
        reportKey,
        tmdbId: match?.tmdbId ?? null,
        movieTitle: report.movieTitle,
        originalTitle: match?.originalTitle || null,
        posterPath: match?.posterPath || null,
        releaseDate: match?.releaseDate || null,
        releaseYear: match?.releaseYear || null,
        originalLanguage: match?.originalLanguage || null,
        reportDate: reportDateValue(report.reportDate),
        market: 'india',
        territory: 'IN',
        collectionType: 'india_nett',
        dailyCollection: report.dailyCollection,
        cumulativeCollection: report.cumulativeCollection,
        sourceReportedValue: report.sourceReportedValue,
        sourceReportedCumulativeValue: report.sourceReportedCumulativeValue,
        currency: 'INR',
        rank: report.rank ?? null,
        dayNumber: Number.isFinite(Number(report.dayNumber)) ? Number(report.dayNumber) : null,
        source: INDIA_PROVIDER,
        sourceMovieKey: report.sourceMovieKey,
        sourceUrl: report.sourceUrl,
        reportedAt: report.reportedAt,
        isEstimate: true,
        verificationStatus: 'publisher-consensus-estimate',
        expiresAt,
      };
    });

    const lifetime = parsed.lifetimeReports.map(report => {
      const match = tmdbMatches.get(normalizeTitle(report.movieTitle));
      const reportKey = reportIdentity(
        INDIA_PROVIDER,
        report.sourceMovieKey,
        report.collectionType,
        'latest'
      );
      return {
        reportKey,
        tmdbId: match?.tmdbId ?? null,
        movieTitle: report.movieTitle,
        originalTitle: match?.originalTitle || null,
        posterPath: match?.posterPath || null,
        releaseDate: match?.releaseDate || null,
        releaseYear: match?.releaseYear || null,
        originalLanguage: match?.originalLanguage || report.language || null,
        reportDate: reportDateValue(report.reportDate),
        market: report.market,
        territory: report.territory,
        collectionType: report.collectionType,
        amount: report.amount,
        sourceReportedValue: report.sourceReportedValue,
        currency: 'INR',
        source: INDIA_PROVIDER,
        sourceMovieKey: report.sourceMovieKey,
        sourceUrl: report.sourceUrl,
        reportedAt: report.reportedAt,
        isEstimate: true,
        verificationStatus: 'publisher-consensus-estimate',
        expiresAt,
      };
    });

    const [dailyCount, lifetimeCount] = await Promise.all([
      upsertReportBatch(BoxOfficeDaily, daily, 'daily'),
      upsertReportBatch(BoxOfficeLifetime, lifetime, 'lifetime'),
    ]);

    // Drop malformed brief titles left by earlier parsers (e.g. "7:00 IST: Ramayana").
    const junkFilter = {
      source: INDIA_PROVIDER,
      $or: [
        { movieTitle: /^\d{1,2}:\d{2}\b/i },
        { movieTitle: /\bIST\s*:/i },
        { sourceMovieKey: /^title-\d{1,2}-\d{2}-ist-/i },
      ],
    };
    const [junkDaily, junkLifetime] = await Promise.all([
      BoxOfficeDaily.deleteMany(junkFilter),
      BoxOfficeLifetime.deleteMany(junkFilter),
    ]);
    if (junkDaily.deletedCount || junkLifetime.deletedCount) {
      console.log(
        `[Box Office] Removed ${junkDaily.deletedCount} daily and ${junkLifetime.deletedCount} lifetime junk reports.`
      );
    }

    let daywiseMovies = 0;
    try {
      const chartMovies = chartParsed.dailyReports.map(report => {
        const match = tmdbMatches.get(normalizeTitle(report.movieTitle));
        return {
          sourceMovieKey: report.sourceMovieKey,
          movieTitle: report.movieTitle,
          tmdbId: match?.tmdbId ?? null,
          posterPath: match?.posterPath || null,
          releaseDate: match?.releaseDate || null,
          releaseYear: match?.releaseYear || null,
          originalLanguage: match?.originalLanguage || null,
        };
      });
      daywiseMovies = await syncDaywiseForChartMovies(chartMovies);
      console.log(`[Box Office] Day-wise movie pages synced for ${daywiseMovies} titles.`);
    } catch (error) {
      console.warn(`[Box Office] Day-wise movie sync skipped: ${error.message}`);
    }

    await syncState(INDIA_PROVIDER, true, dailyCount + lifetimeCount);
    return {
      dailyReports: dailyCount,
      lifetimeReports: lifetimeCount,
      chartFilms: chartParsed.dailyReports.length,
      chartDate: chartParsed.reportDate || null,
      daywiseMovies,
    };
  } catch (error) {
    await syncState(INDIA_PROVIDER, false, 0, error);
    throw error;
  } finally {
    try {
      await releaseSyncLease(owner);
    } catch (error) {
      console.error('[Box Office] Could not release RSS sync lease:', error.message);
    }
  }
}

async function cacheProviderResponse(cacheKey, provider, payload) {
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CACHE_PAYLOAD_BYTES) {
    console.warn(`[Box Office] Skipping oversized ${provider} response cache (${cacheKey}).`);
    return;
  }
  try {
    await ensureBoxOfficeCacheWritesAllowed();
    const ttlSeconds = envInteger('BOX_OFFICE_CACHE_TTL_SECONDS', DEFAULT_CACHE_TTL_SECONDS, 60, 30 * 24 * 60 * 60);
    await BoxOfficeCache.updateOne(
      { cacheKey },
      {
        $set: {
          provider,
          payload,
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        },
      },
      { upsert: true }
    );
    const count = await BoxOfficeCache.countDocuments();
    if (count > MAX_CACHE_ENTRIES) {
      const oldest = await BoxOfficeCache.findOne({ cacheKey: { $ne: cacheKey } })
        .sort({ fetchedAt: 1 })
        .select('_id')
        .lean();
      if (oldest) await BoxOfficeCache.deleteOne({ _id: oldest._id });
    }
  } catch (error) {
    console.warn(`[Box Office] Could not cache ${provider} response: ${error.code || error.message}`);
  }
}

function getHistoryMemoryCache(cacheKey) {
  const cached = historyMemoryCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    historyMemoryCache.delete(cacheKey);
    historyMemoryCacheBytes -= cached.bytes;
    return null;
  }
  historyMemoryCache.delete(cacheKey);
  historyMemoryCache.set(cacheKey, cached);
  return cached.payload;
}

function cacheHistoryMemoryResponse(cacheKey, payload, ttlSeconds) {
  const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  if (bytes > MAX_HISTORY_MEMORY_ENTRY_BYTES) return;
  const previous = historyMemoryCache.get(cacheKey);
  if (previous) {
    historyMemoryCache.delete(cacheKey);
    historyMemoryCacheBytes -= previous.bytes;
  }
  while (historyMemoryCache.size && historyMemoryCacheBytes + bytes > MAX_HISTORY_MEMORY_CACHE_BYTES) {
    const oldestKey = historyMemoryCache.keys().next().value;
    const oldest = historyMemoryCache.get(oldestKey);
    historyMemoryCache.delete(oldestKey);
    historyMemoryCacheBytes -= oldest.bytes;
  }
  historyMemoryCache.set(cacheKey, {
    payload,
    bytes,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  historyMemoryCacheBytes += bytes;
}

async function getCachedResponse(cacheKey) {
  const cached = await BoxOfficeCache.findOne({
    cacheKey,
    expiresAt: { $gt: new Date() },
  }).lean();
  return cached?.payload || null;
}

async function fetchHistoryJson(cacheKey, path) {
  const memoryCached = getHistoryMemoryCache(cacheKey);
  if (memoryCached) return memoryCached;

  const cached = await getCachedResponse(cacheKey);
  if (cached) return cached;

  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await axios.get(`${BOX_OFFICE_HISTORY_API}/${path}`, {
        timeout: 15_000,
        responseType: 'json',
        maxContentLength: MAX_HISTORY_RESPONSE_BYTES,
        maxBodyLength: MAX_HISTORY_RESPONSE_BYTES,
        headers: { Accept: 'application/json' },
      });
      const contentType = String(response.headers?.['content-type'] || '');
      // Provider sometimes returns HTML/SPA shell with HTTP 200
      if (
        contentType.includes('text/html')
        || typeof response.data === 'string'
        || !response.data
        || typeof response.data !== 'object'
      ) {
        const err = new Error('Box Office History returned an invalid response.');
        err.status = 404;
        err.code = 'history_resource_not_found';
        throw err;
      }
      const cacheTtlSeconds = envInteger(
        'BOX_OFFICE_CACHE_TTL_SECONDS',
        DEFAULT_CACHE_TTL_SECONDS,
        60,
        30 * 24 * 60 * 60
      );
      if (Buffer.byteLength(JSON.stringify(response.data), 'utf8') > MAX_CACHE_PAYLOAD_BYTES) {
        cacheHistoryMemoryResponse(cacheKey, response.data, cacheTtlSeconds);
      }
      await cacheProviderResponse(cacheKey, HISTORY_PROVIDER, response.data);
      return response.data;
    } catch (error) {
      lastError = error;
      if (error.response?.status && error.response.status < 500 && error.response.status !== 429) {
        error.status = error.response.status;
        if (error.response.status === 404) error.code = 'history_resource_not_found';
        break;
      }
      if (error.response?.status === 429) {
        error.status = 503;
        error.code = 'history_provider_rate_limited';
      }
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (2 ** attempt)));
    }
  }
  throw lastError;
}

function withInFlight(key, callback) {
  if (inFlight.has(key)) return inFlight.get(key);
  const request = callback().finally(() => inFlight.delete(key));
  if (inFlight.size >= 100) inFlight.delete(inFlight.keys().next().value);
  inFlight.set(key, request);
  return request;
}

export async function getBoxOfficeHistoryDay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dateOnly(date) !== date) {
    const error = new Error('A valid date in YYYY-MM-DD format is required.');
    error.status = 400;
    error.code = 'invalid_date';
    throw error;
  }
  return withInFlight(`history-day:${date}`, async () => {
    const data = await fetchHistoryJson(`history:day:${date}`, `days/${date}.json`);
    if (!Array.isArray(data.rows)) {
      const error = new Error(`No Box Office History daily chart is available for ${date}.`);
      error.status = 404;
      error.code = 'history_day_unavailable';
      throw error;
    }
    return {
      date: data.date || date,
      market: 'US',
      territory: 'US',
      currency: 'USD',
      source: HISTORY_PROVIDER,
      sourceUrl: `${BOX_OFFICE_HISTORY_API}/days/${date}.json`,
      rows: data.rows.map(row => ({
        rank: row.rank ?? null,
        title: row.title,
        dailyCollection: finiteAmount(row.gross),
        cumulativeCollection: finiteAmount(row.toDate),
        currency: 'USD',
        source: HISTORY_PROVIDER,
        sourceUrl: `${BOX_OFFICE_HISTORY_API}/days/${date}.json`,
        sourceId: row.id || null,
        dayNumber: row.day ?? null,
        isEstimate: row.estimated === true,
        verificationStatus: row.estimated === true ? 'provider-estimate' : 'provider-reported',
      })).filter(row => row.title && row.dailyCollection !== null && row.dailyCollection >= 0),
    };
  });
}

function validHistoryDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && dateOnly(date) === date;
}

function chooseHistoryEntry(entries, date, startKey, endKey) {
  const onDate = entries.find(entry => entry[startKey] <= date && date <= entry[endKey]);
  if (onDate) return onDate;
  return entries.filter(entry => entry[endKey] < date).at(-1) || null;
}

function normalizeHistoryChartRows(rows, sourceUrl, period) {
  return rows.map((row, index) => {
    const rawAmount = row.gross ?? row.total ?? row.worldwide ?? row.domestic;
    const rawCumulative = row.toDate ?? (period === 'yearly' ? null : row.total);
    const amount = finiteAmount(rawAmount);
    const cumulative = finiteAmount(rawCumulative);
    return {
      rank: row.rank ?? index + 1,
      title: row.title,
      releaseYear: row.year ?? null,
      releaseDate: row.releaseDate || row.openDate || null,
      releaseLabel: row.release || null,
      dailyCollection: amount,
      cumulativeCollection: cumulative,
      currency: 'USD',
      source: HISTORY_PROVIDER,
      sourceUrl,
      sourceId: row.id || null,
      collectionType: period === 'alltime' ? 'worldwide_gross' : 'gross',
      isEstimate: row.estimated === true,
      verificationStatus: row.estimated === true ? 'provider-estimate' : 'provider-reported',
    };
  }).filter(row => row.title && row.dailyCollection !== null && row.dailyCollection >= 0);
}

function historyChartError(code, message, status = 404) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export async function getBoxOfficeHistoryMeta() {
  const [meta, days] = await Promise.all([
    fetchHistoryJson('history:meta', 'meta.json'),
    fetchHistoryJson('history:index:days', 'index/days.json'),
  ]);
  if (!Array.isArray(days) || !meta?.builtAt) {
    throw historyChartError('history_meta_unavailable', 'Box Office History metadata is unavailable.', 502);
  }
  return {
    source: HISTORY_PROVIDER,
    sourceUrl: `${BOX_OFFICE_HISTORY_API}/meta.json`,
    builtAt: meta.builtAt,
    counts: {
      movies: meta.movies,
      days: meta.days,
      weekends: meta.weekends,
      weeks: meta.weeks,
      internationalPlaces: meta.intl?.places,
    },
    latestDailyDate: days.at(-1)?.d || null,
    latestWeekendDate: meta.lastWeekend || null,
  };
}

export async function getBoxOfficeHistoryInternationalCountries() {
  const data = await fetchHistoryJson('history:intl:index', 'intl/index.json');
  if (!Array.isArray(data)) {
    throw historyChartError('history_countries_unavailable', 'International market index is unavailable.', 502);
  }
  return data
    .filter(country => country.code !== 'IN' && country.code !== 'US'
      && (country.weekends > 0 || country.years > 0 || country.alltime))
    .map(country => ({
      code: country.code,
      name: country.name,
      weekends: country.weekends,
      years: country.years,
      alltime: country.alltime === true,
      firstDate: country.first || null,
      latestDate: country.last || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getBoxOfficeHistoryChart({ market, period, date, countryCode }) {
  if (!validHistoryDate(date)) {
    throw historyChartError('invalid_date', 'A valid date in YYYY-MM-DD format is required.', 400);
  }

  return withInFlight(`history-chart:${market}:${period}:${countryCode || ''}:${date}`, async () => {
    let path;
    let selectedDate = date;
    let chartMarket = market;
    let territory = 'US';
    let countryName = null;
    let year = Number(date.slice(0, 4));
    let coverage;

    if (market === 'us') {
      if (period === 'daily') {
        const index = await fetchHistoryJson('history:index:days', 'index/days.json');
        const entry = index.find(item => item.d === date) || index.filter(item => item.d < date).at(-1);
        if (!entry) throw historyChartError('history_chart_unavailable', 'No US daily chart is available on or before that date.');
        selectedDate = entry.d;
        path = `days/${entry.d}.json`;
        coverage = `US domestic daily gross for ${selectedDate}.`;
      } else if (period === 'weekend' || period === 'weekly') {
        const indexPath = period === 'weekend' ? 'index/weekends.json' : 'index/weeks.json';
        const indexKey = period === 'weekend' ? 'weekends' : 'weeks';
        const index = await fetchHistoryJson(`history:index:${indexKey}`, indexPath);
        const entry = chooseHistoryEntry(index, date, 's', 'e');
        if (!entry) throw historyChartError('history_chart_unavailable', `No US ${period} chart is available on or before that date.`);
        selectedDate = entry.s;
        year = entry.y || Number(entry.s.slice(0, 4));
        path = `${indexKey}/${entry.k}.json`;
        coverage = `US domestic ${period} gross for ${entry.s} through ${entry.e}.`;
      } else if (period === 'yearly') {
        path = `years/${year}.json`;
        coverage = `US domestic annual gross chart for ${year}; the current year may be incomplete.`;
      } else {
        throw historyChartError('invalid_history_period', 'US market supports daily, weekend, weekly, or yearly charts.', 400);
      }
    } else if (market === 'international') {
      if (!/^[A-Z0-9]{2,3}$/.test(countryCode || '')) {
        throw historyChartError('invalid_country', 'A valid international market code is required.', 400);
      }
      const country = await fetchHistoryJson(`history:intl:${countryCode}`, `intl/${countryCode}/index.json`);
      if (country.code !== countryCode) {
        throw historyChartError('history_country_unavailable', 'The selected international market is unavailable.');
      }
      territory = countryCode;
      countryName = country.name;
      if (period === 'weekend') {
        const entry = chooseHistoryEntry(country.weekends || [], date, 's', 'e');
        if (!entry) throw historyChartError('history_chart_unavailable', `No ${countryName} weekend chart is available on or before that date.`);
        selectedDate = entry.s;
        path = `intl/${countryCode}/weekends/${entry.k}.json`;
        coverage = `${countryName} reported weekend gross for ${entry.s} through ${entry.e}; values are in USD.`;
      } else if (period === 'yearly') {
        const yearEntry = (country.years || []).find(item => Number(item.y) === year);
        if (!yearEntry) throw historyChartError('history_chart_unavailable', `No ${countryName} annual chart is available for ${year}.`);
        path = `intl/${countryCode}/years/${year}.json`;
        coverage = `${countryName} reported annual gross for ${year}; values are in USD.`;
      } else if (period === 'alltime') {
        if (country.alltime !== true) {
          throw historyChartError('history_chart_unavailable', `No all-time ${countryName} chart is available.`);
        }
        path = `intl/${countryCode}/alltime.json`;
        coverage = `${countryName} all-time chart as published by the provider; values are in USD.`;
      } else {
        throw historyChartError('invalid_history_period', 'International markets support weekend, yearly, or all-time charts.', 400);
      }
    } else if (market === 'worldwide' && period === 'alltime') {
      chartMarket = 'worldwide';
      territory = 'WW';
      path = 'alltime/worldwide.json';
      coverage = 'Historical worldwide gross snapshot as of October 2019; not a current lifetime chart.';
    } else {
      throw historyChartError('invalid_market', 'Supported history markets are US, international, and worldwide archive.', 400);
    }

    const data = await fetchHistoryJson(`history:chart:${market}:${countryCode || ''}:${path}`, path);
    if (!Array.isArray(data.rows)) {
      throw historyChartError('history_chart_unavailable', 'The provider has no chart for this market and period.');
    }
    if (data.start) selectedDate = data.start;
    return {
      market: chartMarket,
      territory,
      country: countryName,
      period,
      date: selectedDate,
      startDate: data.start || selectedDate,
      endDate: data.end || selectedDate,
      year: data.year || year,
      asOf: data.asOf || null,
      currency: 'USD',
      source: HISTORY_PROVIDER,
      sourceUrl: `${BOX_OFFICE_HISTORY_API}/${path}`,
      providerSources: Array.isArray(data.sources) ? data.sources : [],
      coverage,
      rows: normalizeHistoryChartRows(data.rows, `${BOX_OFFICE_HISTORY_API}/${path}`, period),
    };
  });
}

export async function getBoxOfficeHistoryMovie(tmdbId) {
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
    const error = new Error('A positive TMDB ID is required.');
    error.status = 400;
    error.code = 'invalid_tmdb_id';
    throw error;
  }
  return withInFlight(`history-movie:${tmdbId}`, async () => {
    const lookup = await fetchHistoryJson(`history:tmdb:${tmdbId}`, `lookup/tmdb/${tmdbId}.json`);
    if (!lookup?.id || !/^[a-z0-9-]{1,120}$/i.test(lookup.id)) {
      const error = new Error('No Box Office History match is available for this TMDB movie.');
      error.status = 404;
      error.code = 'history_movie_unavailable';
      throw error;
    }
    const movie = await fetchHistoryJson(`history:movie:${lookup.id}`, `movies/${encodeURIComponent(lookup.id)}.json`);
    if (![movie.daily, movie.weekends, movie.weeks].some(Array.isArray) && !movie.intl) {
      throw historyChartError('history_movie_unavailable', 'Box Office History has no chart history for this movie.');
    }
    const sourceUrl = `${BOX_OFFICE_HISTORY_API}/movies/${encodeURIComponent(lookup.id)}.json`;
    const mapMovieRows = (rows, amountField = 'gross') => (Array.isArray(rows) ? rows : [])
      .map(row => ({
        date: row.date || row.start || null,
        label: row.label || null,
        week: row.week ?? null,
        gross: finiteAmount(row[amountField]),
        cumulativeGross: finiteAmount(row.toDate),
        currency: 'USD',
        source: HISTORY_PROVIDER,
        sourceUrl,
        isEstimate: row.estimated === true,
        verificationStatus: row.estimated === true ? 'provider-estimate' : 'provider-reported',
      }))
      .filter(row => row.date && row.gross !== null && row.gross >= 0);
    const international = (movie.intl?.countries || []).map(country => ({
      code: country.code,
      name: country.country,
      gross: finiteAmount(country.total),
      openingGross: finiteAmount(country.opening),
      releaseDate: country.releaseDate || null,
      asOf: country.asOf || null,
      currency: 'USD',
      source: HISTORY_PROVIDER,
      sourceUrl,
    }));
    return {
      tmdbId,
      title: movie.title || lookup.title,
      year: movie.year || lookup.year,
      market: 'US',
      territory: 'US',
      currency: 'USD',
      source: HISTORY_PROVIDER,
      sourceUrl,
      lifetimeDomesticGross: finiteAmount(movie.domestic ?? lookup.domestic),
      lifetimeInternationalGross: finiteAmount(movie.foreign),
      lifetimeWorldwideGross: finiteAmount(movie.worldwide ?? lookup.worldwide),
      daily: mapMovieRows(movie.daily),
      weekends: mapMovieRows(movie.weekends),
      weeks: mapMovieRows(movie.weeks),
      international,
    };
  });
}

export async function getBoxOfficeHistoryRecords() {
  const data = await fetchHistoryJson('history:records', 'records.json');
  return {
    source: HISTORY_PROVIDER,
    sourceUrl: `${BOX_OFFICE_HISTORY_API}/records.json`,
    coverage: 'US domestic opening-weekend records from the provider archive.',
    data,
  };
}

export async function getIndianReportsForDate(date, language, requestedPage = 1, requestedLimit = 50) {
  let selectedDate = date;
  if (!selectedDate) {
    const latest = await BoxOfficeDaily.findOne({ expiresAt: { $gt: new Date() } })
      .sort({ reportDate: -1 })
      .select('reportDate')
      .lean();
    selectedDate = latest?.reportDate ? latest.reportDate.toISOString().slice(0, 10) : null;
  }
  if (!selectedDate) return { date: null, reports: [], total: 0, page: 1, limit: 50 };
  const query = {
    reportDate: reportDateValue(selectedDate),
    expiresAt: { $gt: new Date() },
  };
  if (language && language !== 'all') query.originalLanguage = language;

  const page = requestedPage;
  const limit = requestedLimit;
  const [reports, total] = await Promise.all([
    BoxOfficeDaily.find(query)
      .sort({ dailyCollection: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BoxOfficeDaily.countDocuments(query),
  ]);
  return { date: selectedDate, reports, total, page, limit };
}

export function getReportDateRange(period, date) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || dateOnly(parsed) !== date) {
    const error = new Error('A valid date in YYYY-MM-DD format is required.');
    error.status = 400;
    error.code = 'invalid_date';
    throw error;
  }
  const start = new Date(parsed);
  const end = new Date(parsed);
  if (period === 'weekly') {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 7);
  } else if (period === 'monthly') {
    start.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1, 1);
  } else {
    end.setUTCDate(end.getUTCDate() + 1);
  }
  return { start, end };
}

export async function getIndianReportsInRange(start, end, language) {
  const query = {
    reportDate: { $gte: start, $lt: end },
    expiresAt: { $gt: new Date() },
  };
  if (language && language !== 'all') query.originalLanguage = language;
  return BoxOfficeDaily.find(query)
    .sort({ reportDate: 1, dailyCollection: -1 })
    .limit(1000)
    .lean();
}

export async function getLatestLifetimeReports(collectionType, date) {
  const query = {
    expiresAt: { $gt: new Date() },
  };
  if (collectionType) query.collectionType = collectionType;
  if (date) {
    const start = reportDateValue(date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    query.reportDate = { $gte: start, $lt: end };
  }
  return BoxOfficeLifetime.find(query)
    .sort({ amount: -1, reportedAt: -1 })
    .limit(100)
    .lean();
}

export async function getLatestLifetimeReportsPage(collectionType, date, language, page, limit) {
  const query = { expiresAt: { $gt: new Date() } };
  if (collectionType) query.collectionType = collectionType;
  if (language && language !== 'all') query.originalLanguage = language;
  if (date) {
    const start = reportDateValue(date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    query.reportDate = { $gte: start, $lt: end };
  }
  const [reports, total] = await Promise.all([
    BoxOfficeLifetime.find(query)
      .sort({ amount: -1, reportedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BoxOfficeLifetime.countDocuments(query),
  ]);
  return { reports, total, page, limit };
}

async function loadMovieBoxOfficeReports(tmdbId, sourceMovieKey = null) {
  const hasTmdb = Number.isSafeInteger(tmdbId) && tmdbId > 0;
  const hasKey = Boolean(sourceMovieKey);
  if (!hasTmdb && !hasKey) return { lifetimeReports: [], dailyReports: [] };

  const query = { expiresAt: { $gt: new Date() } };
  const keyFilter = hasKey ? sourceMovieKeyFilter(sourceMovieKey) : null;
  if (hasTmdb && keyFilter) {
    query.$or = [{ tmdbId }, { sourceMovieKey: keyFilter }];
  } else if (hasTmdb) {
    query.tmdbId = tmdbId;
  } else if (keyFilter) {
    query.sourceMovieKey = keyFilter;
  }

  const [lifetimeReports, dailyReports] = await Promise.all([
    BoxOfficeLifetime.find(query)
      .sort({ reportedAt: -1 })
      .limit(40)
      .lean(),
    BoxOfficeDaily.find(query)
      .sort({ reportDate: 1, dayNumber: 1, reportedAt: 1 })
      .limit(400)
      .lean(),
  ]);
  return { lifetimeReports, dailyReports };
}

function shouldRefreshMovieDaywise(dailyReports = [], sourceMovieKey = null) {
  if (!sourceMovieKey) return false;
  if (!dailyReports.length) return true;
  const maxDay = Math.max(0, ...dailyReports.map(report => Number(report.dayNumber) || 0));
  if (maxDay > dailyReports.length + 2) return true;
  const uniqueDates = new Set(dailyReports.map(report => report.reportDate?.toISOString?.()?.slice(0, 10) || String(report.reportDate)));
  return uniqueDates.size < Math.max(3, Math.min(maxDay, 10));
}

export async function getMovieBoxOfficeReports(tmdbId, sourceMovieKey = null, { refreshDaywise = true } = {}) {
  const hasTmdb = Number.isSafeInteger(tmdbId) && tmdbId > 0;
  const hasKey = Boolean(sourceMovieKey);
  if (!hasTmdb && !hasKey) return null;

  let { lifetimeReports, dailyReports } = await loadMovieBoxOfficeReports(tmdbId, sourceMovieKey);

  if (refreshDaywise && shouldRefreshMovieDaywise(dailyReports, sourceMovieKey)) {
    try {
      const seed = lifetimeReports[0] || dailyReports[0] || {};
      await syncMovieDaywiseFromSource(sourceMovieKey, {
        movieTitle: seed.movieTitle || null,
        tmdbId: seed.tmdbId ?? (hasTmdb ? tmdbId : null),
        posterPath: seed.posterPath || null,
        releaseDate: seed.releaseDate || null,
        releaseYear: seed.releaseYear || null,
        originalLanguage: seed.originalLanguage || null,
      });
      ({ lifetimeReports, dailyReports } = await loadMovieBoxOfficeReports(tmdbId, sourceMovieKey));
    } catch (error) {
      console.warn(`[Box Office] On-demand day-wise sync failed for ${sourceMovieKey}:`, error.message);
    }
  }

  if (!lifetimeReports.length && !dailyReports.length) return null;

  const uniqueDaily = [];
  const dailyByDate = new Map();
  for (const report of dailyReports) {
    const dateKey = report.reportDate?.toISOString?.()?.slice(0, 10) || String(report.reportDate);
    const existing = dailyByDate.get(dateKey);
    const prefer = !existing
      || (Number(report.dayNumber) || 0) > (Number(existing.dayNumber) || 0)
      || ((Number(report.dayNumber) || 0) === (Number(existing.dayNumber) || 0)
        && new Date(report.reportedAt) > new Date(existing.reportedAt));
    if (prefer) dailyByDate.set(dateKey, report);
  }
  uniqueDaily.push(...[...dailyByDate.values()].sort((a, b) => {
    const dayDiff = (Number(a.dayNumber) || 0) - (Number(b.dayNumber) || 0);
    if (dayDiff) return dayDiff;
    return new Date(a.reportDate) - new Date(b.reportDate);
  }));

  const title = lifetimeReports[0]?.movieTitle || uniqueDaily[0]?.movieTitle;
  const resolvedTmdbId = lifetimeReports[0]?.tmdbId || uniqueDaily[0]?.tmdbId || tmdbId || null;
  const resolvedKey = lifetimeReports[0]?.sourceMovieKey || uniqueDaily[0]?.sourceMovieKey || sourceMovieKey || null;
  const latestByType = new Map();
  for (const report of lifetimeReports) {
    const existing = latestByType.get(report.collectionType);
    if (!existing || (report.amount || 0) >= (existing.amount || 0)) {
      latestByType.set(report.collectionType, report);
    }
  }
  const indiaNet = latestByType.get('india_nett');
  const worldwideGross = latestByType.get('worldwide_gross');
  return {
    tmdbId: resolvedTmdbId,
    sourceMovieKey: resolvedKey,
    title,
    reports: lifetimeReports.map(report => ({
      collectionType: report.collectionType,
      amount: report.amount,
      sourceReportedValue: report.sourceReportedValue,
      currency: report.currency,
      source: report.source,
      sourceUrl: report.sourceUrl,
      reportedAt: report.reportedAt,
      isEstimate: report.isEstimate,
      verificationStatus: report.verificationStatus,
    })),
    indiaNet: indiaNet ? {
      value: indiaNet.amount,
      currency: indiaNet.currency,
      source: indiaNet.source,
      sourceUrl: indiaNet.sourceUrl,
      lastUpdated: indiaNet.reportedAt,
    } : null,
    worldwideGross: worldwideGross ? {
      value: worldwideGross.amount,
      currency: worldwideGross.currency,
      source: worldwideGross.source,
      sourceUrl: worldwideGross.sourceUrl,
      lastUpdated: worldwideGross.reportedAt,
    } : null,
    daywiseCollection: uniqueDaily.length ? {
      value: uniqueDaily.map(report => ({
        day: report.dayNumber ?? null,
        date: report.reportDate.toISOString().slice(0, 10),
        amount: report.dailyCollection,
        cumulativeAmount: report.cumulativeCollection,
        sourceReportedValue: report.sourceReportedValue,
        sourceReportedCumulativeValue: report.sourceReportedCumulativeValue,
        currency: report.currency,
        source: report.source,
        sourceUrl: report.sourceUrl,
        isEstimate: report.isEstimate,
      })),
      source: uniqueDaily[0].source,
      sourceUrl: uniqueDaily[0].sourceUrl,
      lastUpdated: uniqueDaily[uniqueDaily.length - 1].reportedAt,
    } : null,
    lifetimeReports,
    dailyReports: uniqueDaily,
    coverage: 'Only source-reported records are returned; missing days are not filled. India nett is day-wise when reported; gross is the latest worldwide total when available.',
  };
}

function isNonIndianReport(report) {
  const language = String(report.originalLanguage || '').toLowerCase();
  if (language === 'en') return true;
  const title = String(report.movieTitle || '');
  return /\b(godzilla|hunger games|insidious|christmas carol|how to rob)\b/i.test(title);
}

const MONTHS = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function parseIndianDisplayDate(value) {
  const text = decodeXml(value).replace(/\s+/g, ' ').trim();
  const match = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2].toLowerCase()];
  const year = Number(match[3]);
  if (!Number.isInteger(day) || month == null || !Number.isInteger(year)) return null;
  const date = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function parseIndianMovieDaywiseHtml(html, {
  sourceMovieKey,
  movieTitle = null,
  reportedAt = new Date(),
} = {}) {
  if (typeof html !== 'string' || html.length > MAX_HTML_BYTES) {
    throw new Error('Indian movie day-wise HTML is missing or exceeds the size limit.');
  }
  if (!sourceMovieKey) throw new Error('sourceMovieKey is required for movie day-wise parsing.');

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const resolvedTitle = movieTitle
    || decodeXml(titleMatch?.[1] || '')
      .replace(/\s+box office[\s\S]*$/i, '')
      .trim()
    || sourceMovieKey;

  const table = (html.match(/<table[\s\S]*?<\/table>/i) || [])[0] || '';
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const dailyReports = [];
  let runningNett = 0;
  let runningWorldwide = 0;

  for (const rowMatch of rows) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => decodeXml(match[1]));
    if (cells.length < 3) continue;
    const dayMatch = cells[0].match(/Day\s*(\d+)/i);
    if (!dayMatch) continue;
    const reportDate = parseIndianDisplayDate(cells[1]);
    const nett = parseCroreCell(cells[2]);
    const worldwide = cells[3] ? parseCroreCell(cells[3]) : null;
    if (!reportDate || nett?.amount == null) continue;

    runningNett += nett.amount;
    if (worldwide?.amount) runningWorldwide = Math.max(runningWorldwide, worldwide.amount);

    dailyReports.push({
      movieTitle: resolvedTitle,
      sourceMovieKey,
      reportDate,
      dayNumber: Number(dayMatch[1]),
      dailyCollection: nett.amount,
      cumulativeCollection: runningNett,
      worldwideDailyCollection: worldwide?.amount ?? null,
      sourceReportedValue: nett.reported,
      sourceReportedCumulativeValue: `₹${(runningNett / CRORE_INR).toFixed(2)} Cr`,
      reportedAt,
      sourceUrl: `https://indian-boxoffice.com/movies/${sourceMovieKey}/`,
    });
  }

  const lifetimeReports = [];
  if (runningNett > 0) {
    lifetimeReports.push({
      movieTitle: resolvedTitle,
      sourceMovieKey,
      collectionType: 'india_nett',
      market: 'india',
      territory: 'IN',
      amount: runningNett,
      sourceReportedValue: `₹${(runningNett / CRORE_INR).toFixed(2)} Cr`,
      reportDate: dailyReports.at(-1)?.reportDate || dateOnly(reportedAt),
      reportedAt,
      sourceUrl: `https://indian-boxoffice.com/movies/${sourceMovieKey}/`,
    });
  }
  if (runningWorldwide > 0) {
    lifetimeReports.push({
      movieTitle: resolvedTitle,
      sourceMovieKey,
      collectionType: 'worldwide_gross',
      market: 'worldwide',
      territory: 'WW',
      amount: runningWorldwide,
      sourceReportedValue: `₹${(runningWorldwide / CRORE_INR).toFixed(2)} Cr`,
      reportDate: dailyReports.at(-1)?.reportDate || dateOnly(reportedAt),
      reportedAt,
      sourceUrl: `https://indian-boxoffice.com/movies/${sourceMovieKey}/`,
    });
  }

  return {
    movieTitle: resolvedTitle,
    sourceMovieKey,
    dailyReports,
    lifetimeReports,
  };
}

function normalizeIndiaMovieKey(sourceMovieKey) {
  return String(sourceMovieKey || '')
    .replace(/^\/?movies\//i, '')
    .replace(/\/+$/, '')
    .trim();
}

function isValidIndiaMovieKey(key) {
  return Boolean(key)
    && key.length >= 3
    && key.length <= 120
    && /^[a-z0-9][a-z0-9_-]*$/i.test(key)
    && !/^(hi|en|ta|te|ml|kn|all|index)$/i.test(key);
}

async function resolveCanonicalIndiaMovieKey(sourceMovieKey) {
  const key = normalizeIndiaMovieKey(sourceMovieKey);
  if (!isValidIndiaMovieKey(key)) {
    throw new Error('Invalid Indian Box Office movie key.');
  }
  try {
    const html = await fetchIndianDailyChart();
    const paths = [...html.matchAll(/href="(\/movies\/[^"]+)"/gi)].map(match => match[1]);
    const exact = paths.find(path => normalizeIndiaMovieKey(path) === key);
    if (exact) return normalizeIndiaMovieKey(exact);
    const insensitive = paths.find(path => normalizeIndiaMovieKey(path).toLowerCase() === key.toLowerCase());
    if (insensitive) return normalizeIndiaMovieKey(insensitive);
  } catch (error) {
    console.warn('[Box Office] Could not resolve movie slug from daily chart:', error.message);
  }
  return key;
}

async function fetchIndianMoviePage(sourceMovieKey) {
  let key = normalizeIndiaMovieKey(sourceMovieKey);
  if (!isValidIndiaMovieKey(key)) {
    throw new Error('Invalid Indian Box Office movie key.');
  }
  try {
    return await fetchIndianText(`https://indian-boxoffice.com/movies/${encodeURIComponent(key)}/`, {
      accept: 'text/html,application/xhtml+xml',
      maxBytes: MAX_HTML_BYTES,
    });
  } catch (error) {
    if (error.response?.status !== 404) throw error;
    const resolved = await resolveCanonicalIndiaMovieKey(key);
    if (resolved === key) throw error;
    key = resolved;
    return fetchIndianText(`https://indian-boxoffice.com/movies/${encodeURIComponent(key)}/`, {
      accept: 'text/html,application/xhtml+xml',
      maxBytes: MAX_HTML_BYTES,
    });
  }
}

export async function syncMovieDaywiseFromSource(sourceMovieKey, meta = {}) {
  const key = normalizeIndiaMovieKey(sourceMovieKey);
  if (!isValidIndiaMovieKey(key)) return { dailyReports: 0, lifetimeReports: 0, skipped: true };

  const parsed = parseIndianMovieDaywiseHtml(await fetchIndianMoviePage(key), {
    sourceMovieKey: key,
    movieTitle: meta.movieTitle || null,
    reportedAt: new Date(),
  });
  if (!parsed.dailyReports.length) {
    return { dailyReports: 0, lifetimeReports: 0, movieTitle: parsed.movieTitle, sourceMovieKey: key };
  }

  const expiresAt = reportTtlDate();
  const daily = parsed.dailyReports.map(report => ({
    reportKey: reportIdentity(INDIA_PROVIDER, key, 'india_nett', report.reportDate),
    tmdbId: meta.tmdbId ?? null,
    movieTitle: report.movieTitle,
    originalTitle: meta.originalTitle || null,
    posterPath: meta.posterPath || null,
    releaseDate: meta.releaseDate || null,
    releaseYear: meta.releaseYear || null,
    originalLanguage: meta.originalLanguage || null,
    reportDate: reportDateValue(report.reportDate),
    market: 'india',
    territory: 'IN',
    collectionType: 'india_nett',
    dailyCollection: report.dailyCollection,
    cumulativeCollection: report.cumulativeCollection,
    sourceReportedValue: report.sourceReportedValue,
    sourceReportedCumulativeValue: report.sourceReportedCumulativeValue,
    currency: 'INR',
    rank: null,
    dayNumber: report.dayNumber,
    source: INDIA_PROVIDER,
    sourceMovieKey: key,
    sourceUrl: report.sourceUrl,
    reportedAt: report.reportedAt,
    isEstimate: true,
    verificationStatus: 'publisher-consensus-estimate',
    expiresAt,
  }));

  const lifetime = parsed.lifetimeReports.map(report => ({
    reportKey: reportIdentity(INDIA_PROVIDER, key, report.collectionType, 'latest'),
    tmdbId: meta.tmdbId ?? null,
    movieTitle: report.movieTitle,
    originalTitle: meta.originalTitle || null,
    posterPath: meta.posterPath || null,
    releaseDate: meta.releaseDate || null,
    releaseYear: meta.releaseYear || null,
    originalLanguage: meta.originalLanguage || null,
    reportDate: reportDateValue(report.reportDate),
    market: report.market,
    territory: report.territory,
    collectionType: report.collectionType,
    amount: report.amount,
    sourceReportedValue: report.sourceReportedValue,
    currency: 'INR',
    source: INDIA_PROVIDER,
    sourceMovieKey: key,
    sourceUrl: report.sourceUrl,
    reportedAt: report.reportedAt,
    isEstimate: true,
    verificationStatus: 'publisher-consensus-estimate',
    expiresAt,
  }));

  const [dailyCount, lifetimeCount] = await Promise.all([
    upsertReportBatch(BoxOfficeDaily, daily, 'daily'),
    upsertReportBatch(BoxOfficeLifetime, lifetime, 'lifetime'),
  ]);

  return {
    dailyReports: dailyCount,
    lifetimeReports: lifetimeCount,
    daysParsed: parsed.dailyReports.length,
    movieTitle: parsed.movieTitle,
    sourceMovieKey: key,
  };
}

async function syncDaywiseForChartMovies(chartMovies = []) {
  const unique = [];
  const seen = new Set();
  for (const movie of chartMovies) {
    const key = normalizeIndiaMovieKey(movie.sourceMovieKey);
    if (!isValidIndiaMovieKey(key) || seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...movie, sourceMovieKey: key });
  }

  const selected = unique.slice(0, Math.min(40, unique.length));
  let synced = 0;
  for (let index = 0; index < selected.length; index += 4) {
    const batch = selected.slice(index, index + 4);
    const results = await Promise.allSettled(
      batch.map(movie => syncMovieDaywiseFromSource(movie.sourceMovieKey, {
        movieTitle: movie.movieTitle || movie.title,
        tmdbId: movie.tmdbId ?? null,
        posterPath: movie.posterPath || null,
        releaseDate: movie.releaseDate || null,
        releaseYear: movie.releaseYear || null,
        originalLanguage: movie.originalLanguage || null,
      }))
    );
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.daysParsed > 0) synced += 1;
      if (result.status === 'rejected') {
        console.warn('[Box Office] Movie day-wise sync failed:', result.reason.message);
      }
    }
  }
  return synced;
}

export async function getYearlyBoxOfficeReports(year, { page = 1, limit = 50, language } = {}) {
  const selectedYear = Number(year);
  const yearStart = reportDateValue(`${selectedYear}-01-01`);
  const yearEnd = reportDateValue(`${selectedYear + 1}-01-01`);
  const indiaQuery = {
    expiresAt: { $gt: new Date() },
    $or: [
      { releaseYear: selectedYear },
      { reportDate: { $gte: yearStart, $lt: yearEnd } },
    ],
  };
  if (language && language !== 'all') indiaQuery.originalLanguage = language;

  const indiaRows = await BoxOfficeLifetime.find(indiaQuery)
    .sort({ amount: -1, reportedAt: -1 })
    .limit(500)
    .lean();

  const indiaByKey = new Map();
  for (const report of indiaRows) {
    const key = `${report.collectionType}:${report.tmdbId || report.sourceMovieKey}`;
    if (!indiaByKey.has(key)) indiaByKey.set(key, report);
  }
  const indiaReports = [...indiaByKey.values()];

  let usReports = [];
  try {
    const usYearly = await getBoxOfficeHistoryChart({
      market: 'us',
      period: 'yearly',
      date: `${selectedYear}-12-31`,
    });
    usReports = (usYearly.rows || []).map((row, index) => ({
      reportKey: `${HISTORY_PROVIDER}:us-yearly:${selectedYear}:${row.sourceId || row.title || index}`,
      tmdbId: row.tmdbId || null,
      movieTitle: row.title || row.movieTitle,
      originalTitle: null,
      posterPath: null,
      releaseDate: row.releaseDate || null,
      releaseYear: row.releaseYear || selectedYear,
      originalLanguage: 'en',
      reportDate: reportDateValue(`${selectedYear}-12-31`),
      market: 'us',
      territory: 'US',
      collectionType: 'domestic_gross',
      amount: row.dailyCollection ?? row.amount ?? null,
      sourceReportedValue: row.dailyCollection != null
        ? `$${Number(row.dailyCollection).toLocaleString('en-US')}`
        : null,
      currency: 'USD',
      source: HISTORY_PROVIDER,
      sourceMovieKey: row.sourceId || `us-${selectedYear}-${index + 1}`,
      sourceUrl: row.sourceUrl || usYearly.sourceUrl,
      reportedAt: new Date(),
      isEstimate: row.isEstimate === true,
      verificationStatus: row.verificationStatus || 'provider-reported',
      expiresAt: reportTtlDate(),
    })).filter(report => report.movieTitle && report.amount != null);
  } catch (error) {
    console.warn(`[Box Office] US yearly chart unavailable for ${selectedYear}:`, error.code || error.message);
  }

  const combined = [...indiaReports, ...usReports]
    .sort((left, right) => {
      if (left.currency === right.currency) return (right.amount || 0) - (left.amount || 0);
      if (left.currency === 'INR' && right.currency !== 'INR') return -1;
      if (right.currency === 'INR' && left.currency !== 'INR') return 1;
      return (right.amount || 0) - (left.amount || 0);
    });

  const total = combined.length;
  const start = (page - 1) * limit;
  return {
    year: selectedYear,
    reports: combined.slice(start, start + limit),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    coverage: usReports.length
      ? `India lifetime reports for ${selectedYear} plus US domestic yearly gross from Box Office History.`
      : `Partial India lifetime reports for ${selectedYear}; US domestic yearly chart was unavailable.`,
  };
}

export async function getIndiaBoxOfficeBoard({ year, date, language } = {}) {
  const selectedYear = Number(year) || new Date().getUTCFullYear();
  const dailyBundle = await getIndianReportsForDate(date, language === 'all' ? undefined : language, 1, 100);
  const selectedDate = dailyBundle.date;

  const yearStart = reportDateValue(`${selectedYear}-01-01`);
  const yearEnd = reportDateValue(`${selectedYear + 1}-01-01`);
  const lifetimeQuery = {
    collectionType: 'india_nett',
    expiresAt: { $gt: new Date() },
    $or: [
      { releaseYear: selectedYear },
      { reportDate: { $gte: yearStart, $lt: yearEnd } },
    ],
  };
  if (language && language !== 'all') lifetimeQuery.originalLanguage = language;

  const lifetimeRows = await BoxOfficeLifetime.find(lifetimeQuery)
    .sort({ amount: -1, reportedAt: -1 })
    .limit(300)
    .lean();

  const topperMap = new Map();
  for (const report of lifetimeRows) {
    const key = report.tmdbId ? `tmdb:${report.tmdbId}` : report.sourceMovieKey;
    if (!topperMap.has(key)) topperMap.set(key, report);
  }
  const yearToppers = [...topperMap.values()]
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 15)
    .map((report, index) => ({
      rank: index + 1,
      tmdbId: report.tmdbId,
      sourceMovieKey: report.sourceMovieKey,
      movieTitle: report.movieTitle,
      posterPath: report.posterPath,
      originalLanguage: report.originalLanguage,
      releaseYear: report.releaseYear,
      releaseDate: report.releaseDate,
      amount: report.amount,
      currency: report.currency || 'INR',
      sourceReportedValue: report.sourceReportedValue,
      source: report.source,
      sourceUrl: report.sourceUrl,
      isEstimate: report.isEstimate,
      verificationStatus: report.verificationStatus,
    }));

  const latestPlaying = (dailyBundle.reports || []).map((report, index) => ({
    rank: report.rank ?? index + 1,
    dayNumber: report.dayNumber ?? null,
    tmdbId: report.tmdbId,
    sourceMovieKey: report.sourceMovieKey,
    movieTitle: report.movieTitle,
    posterPath: report.posterPath,
    originalLanguage: report.originalLanguage,
    releaseDate: report.releaseDate,
    releaseYear: report.releaseYear,
    dailyCollection: report.dailyCollection,
    cumulativeCollection: report.cumulativeCollection,
    currency: report.currency || 'INR',
    sourceReportedValue: report.sourceReportedValue,
    sourceReportedCumulativeValue: report.sourceReportedCumulativeValue,
    source: report.source,
    sourceUrl: report.sourceUrl,
    isEstimate: report.isEstimate,
    verificationStatus: report.verificationStatus,
    reportDate: report.reportDate,
  }));

  const nonIndianFromChart = latestPlaying.filter(isNonIndianReport);

  let nonIndianDomestic = [];
  let nonIndianCoverage = 'Non-Indian titles from the India chart, with domestic-region totals when available.';
  let usYearlyRows = [];
  try {
    const usYearly = await getBoxOfficeHistoryChart({
      market: 'us',
      period: 'yearly',
      date: `${selectedYear}-12-31`,
    });
    usYearlyRows = usYearly.rows || [];
    nonIndianDomestic = usYearlyRows.slice(0, 25).map((row, index) => ({
      rank: row.rank || index + 1,
      tmdbId: row.tmdbId || null,
      sourceId: row.sourceId || null,
      movieTitle: row.title || row.movieTitle,
      releaseLabel: row.releaseLabel || row.releaseYear || selectedYear,
      amount: row.dailyCollection ?? row.cumulativeCollection ?? row.gross ?? row.amount ?? null,
      currency: row.currency || 'USD',
      market: 'US domestic',
      source: usYearly.source || HISTORY_PROVIDER,
      sourceUrl: row.sourceUrl || usYearly.sourceUrl,
      isEstimate: row.isEstimate === true,
      verificationStatus: row.verificationStatus || 'provider-reported',
    })).filter(row => row.movieTitle && Number.isFinite(Number(row.amount)));
    nonIndianCoverage = `${usYearly.coverage} Source: https://www.boxofficehistory.com/api/v1/`;
  } catch (error) {
    nonIndianDomestic = nonIndianFromChart.map(row => ({
      ...row,
      amount: row.cumulativeCollection || row.dailyCollection,
      market: 'Playing in India (domestic total unavailable)',
    }));
    nonIndianCoverage = `US domestic yearly chart unavailable (${error.code || error.message}). Showing non-Indian titles currently reported on the India chart only.`;
  }

  let yearTopperCoverage = `Highest India nett totals reported for ${selectedYear} releases/reports. Publisher consensus estimates.`;
  if (!yearToppers.length && usYearlyRows.length) {
    yearToppers.push(...usYearlyRows.slice(0, 15).map((row, index) => ({
      rank: row.rank || index + 1,
      tmdbId: row.tmdbId || null,
      sourceMovieKey: row.sourceId || null,
      movieTitle: row.title || row.movieTitle,
      posterPath: null,
      originalLanguage: 'en',
      releaseYear: row.releaseYear || selectedYear,
      releaseDate: row.releaseDate || null,
      amount: row.dailyCollection ?? row.amount ?? null,
      currency: 'USD',
      sourceReportedValue: row.dailyCollection != null
        ? `$${Number(row.dailyCollection).toLocaleString('en-US')}`
        : null,
      source: HISTORY_PROVIDER,
      sourceUrl: row.sourceUrl || null,
      isEstimate: row.isEstimate === true,
      verificationStatus: row.verificationStatus || 'provider-reported',
      market: 'US domestic',
    })).filter(row => row.movieTitle && Number.isFinite(Number(row.amount))));
    yearTopperCoverage = `No India nett lifetime rows for ${selectedYear} yet; showing US domestic yearly gross instead.`;
  }

  return {
    year: selectedYear,
    date: selectedDate,
    yearToppers,
    latestPlaying,
    nonIndianDomestic,
    nonIndianOnIndiaChart: nonIndianFromChart,
    coverage: {
      yearToppers: yearTopperCoverage,
      latestPlaying: 'Films currently on the live India daily chart, with day number when reported.',
      nonIndianDomestic: nonIndianCoverage,
    },
  };
}

export async function getBoxOfficeSyncStatus() {
  return BoxOfficeSyncState.find({}).sort({ provider: 1 }).lean();
}

