import express from 'express';

import auth from '../middleware/auth.js';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../controllers/watchlistController.js';

const router = express.Router();


// Get user's watchlist
router.get('/', auth, getWatchlist);

// Add movie to watchlist
router.post('/', auth, addToWatchlist);

// Remove movie from watchlist
router.delete('/:tmdbId', auth, removeFromWatchlist);

export default router;
