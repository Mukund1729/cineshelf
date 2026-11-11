import express from 'express';
import auth from '../middleware/auth.js';
import { exportUserData, exportWatchlist, exportReviews, exportLists } from '../controllers/exportController.js';

const router = express.Router();

// Export all user data
router.get('/all', auth, exportUserData);

// Export specific data types
router.get('/watchlist', auth, exportWatchlist);
router.get('/reviews', auth, exportReviews);
router.get('/lists', auth, exportLists);

export default router; 