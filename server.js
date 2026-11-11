
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import axios from 'axios';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import listRoutes from './routes/list.js';
import watchlistRoutes from './routes/watchlist.js';
import reviewRoutes from './routes/review.js';
import peopleRoutes from './routes/people.js';
import streamingRoutes from './routes/streaming.js';
import boxOfficeRoutes from './routes/boxoffice.js';
import picksRoutes from './routes/picks.js';
import notificationRoutes from './routes/notifications.js';
import exportRoutes from './routes/export.js';
import adminRoutes from './routes/admin.js';
import blogRoutes from './routes/blog.js';
import gptRoute from './src/api/gpt.js';
import connectDB from './db.js';
import BoxOffice from './models/BoxOffice.js';
import { syncMovieBoxOffice } from './services/boxOfficePipelineService.js';

dotenv.config();

if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not set in .env');
  process.exit(1);
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_jwt_secret_here') {
  console.error('❌ JWT_SECRET must be set to a secure value in .env');
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
// TMDB API key — use TMDB_API_KEY (backend), fall back to VITE_ key for compatibility
const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_KEY;

const app = express();

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());
app.use('/uploads', express.static('uploads'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/lists', listRoutes);       // multi-list routes
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/streaming', streamingRoutes);
app.use('/api/boxoffice', boxOfficeRoutes);
app.use('/api/picks', picksRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blog', blogRoutes);

// Rate limiting for AI endpoint
const gptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many requests, please try again later.',
});
app.use('/api/gpt', gptLimiter);
app.use('/api', gptRoute);

// ─────────────────────────────────────────────────────────────
// TMDB Proxy routes (server-side, key never exposed to client)
// ─────────────────────────────────────────────────────────────

const tmdbProxy = async (url, params, res) => {
  try {
    const response = await axios.get(url, {
      params: { api_key: TMDB_API_KEY, ...params },
      timeout: 20000,
    });
    res.json(response.data);
  } catch (err) {
    console.error('TMDB proxy error:', err.message);
    if (err.response) {
      res.status(err.response.status).json({ error: err.response.data });
    } else if (err.code === 'ECONNABORTED') {
      res.status(504).json({ error: 'TMDB request timed out' });
    } else {
      res.status(500).json({ error: 'Failed to fetch from TMDB', details: err.message });
    }
  }
};

app.get('/api/tmdb/popular', (req, res) =>
  tmdbProxy('https://api.tmdb.org/3/movie/popular', { page: req.query.page || 1 }, res)
);
app.get('/api/tmdb/popular-tv', (req, res) =>
  tmdbProxy('https://api.tmdb.org/3/tv/popular', { page: req.query.page || 1 }, res)
);
app.get('/api/tmdb/popular-people', (req, res) =>
  tmdbProxy('https://api.tmdb.org/3/person/popular', { page: req.query.page || 1 }, res)
);
app.get('/api/tmdb/trending-movies', (req, res) =>
  tmdbProxy('https://api.tmdb.org/3/trending/movie/week', { page: req.query.page || 1 }, res)
);
app.get('/api/tmdb/top-rated', (req, res) =>
  tmdbProxy('https://api.tmdb.org/3/movie/top_rated', { page: req.query.page || 1 }, res)
);
app.get('/api/tmdb/top-rated-tv', (req, res) =>
  tmdbProxy('https://api.tmdb.org/3/tv/top_rated', { page: req.query.page || 1 }, res)
);
app.get('/api/tmdb/movie/:id', (req, res) =>
  tmdbProxy(`https://api.tmdb.org/3/movie/${req.params.id}`, {
    append_to_response: 'credits,videos,similar,watch/providers,release_dates',
  }, res)
);
app.get('/api/tmdb/tv/:id', (req, res) =>
  tmdbProxy(`https://api.tmdb.org/3/tv/${req.params.id}`, {
    append_to_response: 'credits,videos,similar,watch/providers',
  }, res)
);
app.get('/api/tmdb/person/:id', (req, res) =>
  tmdbProxy(`https://api.tmdb.org/3/person/${req.params.id}`, {
    append_to_response: 'movie_credits,tv_credits',
  }, res)
);
app.get('/api/tmdb/search', (req, res) => {
  const { query, type = 'multi', page = 1 } = req.query;
  tmdbProxy(`https://api.tmdb.org/3/search/${type}`, { query, page }, res);
});
app.get('/api/tmdb/discover', (req, res) => {
  const { type = 'movie', ...rest } = req.query;
  tmdbProxy(`https://api.tmdb.org/3/discover/${type}`, rest, res);
});
app.get('/api/tmdb/genre/:type/list', (req, res) =>
  tmdbProxy(`https://api.tmdb.org/3/genre/${req.params.type}/list`, {}, res)
);

// TMDB Image Proxy to fix CORS
app.get('/api/tmdb/image/:size/*path', async (req, res) => {
  try {
    const { size } = req.params;
    const path = Array.isArray(req.params.path) ? req.params.path.join('/') : req.params.path;
    const imageUrl = `https://image.tmdb.org/t/p/${size}/${path}`;
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000 });
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.send(response.data);
  } catch (err) {
    console.error('TMDB image proxy error:', err.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/', (req, res) => res.json({ message: 'Visual.Cineaste API' }));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Server error', error: err.message });
});

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Visual.Cineaste API running on http://localhost:${PORT}`);
      startBackgroundBoxOfficeUpdates();
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  });

function startBackgroundBoxOfficeUpdates() {
  // Run update immediately after 1 minute, then every 12 hours
  setTimeout(runUpdates, 60 * 1000);
  setInterval(runUpdates, 12 * 60 * 60 * 1000);

  async function runUpdates() {
    console.log('[Background Update] Starting scheduled Box Office updates...');
    try {
      const movies = await BoxOffice.find({}, { tmdbId: 1, updatedAt: 1 });
      console.log(`[Background Update] Found ${movies.length} movies to check.`);
      
      for (const m of movies) {
        const isStale = Date.now() - new Date(m.updatedAt).getTime() > 24 * 60 * 60 * 1000;
        if (isStale) {
          console.log(`[Background Update] Syncing movie ${m.tmdbId}...`);
          await syncMovieBoxOffice(m.tmdbId);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      console.log('[Background Update] Finished scheduled Box Office updates.');
    } catch (err) {
      console.error('[Background Update] Error during Box Office updates:', err);
    }
  }
}
