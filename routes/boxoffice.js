import express from 'express';
import rateLimit from 'express-rate-limit';
import { fetchTmdb } from '../services/tmdbService.js';
import {
  getBoxOfficeByYear,
  getBoxOfficeByPerson,
  getBoxOfficeDaily,
  getBoxOfficeLastUpdated,
  getBoxOfficeOverview,
  getBoxOfficeRecords,
  getBoxOfficeSources,
  getBoxOfficeWeekly,
  getBoxOfficeWorldwide,
  getBoxOfficeYearly,
  getIndiaBoxOfficeReports,
  getIndianDaywiseBoxOffice,
  getIndianLiveBoxOffice,
  getMovieBoxOffice,
  getMovieBoxOfficeHistory,
} from '../controllers/boxOfficeController.js';

const router = express.Router();

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'box_office_rate_limit' },
}));

router.get('/overview', getBoxOfficeOverview);
router.get('/daily', getBoxOfficeDaily);
router.get('/weekly', getBoxOfficeWeekly);
router.get('/yearly', getBoxOfficeYearly);
router.get('/records', getBoxOfficeRecords);
router.get('/sources', getBoxOfficeSources);
router.get('/last-updated', getBoxOfficeLastUpdated);
router.get('/worldwide', getBoxOfficeWorldwide);
router.get('/india', getIndiaBoxOfficeReports);

// Get box office data by year
router.get('/year/:year', getBoxOfficeByYear);

// Get box office data by person
router.get('/person/:personId', getBoxOfficeByPerson);

// Live India collections
router.get('/india-live', getIndianLiveBoxOffice);

// Daywise India collections
router.get('/india-daywise', getIndianDaywiseBoxOffice);

// Get specific movie box office details
router.get('/movie/:tmdbId', getMovieBoxOffice);

router.get('/movie/:tmdbId/history', getMovieBoxOfficeHistory);

// Get trending box office data
router.get('/trending', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    res.json(await fetchTmdb('trending/movie/week', { page }));
  } catch (error) {
    console.error('Box office trending request failed:', error.message);
    res.status(error.status || 502).json({ error: error.code || 'trending_unavailable' });
  }
});

// Get top grossing movies
router.get('/top-grossing', async (req, res) => {
  try {
    const { year, page = 1 } = req.query;
    const params = { sort_by: 'revenue.desc', page };
    if (year) params.primary_release_year = year;
    res.json(await fetchTmdb('discover/movie', params));
  } catch (error) {
    console.error('Top grossing request failed:', error.message);
    res.status(error.status || 502).json({ error: error.code || 'top_grossing_unavailable' });
  }
});

export default router; 