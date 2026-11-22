/**
 * Read-only integrity check for ratings, reviews, diary, and watchlists.
 * Does not modify any documents.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import DiaryEntry from '../models/DiaryEntry.js';
import Watchlist from '../models/Watchlist.js';
import User from '../models/User.js';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const [users, reviews, diary, watchlists] = await Promise.all([
    User.countDocuments({}),
    Review.countDocuments({}),
    DiaryEntry.countDocuments({}),
    Watchlist.countDocuments({}),
  ]);

  const reviewIndexes = await db.collection('reviews').indexes();
  const uniqueUserTmdb = reviewIndexes.find(index => index.unique && index.key?.user === 1 && index.key?.tmdbId === 1);

  const orphanReviews = await Review.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'author',
      },
    },
    { $match: { author: { $size: 0 } } },
    { $count: 'count' },
  ]);

  const sample = await Review.find({})
    .sort({ updatedAt: -1 })
    .limit(5)
    .populate('user', 'username name')
    .lean();

  const duplicatePairs = await Review.aggregate([
    { $group: { _id: { user: '$user', tmdbId: '$tmdbId' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'count' },
  ]);

  console.log(JSON.stringify({
    ok: true,
    counts: { users, reviews, diary, watchlists },
    uniqueUserTmdbIndex: Boolean(uniqueUserTmdb),
    orphanReviews: orphanReviews[0]?.count || 0,
    duplicateUserMovieReviews: duplicatePairs[0]?.count || 0,
    recentReviews: sample.map(item => ({
      id: item._id,
      tmdbId: item.tmdbId,
      rating: item.rating,
      hasText: Boolean(item.review),
      user: item.user?.username || item.user?.name || String(item.user),
      mediaType: item.mediaType,
      updatedAt: item.updatedAt,
    })),
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async error => {
  console.error(error);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
