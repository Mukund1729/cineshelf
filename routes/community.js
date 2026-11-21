import express from 'express';
import rateLimit from 'express-rate-limit';
import auth from '../middleware/auth.js';
import optionalAuth from '../middleware/optionalAuth.js';
import {
  getCommunityHome,
  listCommunities,
  createCommunity,
  getCommunityBySlug,
  joinCommunity,
  leaveCommunity,
  getFeed,
  getCommunityPosts,
  createPost,
  getPost,
  reactToPost,
  votePoll,
  toggleBookmark,
  addComment,
  pinPost,
  getMovieSpotlight,
  getUserCommunities,
} from '../controllers/communityController.js';

const router = express.Router();
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/home', optionalAuth, getCommunityHome);
router.get('/feed', optionalAuth, getFeed);
router.get('/spotlight', optionalAuth, getMovieSpotlight);
router.get('/list', optionalAuth, listCommunities);
router.get('/me', auth, getUserCommunities);
router.get('/user/:userId', optionalAuth, getUserCommunities);

router.get('/posts/:postId', optionalAuth, getPost);
router.post('/posts/:postId/react', auth, writeLimiter, reactToPost);
router.post('/posts/:postId/vote', auth, writeLimiter, votePoll);
router.post('/posts/:postId/bookmark', auth, writeLimiter, toggleBookmark);
router.post('/posts/:postId/comments', auth, writeLimiter, addComment);
router.post('/posts/:postId/pin', auth, writeLimiter, pinPost);

router.post('/', auth, writeLimiter, createCommunity);
router.get('/:slug/posts', optionalAuth, getCommunityPosts);
router.post('/:slug/posts', auth, writeLimiter, createPost);
router.post('/:slug/join', auth, writeLimiter, joinCommunity);
router.post('/:slug/leave', auth, writeLimiter, leaveCommunity);
router.get('/:slug', optionalAuth, getCommunityBySlug);

export default router;
