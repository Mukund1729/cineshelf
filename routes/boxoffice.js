import express from 'express';
import axios from 'axios';
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
    const apiKey = process.env.VITE_TMDB_KEY;
    const response = await axios.get(`https://api.themoviedb.org/3/trending/movie/week`, {
      params: { api_key: apiKey, page }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Box office trending error:', error);
    res.status(500).json({ error: 'Failed to fetch trending box office data' });
  }
});

// Get top grossing movies
router.get('/top-grossing', async (req, res) => {
  try {
    const { year, page = 1 } = req.query;
    const apiKey = process.env.VITE_TMDB_KEY;
    let url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&sort_by=revenue.desc&page=${page}`;
    
    if (year) {
      url += `&primary_release_year=${year}`;
    }
    
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('Top grossing error:', error);
    res.status(500).json({ error: 'Failed to fetch top grossing movies' });
  }
});

export default router; 