import express from 'express';
import { fetchTmdb } from '../services/tmdbService.js';
const router = express.Router();

// GET /api/streaming/providers?tmdbId=123&type=movie&region=IN
// Returns TMDB watch providers for a movie or TV show
router.get('/providers', async (req, res) => {
  const { tmdbId, type = 'movie', region = 'IN' } = req.query;
  if (!/^[1-9]\d{0,11}$/.test(String(tmdbId || '')) || !['movie', 'tv'].includes(String(type))) {
    return res.status(400).json({ success: false, error: 'tmdbId is required' });
  }
  try {
    const data = await fetchTmdb(`${type}/${tmdbId}/watch/providers`);
    const regionData = data.results?.[region];
    if (!regionData) {
      // Try US as fallback
      const usData = data.results?.['US'];
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
    console.error('Streaming providers request failed:', err.message);
    res.status(err.status || 502).json({ success: false, error: err.code || 'streaming_unavailable' });
  }
});

export default router;
