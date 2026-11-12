import express from 'express';
import auth from '../middleware/auth.js';
import {
  getReviews,
  getReviewsByUser,
  getReviewsByMovie,
  getReviewById,
  addReview,
  updateReview,
  deleteReview,
  likeReview,
} from '../controllers/reviewController.js';

const router = express.Router();

// Current user's reviews
router.get('/', auth, getReviews);

// Public: reviews by any user
router.get('/user/:userId', getReviewsByUser);

// Public: all reviews for a specific movie/show
router.get('/movie/:tmdbId', getReviewsByMovie);

// Public: one full review
router.get('/:id', getReviewById);

// Create or update a review
router.post('/', auth, addReview);

// Update own review by ID
router.put('/:id', auth, updateReview);

// Delete own review
router.delete('/:id', auth, deleteReview);

// Like/unlike a review
router.post('/:id/like', auth, likeReview);

export default router;
