import express from 'express';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import {
  getAllPicks,
  getPicksByType,
  getCommunityLists,
  getDirectorSpotlights,
  createPick,
  updatePick,
  deletePick,
} from '../controllers/picksController.js';

const router = express.Router();

// Public routes
router.get('/', getAllPicks);
router.get('/type/:type', getPicksByType);
router.get('/community', getCommunityLists);
router.get('/directors', getDirectorSpotlights);

// Admin-only routes (auth + admin middleware)
router.post('/', auth, admin, createPick);
router.put('/:id', auth, admin, updatePick);
router.delete('/:id', auth, admin, deletePick);

export default router;