import express from 'express';
import { fetchTmdb } from '../services/tmdbService.js';
import { getBoxOfficeByYear, getBoxOfficeByPerson, getBoxOfficeIndia, getIndianLiveBoxOffice, getIndianDaywiseBoxOffice, getMovieBoxOffice } from '../controllers/boxOfficeController.js';

const router = express.Router();

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

// Get India box office data
router.get('/india', getBoxOfficeIndia);

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