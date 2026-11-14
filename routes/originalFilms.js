import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getOriginalFilmBySlug,
  getOriginalFilmPersonProfile,
  getOriginalFilms,
  searchOriginalFilmCatalog,
} from '../controllers/originalFilmController.js';

const router = express.Router();

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}));

router.get('/', getOriginalFilms);
router.get('/search', searchOriginalFilmCatalog);
router.get('/people/:slug', getOriginalFilmPersonProfile);
router.get('/:slug', getOriginalFilmBySlug);

export default router;
