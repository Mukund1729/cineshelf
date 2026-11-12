import { getIndianBoxOfficeLive, getIndianDaywiseCatalog } from '../services/indianBoxOfficeService.js';
import BoxOffice from '../models/BoxOffice.js';
import { syncMovieBoxOffice } from '../services/boxOfficePipelineService.js';
import { fetchTmdb } from '../services/tmdbService.js';

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
    const data = await getIndianBoxOfficeLive();
    res.json(data);
  } catch (error) {
    console.error('Indian live box office error:', error);
    res.status(500).json({ error: 'Failed to fetch live Indian box office data' });
  }
};

export const getIndianDaywiseBoxOffice = async (req, res) => {
  try {
    const data = await getIndianDaywiseCatalog();
    res.json(data);
  } catch (error) {
    console.error('Indian daywise box office error:', error);
    res.status(500).json({ error: 'Failed to fetch daywise box office data' });
  }
};

export const getMovieBoxOffice = async (req, res) => {
  try {
    const { tmdbId } = req.params;
    if (!tmdbId) {
      return res.status(400).json({ error: 'tmdbId is required' });
    }

    let cached = await BoxOffice.findOne({ tmdbId: Number(tmdbId) });
    const isFresh = cached && (Date.now() - new Date(cached.updatedAt).getTime() < 24 * 60 * 60 * 1000);

    if (cached && isFresh) {
      return res.json(cached);
    }

    const updated = await syncMovieBoxOffice(Number(tmdbId));
    if (updated) {
      return res.json(updated);
    }

    if (cached) {
      return res.json(cached);
    }

    return res.status(404).json({ error: 'Box office data not available for this movie' });
  } catch (err) {
    console.error('getMovieBoxOffice controller error:', err);
    res.status(500).json({ error: 'Server error fetching movie box office data' });
  }
};