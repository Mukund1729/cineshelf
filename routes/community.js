import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import auth from '../middleware/auth.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { COMMUNITY_IMAGE_TYPES, COMMUNITY_LIMITS } from '../data/communityOptions.js';
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
import {
  checkAvailability,
  updateCommunity,
  uploadCommunityImage,
  removeCommunityImage,
  getCommunityImage,
  listMembers,
  updateMember,
  toggleLockPost,
  deletePost,
} from '../controllers/communityManageController.js';

const router = express.Router();
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
});
// Availability checks run while the creator types, so they get their own budget.
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
});

// Same in-memory upload approach as profile avatars and covers (routes/user.js).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: COMMUNITY_LIMITS.imageBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (COMMUNITY_IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed.'), false);
  },
});

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `Image is too large. Maximum ${Math.round(COMMUNITY_LIMITS.imageBytes / (1024 * 1024))} MB.`
      : `Upload failed: ${err.message}`;
    return res.status(400).json({ success: false, error: message });
  }
  if (err) return res.status(400).json({ success: false, error: err.message });
  return next();
};

router.get('/home', optionalAuth, getCommunityHome);
router.get('/feed', optionalAuth, getFeed);
router.get('/spotlight', optionalAuth, getMovieSpotlight);
router.get('/list', optionalAuth, listCommunities);
router.get('/me', auth, getUserCommunities);
router.get('/user/:userId', optionalAuth, getUserCommunities);
router.get('/check-slug', auth, lookupLimiter, checkAvailability);
router.get('/media/:communityId/:kind', getCommunityImage);

router.get('/posts/:postId', optionalAuth, getPost);
router.delete('/posts/:postId', auth, writeLimiter, deletePost);
router.post('/posts/:postId/react', auth, writeLimiter, reactToPost);
router.post('/posts/:postId/vote', auth, writeLimiter, votePoll);
router.post('/posts/:postId/bookmark', auth, writeLimiter, toggleBookmark);
router.post('/posts/:postId/comments', auth, writeLimiter, addComment);
router.post('/posts/:postId/pin', auth, writeLimiter, pinPost);
router.post('/posts/:postId/lock', auth, writeLimiter, toggleLockPost);

router.post('/', auth, writeLimiter, createCommunity);
router.get('/:slug/posts', optionalAuth, getCommunityPosts);
router.post('/:slug/posts', auth, writeLimiter, createPost);
router.post('/:slug/join', auth, writeLimiter, joinCommunity);
router.post('/:slug/leave', auth, writeLimiter, leaveCommunity);
router.get('/:slug/members', optionalAuth, listMembers);
router.patch('/:slug/members/:userId', auth, writeLimiter, updateMember);
router.post('/:slug/image/:kind', auth, writeLimiter, upload.single('image'), handleUploadError, uploadCommunityImage);
router.delete('/:slug/image/:kind', auth, writeLimiter, removeCommunityImage);
router.patch('/:slug', auth, writeLimiter, updateCommunity);
router.get('/:slug', optionalAuth, getCommunityBySlug);

export default router;
