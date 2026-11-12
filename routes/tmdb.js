import express from 'express';
import rateLimit from 'express-rate-limit';
import { proxyTmdb, proxyTmdbImage } from '../controllers/tmdbController.js';

const router = express.Router();
const metadataLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const imageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

router.get('/image/:size/:filename', imageLimiter, proxyTmdbImage);
router.get(/.*/, metadataLimiter, proxyTmdb);

export default router;
