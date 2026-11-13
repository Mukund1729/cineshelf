import { fetchTmdb } from '../services/tmdbService.js';
import BoxOfficeDaily from '../models/BoxOfficeDaily.js';
import BoxOfficeLifetime from '../models/BoxOfficeLifetime.js';
import {
  getBoxOfficeHistoryDay,
  getBoxOfficeHistoryMovie,
  getBoxOfficeHistoryRecords,
  getBoxOfficeSyncStatus,
  getIndianReportsForDate,
  getIndianReportsInRange,
  getLatestLifetimeReports,
  getMovieBoxOfficeReports,
  getReportDateRange,
} from '../services/boxOfficeDataService.js';

const isValidDate = value => (
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
);

function getPagination(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 50);
  if (!Number.isInteger(page) || page < 1 || page > 10000 ||
      !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return null;
  }
  return { page, limit };
}

function sendBoxOfficeError(res, error, fallbackCode) {
  console.error(`[Box Office] ${fallbackCode}:`, error.code || error.message);
  res.status(error.status || 502).json({
    success: false,
    error: error.code || fallbackCode,
    message: error.status === 400 ? error.message : undefined,
  });
}

// Get box office data by year
export const getBoxOfficeByYear = async (req, res) => {
  try {
    const { year } = req.params;
    const { page = 1 } = req.query;
    const data = await fetchTmdb('discover/movie', {
        sort_by: 'revenue.desc',
        primary_release_year: year,
        page
    });
    res.json(data);
  } catch (error) {
    console.error('Box office by year error:', error);
    res.status(500).json({ error: 'Failed to fetch box office data by year' });
  }
};

// Get box office data by person
export const getBoxOfficeByPerson = async (req, res) => {
  try {
    const { personId } = req.params;
    const { page = 1 } = req.query;
    const [person, credits] = await Promise.all([
      fetchTmdb(`person/${personId}`),
      fetchTmdb(`person/${personId}/movie_credits`),
    ]);
    
    // Filter movies with revenue data and sort by revenue
    const moviesWithRevenue = credits.cast
      .filter(movie => movie.revenue && movie.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
    
    res.json({
      person,
      movies: moviesWithRevenue,
      total_revenue: moviesWithRevenue.reduce((sum, movie) => sum + movie.revenue, 0)
    });
  } catch (error) {
    console.error('Box office by person error:', error);
    res.status(500).json({ error: 'Failed to fetch box office data by person' });
  }
};

// Get India box office data
export const getBoxOfficeIndia = async (req, res) => {
  try {
    const { year, language, page = 1 } = req.query;
    const params = {
      sort_by: 'revenue.desc',
      page,
      with_origin_country: 'IN'
    };
    
    if (year) {
      params.primary_release_year = year;
    }
    
    if (language && language !== 'all') {
      params.with_original_language = language;
    }
    
    const response = await fetchTmdb('discover/movie', params);
    
    // Filter for Indian movies and add revenue formatting
    const indianMovies = response.results
      .filter(movie => movie.revenue && movie.revenue > 0)
      .map(movie => ({
        ...movie,
        revenue_inr: movie.revenue * 83, // Approximate USD to INR conversion
        revenue_formatted: {
          usd: `$${movie.revenue.toLocaleString('en-US')}`,
          inr: `₹${(movie.revenue * 83).toLocaleString('en-IN')}`
        }
      }));
    
    res.json({
      ...response,
      results: indianMovies
    });
  } catch (error) {
    console.error('India box office error:', error);
    res.status(500).json({ error: 'Failed to fetch India box office data' });
  }
};

export const getIndianLiveBoxOffice = async (req, res) => {
  try {
    const [lifetime, latestDaily] = await Promise.all([
      getLatestLifetimeReports('india_nett'),
      BoxOfficeDaily.find({ expiresAt: { $gt: new Date() } })
        .sort({ reportDate: -1 })
        .limit(100)
        .lean(),
    ]);
    const movies = lifetime.map(report => ({
      title: report.movieTitle,
      year: report.releaseYear,
      language: report.originalLanguage,
      tmdbId: report.tmdbId,
      revenue_inr: report.amount,
      source: report.source,
      sourceUrl: report.sourceUrl,
      isEstimate: report.isEstimate,
      verificationStatus: report.verificationStatus,
      daywiseData: null,
    }));
    res.json({
      updatedAt: lifetime[0]?.reportedAt || latestDaily[0]?.reportedAt || null,
      sources: { [INDIA_SOURCE_LABEL]: lifetime.length + latestDaily.length },
      movies,
    });
  } catch (error) {
    console.error('Indian live box office error:', error);
    res.status(500).json({ success: false, error: 'indian_box_office_unavailable' });
  }
};

export const getIndianDaywiseBoxOffice = async (req, res) => {
  try {
    const reports = await BoxOfficeDaily.find({ expiresAt: { $gt: new Date() } })
      .sort({ reportDate: 1 })
      .limit(1000)
      .lean();
    const groups = new Map();
    for (const report of reports) {
      const key = report.tmdbId ? `tmdb:${report.tmdbId}` : report.sourceMovieKey;
      if (!groups.has(key)) {
        groups.set(key, {
          title: report.movieTitle,
          year: report.releaseYear,
          language: report.originalLanguage,
          daywise_data: [],
          total_revenue_inr: null,
          source: report.source,
          sourceUrl: report.sourceUrl,
        });
      }
      const movie = groups.get(key);
      movie.daywise_data.push({
        day: null,
        date: report.reportDate.toISOString().slice(0, 10),
        revenue_inr: report.dailyCollection,
        cumulative_inr: report.cumulativeCollection,
        source: report.source,
      });
    }
    res.json({
      updatedAt: reports[reports.length - 1]?.reportedAt || null,
      coverage: 'Only source-reported days are included; no missing days are generated.',
      movies: [...groups.values()],
    });
  } catch (error) {
    console.error('Indian daywise box office error:', error);
    res.status(500).json({ success: false, error: 'indian_daywise_unavailable' });
  }
};

export const getMovieBoxOffice = async (req, res) => {
  try {
    const tmdbId = Number(req.params.tmdbId);
    if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
      return res.status(400).json({ success: false, error: 'invalid_tmdb_id' });
    }
    const data = await getMovieBoxOfficeReports(tmdbId);
    if (!data) return res.status(404).json({ success: false, error: 'box_office_data_unavailable' });
    res.json(data);
  } catch (err) {
    sendBoxOfficeError(res, err, 'movie_box_office_unavailable');
  }
};

const INDIA_SOURCE_LABEL = 'indian-boxoffice-rss';

export const getBoxOfficeOverview = async (req, res) => {
  try {
    const now = new Date();
    const [dailyCount, lifetimeCount, latestDaily, latestWorldwide, dailyTmdbIds, lifetimeTmdbIds, syncStates] = await Promise.all([
      BoxOfficeDaily.countDocuments({ expiresAt: { $gt: now } }),
      BoxOfficeLifetime.countDocuments({ expiresAt: { $gt: now } }),
      BoxOfficeDaily.findOne({ expiresAt: { $gt: now } }).sort({ reportDate: -1, reportedAt: -1 }).lean(),
      BoxOfficeLifetime.findOne({
        collectionType: 'worldwide_gross',
        expiresAt: { $gt: now },
      }).sort({ reportedAt: -1 }).lean(),
      BoxOfficeDaily.distinct('tmdbId', { tmdbId: { $ne: null }, expiresAt: { $gt: now } }),
      BoxOfficeLifetime.distinct('tmdbId', { tmdbId: { $ne: null }, expiresAt: { $gt: now } }),
      getBoxOfficeSyncStatus(),
    ]);
    const tmdbIds = new Set([...dailyTmdbIds, ...lifetimeTmdbIds]);
    const successfulSyncs = syncStates
      .filter(state => state.lastSuccessfulAt)
      .sort((a, b) => new Date(b.lastSuccessfulAt) - new Date(a.lastSuccessfulAt));

    res.json({
      success: true,
      data: {
        todayIndia: latestDaily ? {
          title: latestDaily.movieTitle,
          amount: latestDaily.dailyCollection,
          currency: latestDaily.currency,
          isEstimate: latestDaily.isEstimate,
          source: latestDaily.source,
          sourceUrl: latestDaily.sourceUrl,
          reportDate: latestDaily.reportDate,
        } : null,
        latestWorldwide: latestWorldwide ? {
          title: latestWorldwide.movieTitle,
          amount: latestWorldwide.amount,
          currency: latestWorldwide.currency,
          isEstimate: latestWorldwide.isEstimate,
          source: latestWorldwide.source,
          sourceUrl: latestWorldwide.sourceUrl,
          reportDate: latestWorldwide.reportDate,
        } : null,
        trackedMovies: tmdbIds.size,
        dailyReports: dailyCount,
        lifetimeReports: lifetimeCount,
        latestReportDate: latestDaily?.reportDate || latestWorldwide?.reportDate || null,
        lastSuccessfulSyncAt: successfulSyncs[0]?.lastSuccessfulAt || null,
        dataCoverage: {
          india: 'RSS briefs and lifetime summaries only; not a complete daily chart.',
          unitedStates: 'Historical daily charts are fetched from Box Office History on demand.',
          worldwide: 'Publisher-reported lifetime gross only; territory-level coverage is not verified.',
        },
      },
    });
  } catch (error) {
    sendBoxOfficeError(res, error, 'box_office_overview_unavailable');
  }
};

export const getIndiaBoxOfficeReports = async (req, res) => {
  try {
    const { language } = req.query;
    const date = req.query.date;
    const period = req.query.period || 'daily';
    const pagination = getPagination(req.query);
    if (!pagination) return res.status(400).json({ success: false, error: 'invalid_pagination' });
    if (date && !isValidDate(date)) return res.status(400).json({ success: false, error: 'invalid_date' });
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ success: false, error: 'invalid_period' });
    }
    if (language && !['all', 'hi', 'te', 'ta', 'ml', 'kn', 'en'].includes(language)) {
      return res.status(400).json({ success: false, error: 'invalid_language' });
    }
    if (period === 'daily') {
      const result = await getIndianReportsForDate(date, language, pagination.page, pagination.limit);
      return res.json({
        success: true,
        ...result,
        pages: Math.ceil(result.total / result.limit),
        coverage: 'RSS brief reports only; the publisher feed does not contain a complete all-film daily chart.',
      });
    }
    const periodDate = date || new Date().toISOString().slice(0, 10);
    const { start, end } = getReportDateRange(period, periodDate);
    const reports = await getIndianReportsInRange(start, end, language);
    const grouped = aggregateIndianReports(reports);
    const startIndex = (pagination.page - 1) * pagination.limit;
    res.json({
      success: true,
      date: periodDate,
      period,
      reports: grouped.slice(startIndex, startIndex + pagination.limit),
      total: grouped.length,
      page: pagination.page,
      limit: pagination.limit,
      pages: Math.ceil(grouped.length / pagination.limit),
      coverage: 'Partial sum of RSS-reported days only; this is not a complete period chart.',
    });
  } catch (error) {
    sendBoxOfficeError(res, error, 'india_box_office_unavailable');
  }
};

function aggregateIndianReports(reports) {
  const grouped = new Map();
  for (const report of reports) {
    const key = report.tmdbId ? `tmdb:${report.tmdbId}` : report.sourceMovieKey;
    const row = grouped.get(key) || {
      tmdbId: report.tmdbId,
      movieTitle: report.movieTitle,
      originalTitle: report.originalTitle,
      posterPath: report.posterPath,
      releaseDate: report.releaseDate,
      releaseYear: report.releaseYear,
      originalLanguage: report.originalLanguage,
      collectionType: report.collectionType,
      currency: report.currency,
      totalReported: 0,
      cumulativeCollection: null,
      reportedDays: 0,
      source: report.source,
      sourceUrl: report.sourceUrl,
      isEstimate: report.isEstimate,
      verificationStatus: report.verificationStatus,
      sourceUrls: [],
    };
    row.totalReported += report.dailyCollection;
    row.cumulativeCollection = report.cumulativeCollection ?? row.cumulativeCollection;
    row.reportedDays += 1;
    if (!row.sourceUrls.includes(report.sourceUrl)) row.sourceUrls.push(report.sourceUrl);
    grouped.set(key, row);
  }
  return [...grouped.values()].sort((a, b) => b.totalReported - a.totalReported);
}

export const getBoxOfficeDaily = async (req, res) => {
  try {
    const market = String(req.query.market || 'india').toLowerCase();
    const { date, language } = req.query;
    const pagination = getPagination(req.query);
    if (!pagination) return res.status(400).json({ success: false, error: 'invalid_pagination' });
    if (date && !isValidDate(date)) return res.status(400).json({ success: false, error: 'invalid_date' });

    if (market === 'us' || market === 'domestic') {
      if (!date) return res.status(400).json({ success: false, error: 'date_required' });
      const chart = await getBoxOfficeHistoryDay(date);
      const start = (pagination.page - 1) * pagination.limit;
      const rows = chart.rows.slice(start, start + pagination.limit);
      return res.json({
        success: true,
        ...chart,
        rows,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: chart.rows.length,
          pages: Math.ceil(chart.rows.length / pagination.limit),
        },
      });
    }
    if (market === 'india') return getIndiaBoxOfficeReports(req, res);
    if (market === 'worldwide') {
      const reports = await getLatestLifetimeReports('worldwide_gross', date);
      return res.json({
        success: true,
        date: date || reports[0]?.reportDate?.toISOString().slice(0, 10) || null,
        reports,
        coverage: 'Available publisher-reported lifetime worldwide gross; no daily worldwide values are assumed.',
      });
    }
    return res.status(400).json({ success: false, error: 'invalid_market' });
  } catch (error) {
    sendBoxOfficeError(res, error, 'daily_box_office_unavailable');
  }
};

export const getBoxOfficeWorldwide = async (req, res) => {
  try {
    const { date } = req.query;
    if (date && !isValidDate(date)) return res.status(400).json({ success: false, error: 'invalid_date' });
    const reports = await getLatestLifetimeReports('worldwide_gross', date);
    res.json({
      success: true,
      date: date || reports[0]?.reportDate?.toISOString().slice(0, 10) || null,
      reports,
      coverage: 'Available publisher-reported lifetime worldwide gross; no daily worldwide values are assumed.',
    });
  } catch (error) {
    sendBoxOfficeError(res, error, 'worldwide_box_office_unavailable');
  }
};

export const getBoxOfficeWeekly = async (req, res) => {
  try {
    const market = String(req.query.market || 'india').toLowerCase();
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    if (!isValidDate(date)) return res.status(400).json({ success: false, error: 'invalid_date' });
    if (req.query.language && !['all', 'hi', 'te', 'ta', 'ml', 'kn', 'en'].includes(req.query.language)) {
      return res.status(400).json({ success: false, error: 'invalid_language' });
    }
    if (market !== 'india') {
      return res.json({
        success: true,
        market,
        rows: [],
        coverage: 'No verified weekly source is currently integrated for this market.',
      });
    }
    const { start, end } = getReportDateRange('weekly', date);
    const reports = await getIndianReportsInRange(start, end, req.query.language);
    res.json({
      success: true,
      market,
      startDate: start.toISOString().slice(0, 10),
      endDate: new Date(end.getTime() - 1).toISOString().slice(0, 10),
      rows: aggregateIndianReports(reports),
      coverage: 'Partial sum of RSS-reported days only; this is not a complete weekly chart.',
    });
  } catch (error) {
    sendBoxOfficeError(res, error, 'weekly_box_office_unavailable');
  }
};

export const getBoxOfficeYearly = async (req, res) => {
  try {
    const year = Number(req.query.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return res.status(400).json({ success: false, error: 'invalid_year' });
    }
    const reports = await BoxOfficeLifetime.find({
      releaseYear: year,
      expiresAt: { $gt: new Date() },
    }).sort({ amount: -1 }).limit(100).lean();
    res.json({
      success: true,
      year,
      reports,
      coverage: 'Partial lifetime reports for movies released in this year; not a complete annual box-office total.',
    });
  } catch (error) {
    sendBoxOfficeError(res, error, 'yearly_box_office_unavailable');
  }
};

export const getBoxOfficeRecords = async (req, res) => {
  try {
    const [india, history] = await Promise.allSettled([
      getLatestLifetimeReports('india_nett'),
      getBoxOfficeHistoryRecords(),
    ]);
    const result = {
      success: true,
      india: india.status === 'fulfilled' ? {
        reports: india.value,
        coverage: 'Current RSS lifetime reports only; no all-time India records are claimed.',
      } : { reports: [], error: india.reason.code || 'india_records_unavailable' },
      unitedStates: history.status === 'fulfilled'
        ? history.value
        : { data: null, error: history.reason.code || 'history_records_unavailable' },
    };
    if (india.status === 'rejected') {
      console.error('[Box Office] India records unavailable:', india.reason.code || india.reason.message);
    }
    if (history.status === 'rejected') {
      console.error('[Box Office] History records unavailable:', history.reason.code || history.reason.message);
    }
    res.json(result);
  } catch (error) {
    sendBoxOfficeError(res, error, 'box_office_records_unavailable');
  }
};

export const getBoxOfficeSources = (req, res) => {
  res.json({
    success: true,
    sources: [
      {
        id: INDIA_SOURCE_LABEL,
        name: 'Indian Box Office',
        status: 'rss-limited',
        url: 'https://indian-boxoffice.com/feed.xml',
        authentication: 'No API key; public RSS feed.',
        coverage: 'Publisher consensus daily briefs and selected lifetime India nett/worldwide gross reports.',
        limitation: 'The RSS does not contain all 49 daily chart rows or complete historical day-wise data. Figures are estimates.',
      },
      {
        id: 'box-office-history',
        name: 'Box Office History',
        status: 'active-on-demand',
        url: 'https://www.boxofficehistory.com/api',
        authentication: 'No API key documented.',
        coverage: 'Verified US daily charts, TMDB lookup, US movie weekend histories, and US opening-weekend records.',
        limitation: 'Not an India-nett source. International chart endpoints were not enabled because their response routes could not be verified.',
      },
      {
        id: 'bfilmy',
        name: 'BFilmy',
        status: 'unavailable',
        url: 'https://bfilmy.live/api/',
        limitation: 'Documentation host/API could not be reached or verified; no adapter is enabled.',
      },
      {
        id: 'sacnilk',
        name: 'Sacnilk',
        status: 'disabled',
        limitation: 'No authorized public API or reuse license was verified; existing page scraping was removed from the active pipeline.',
      },
      {
        id: 'bollywood-hungama',
        name: 'Bollywood Hungama',
        status: 'disabled',
        limitation: 'No authorized public API or reuse license was verified; existing page scraping was removed from the active pipeline.',
      },
      {
        id: 'the-numbers-opusdata',
        name: 'The Numbers / OpusData',
        status: 'not-integrated',
        limitation: 'No usable public API documentation or credentials/partnership were available during verification.',
      },
      {
        id: 'boxofficeindia24',
        name: 'BoxOfficeIndia24',
        status: 'not-integrated',
        limitation: 'No verified public API or authorized access was found.',
      },
    ],
  });
};

export const getBoxOfficeLastUpdated = async (req, res) => {
  try {
    const [syncs, latestDaily, latestLifetime] = await Promise.all([
      getBoxOfficeSyncStatus(),
      BoxOfficeDaily.findOne({ expiresAt: { $gt: new Date() } }).sort({ reportedAt: -1 }).select('reportedAt').lean(),
      BoxOfficeLifetime.findOne({ expiresAt: { $gt: new Date() } }).sort({ reportedAt: -1 }).select('reportedAt').lean(),
    ]);
    res.json({
      success: true,
      providers: syncs,
      latestReportAt: [latestDaily?.reportedAt, latestLifetime?.reportedAt]
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null,
    });
  } catch (error) {
    sendBoxOfficeError(res, error, 'box_office_sync_status_unavailable');
  }
};

export const getMovieBoxOfficeHistory = async (req, res) => {
  try {
    const tmdbId = Number(req.params.tmdbId);
    if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
      return res.status(400).json({ success: false, error: 'invalid_tmdb_id' });
    }
    const [providerHistory, reports] = await Promise.allSettled([
      getBoxOfficeHistoryMovie(tmdbId),
      getMovieBoxOfficeReports(tmdbId),
    ]);
    const usHistory = providerHistory.status === 'fulfilled' ? providerHistory.value : null;
    const indiaReports = reports.status === 'fulfilled' ? reports.value?.dailyReports || [] : [];
    if (!usHistory && !indiaReports.length) {
      const error = providerHistory.status === 'rejected' ? providerHistory.reason : null;
      return res.status(error?.status || 404).json({
        success: false,
        error: error?.code || 'movie_history_unavailable',
      });
    }
    if (providerHistory.status === 'rejected' && providerHistory.reason.status !== 404) {
      console.error('[Box Office] US movie history unavailable:', providerHistory.reason.code || providerHistory.reason.message);
    }
    res.json({
      success: true,
      tmdbId,
      indiaDaily: indiaReports.map(report => ({
        date: report.reportDate.toISOString().slice(0, 10),
        dailyCollection: report.dailyCollection,
        cumulativeCollection: report.cumulativeCollection,
        currency: report.currency,
        source: report.source,
        sourceUrl: report.sourceUrl,
        isEstimate: report.isEstimate,
      })),
      unitedStates: usHistory,
      coverage: 'Only source-reported points are returned. The US provider supplies weekend history; missing daily values are not synthesized.',
    });
  } catch (error) {
    sendBoxOfficeError(res, error, 'movie_history_unavailable');
  }
};