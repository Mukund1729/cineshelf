import { randomUUID } from 'node:crypto';
import axios from 'axios';
import BoxOfficeCache from '../models/BoxOfficeCache.js';
import BoxOfficeDaily from '../models/BoxOfficeDaily.js';
import BoxOfficeLifetime from '../models/BoxOfficeLifetime.js';
import BoxOfficeSyncState from '../models/BoxOfficeSyncState.js';
import { fetchTmdb } from './tmdbService.js';
import { ensureBoxOfficeCacheWritesAllowed } from './storageMonitor.js';

const INDIAN_BOX_OFFICE_FEED_URL = 'https://indian-boxoffice.com/feed.xml';
const BOX_OFFICE_HISTORY_API = 'https://www.boxofficehistory.com/api/v1';
const INDIA_PROVIDER = 'indian-boxoffice-rss';
const HISTORY_PROVIDER = 'box-office-history';
const CRORE_INR = 10_000_000;
const MAX_RSS_BYTES = 1_000_000;
const MAX_CACHE_PAYLOAD_BYTES = 128 * 1024;
const MAX_HISTORY_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_HISTORY_MEMORY_ENTRY_BYTES = 2 * 1024 * 1024;
const MAX_HISTORY_MEMORY_CACHE_BYTES = 8 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 100;
const MAX_DAILY_REPORTS = 1000;
const MAX_LIFETIME_REPORTS = 300;
const MAX_TMDB_LOOKUPS_PER_SYNC = 30;
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
  if (moviePath) return moviePath[1].toLowerCase();
  const normalized = normalizeTitle(title).replace(/\s+/g, '-');
  return `title-${normalized || 'unknown'}`;
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

  const dailyReports = [];
  const lifetimeReports = [];
  for (const item of rawItems) {
    const path = sourcePath(item.link);
    const reportedAt = new Date(item.pubDate);
    if (!path || Number.isNaN(reportedAt.getTime())) continue;

    const daily = item.description.match(
      /^(.+?)\s+leads the latest reported daily India nett at\s*₹\s*([\d,.]+)\s*Cr on Day\s*(\d+)([\s\S]*)$/i
    );
    if (daily) {
      const movieTitle = daily[1].trim();
      const dailyCollection = parseCrores(daily[2]);
      const cumulativeMatch = daily[4].match(
        /cumulative India nett (?:to|is)\s*₹\s*([\d,.]+)\s*Cr/i
      );
      const cumulativeCollection = cumulativeMatch ? parseCrores(cumulativeMatch[1]) : null;
      const worldwideMatch = daily[4].match(/worldwide gross to\s*₹\s*([\d,.]+)\s*Cr/i);
      const reportDate = (path.match(/^briefs\/(\d{4}-\d{2}-\d{2})$/i) || [])[1]
        || dateOnly(item.pubDate);
      const movieInfo = lifetimeByTitle.get(normalizeTitle(movieTitle));
      const sourceMovieKey = movieInfo?.sourceMovieKey || getSourceMovieKey(path, movieTitle);

      if (dailyCollection !== null && reportDate) {
        dailyReports.push({
          movieTitle,
          sourceMovieKey,
          reportDate,
          dayNumber: Number(daily[3]),
          dailyCollection,
          cumulativeCollection,
          sourceReportedValue: `₹${daily[2]} Cr`,
          sourceReportedCumulativeValue: cumulativeMatch ? `₹${cumulativeMatch[1]} Cr` : null,
          reportedAt,
          sourceUrl: item.link,
        });
      }

      if (worldwideMatch && reportDate) {
        const amount = parseCrores(worldwideMatch[1]);
        if (amount !== null) {
          lifetimeReports.push({
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
      continue;
    }

    if (!/^movies\//i.test(path)) continue;
    const movieTitle = item.title.replace(/\s+box office\s*[—-].*$/i, '').trim();
    const reportDate = dateOnly(item.pubDate);
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
        lifetimeReports.push({
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
        lifetimeReports.push({
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

  return { dailyReports, lifetimeReports };
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

async function findTmdbMatch(title, year) {
  const params = { query: title };
  if (year) params.year = year;
  const response = await fetchTmdb('search/movie', params);
  const target = normalizeTitle(title);
  let candidates = (response.results || []).filter(movie => (
    normalizeTitle(movie.title) === target || normalizeTitle(movie.original_title) === target
  ));
  if (year) {
    const matchingYear = candidates.filter(movie => movie.release_date?.startsWith(String(year)));
    if (matchingYear.length) candidates = matchingYear;
  }
  if (candidates.length !== 1) return null;
  const match = candidates[0];
  return {
    tmdbId: Number(match.id),
    originalTitle: match.original_title || null,
    posterPath: match.poster_path || null,
    releaseDate: match.release_date || null,
    releaseYear: match.release_date ? Number(match.release_date.slice(0, 4)) : null,
    originalLanguage: match.original_language || null,
  };
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

async function fetchIndianFeed() {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await axios.get(INDIAN_BOX_OFFICE_FEED_URL, {
        timeout: 15_000,
        responseType: 'text',
        maxContentLength: MAX_RSS_BYTES,
        maxBodyLength: MAX_RSS_BYTES,
        headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      });
      if (typeof response.data !== 'string') throw new Error('RSS response was not text.');
      return response.data;
    } catch (error) {
      lastError = error;
      if (error.response?.status && error.response.status < 500 && error.response.status !== 429) break;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** attempt)));
    }
  }
  throw lastError;
}

export async function syncIndianBoxOfficeFeed() {
  const owner = randomUUID();
  if (!await acquireSyncLease(owner)) {
    return { dailyReports: 0, lifetimeReports: 0, skipped: true };
  }

  try {
    const parsed = parseIndianBoxOfficeFeed(await fetchIndianFeed());
    const titles = [...new Set([...parsed.dailyReports, ...parsed.lifetimeReports].map(report => report.movieTitle))];
    const tmdbMatches = new Map();
    const canLookupTmdb = Boolean(process.env.TMDB_READ_ACCESS_TOKEN && process.env.TMDB_READ_ACCESS_TOKEN.length >= 20);
    if (!canLookupTmdb) {
      console.warn('[Box Office] TMDB matching skipped because TMDB_READ_ACCESS_TOKEN is unavailable.');
    }
    for (const title of (canLookupTmdb ? titles.slice(0, MAX_TMDB_LOOKUPS_PER_SYNC) : [])) {
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
        rank: null,
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
    await syncState(INDIA_PROVIDER, true, dailyCount + lifetimeCount);
    return { dailyReports: dailyCount, lifetimeReports: lifetimeCount };
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
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Box Office History returned an invalid response.');
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

export async function getMovieBoxOfficeReports(tmdbId) {
  const [lifetimeReports, dailyReports] = await Promise.all([
    BoxOfficeLifetime.find({ tmdbId, expiresAt: { $gt: new Date() } })
      .sort({ reportedAt: -1 })
      .limit(20)
      .lean(),
    BoxOfficeDaily.find({ tmdbId, expiresAt: { $gt: new Date() } })
      .sort({ reportDate: 1 })
      .limit(100)
      .lean(),
  ]);
  if (!lifetimeReports.length && !dailyReports.length) return null;

  const title = lifetimeReports[0]?.movieTitle || dailyReports[0]?.movieTitle;
  const latestByType = new Map();
  for (const report of lifetimeReports) {
    if (!latestByType.has(report.collectionType)) latestByType.set(report.collectionType, report);
  }
  const indiaNet = latestByType.get('india_nett');
  const worldwideGross = latestByType.get('worldwide_gross');
  return {
    tmdbId,
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
    daywiseCollection: dailyReports.length ? {
      value: dailyReports.map(report => ({
        day: null,
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
      source: dailyReports[0].source,
      sourceUrl: dailyReports[0].sourceUrl,
      lastUpdated: dailyReports[dailyReports.length - 1].reportedAt,
    } : null,
    lifetimeReports,
    dailyReports,
    coverage: 'Only source-reported records are returned; missing days are not filled.',
  };
}

export async function getBoxOfficeSyncStatus() {
  return BoxOfficeSyncState.find({}).sort({ provider: 1 }).lean();
}

