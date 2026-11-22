import { resolveOttLinks } from '../services/ottLinkService.js';

async function handleWatchLinks(req, res, mediaType) {
  try {
    const tmdbId = Number(req.params.tmdbId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      return res.status(400).json({ success: false, error: 'Valid TMDB id required.' });
    }

    const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const year = req.query.year ? Number(req.query.year) : null;
    const country = typeof req.query.country === 'string' && req.query.country.length === 2
      ? req.query.country.toUpperCase()
      : 'IN';

    const data = await resolveOttLinks({ tmdbId, title, year, country, mediaType });
    res.json({ success: true, tmdbId, mediaType, ...data });
  } catch (error) {
    console.error(`[WatchLinks] ${mediaType} error:`, error.message);
    res.status(502).json({ success: false, error: 'Could not resolve OTT links right now.' });
  }
}

export const getMovieWatchLinks = (req, res) => handleWatchLinks(req, res, 'movie');
export const getTvWatchLinks = (req, res) => handleWatchLinks(req, res, 'tv');
