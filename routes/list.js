import express from 'express';
import auth from '../middleware/auth.js';
import {
  getUserLists,
  getPublicLists,
  getListsByUser,
  getList,
  createList,
  updateList,
  deleteList,
  addToList,
  removeFromList,
} from '../controllers/listController.js';

const router = express.Router();

// Public
router.get('/public', getPublicLists);
router.get('/user/:userId', auth, getListsByUser);
router.get('/:id', auth, getList);

// Authenticated user's own lists
router.get('/', auth, getUserLists);
router.post('/', auth, createList);
router.put('/:id', auth, updateList);
router.delete('/:id', auth, deleteList);

// List items
router.post('/:id/items', auth, addToList);
router.delete('/:id/items/:tmdbId', auth, removeFromList);

export default router;
