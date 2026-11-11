import express from 'express';
import axios from 'axios';
const router = express.Router();

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_KEY;

// GET /api/streaming/providers?tmdbId=123&type=movie&region=IN
// Returns TMDB watch providers for a movie or TV show
router.get('/providers', async (req, res) => {
  const { tmdbId, type = 'movie', region = 'IN' } = req.query;
  if (!tmdbId) {
    return res.status(400).json({ success: false, error: 'tmdbId is required' });
  }
  try {
    const endpoint = type === 'tv'
      ? `https://api.themoviedb.org/3/tv/${tmdbId}/watch/providers`
      : `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers`;

    const response = await axios.get(endpoint, {
      params: { api_key: TMDB_API_KEY },
      timeout: 10000,
    });

    const regionData = response.data.results?.[region];
    if (!regionData) {
      // Try US as fallback
      const usData = response.data.results?.['US'];
      if (usData) {
        return res.json({
          success: true,
          data: {
            region: 'US',
            link: usData.link || null,
            flatrate: usData.flatrate || [],
            rent: usData.rent || [],
            buy: usData.buy || [],
          },
        });
      }
      return res.json({ success: true, data: null, message: 'No streaming data available for this region' });
    }

    res.json({
      success: true,
      data: {
        region,
        link: regionData.link || null,
        flatrate: regionData.flatrate || [],
        rent: regionData.rent || [],
        buy: regionData.buy || [],
      },
    });
  } catch (err) {
    console.error('Streaming providers error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch streaming providers' });
  }
});

export default router;
