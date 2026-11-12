
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import listRoutes from './routes/list.js';
import watchlistRoutes from './routes/watchlist.js';
import reviewRoutes from './routes/review.js';
import diaryRoutes from './routes/diary.js';
import chatRoutes from './routes/chat.js';
import peopleRoutes from './routes/people.js';
import streamingRoutes from './routes/streaming.js';
import boxOfficeRoutes from './routes/boxoffice.js';
import picksRoutes from './routes/picks.js';
import notificationRoutes from './routes/notifications.js';
import exportRoutes from './routes/export.js';
import adminRoutes from './routes/admin.js';
import blogRoutes from './routes/blog.js';
import tmdbRoutes from './routes/tmdb.js';
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

const app = express();

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'https://cineshelf-eight.vercel.app',
  ...(process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGINS || '')
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
app.use('/api/diary', diaryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/streaming', streamingRoutes);
app.use('/api/boxoffice', boxOfficeRoutes);
app.use('/api/picks', picksRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/tmdb', tmdbRoutes);

// Rate limiting for AI endpoint
const gptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many requests, please try again later.',
});
app.use('/api/gpt', gptLimiter);
app.use('/api', gptRoute);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/', (req, res) => res.json({ message: 'Visual.Cineaste API' }));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Request failed:', err.message);
  res.status(500).json({ success: false, message: 'Server error' });
});

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Visual.Cineaste API listening on port ${PORT}`);
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
