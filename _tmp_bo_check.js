import 'dotenv/config';
import mongoose from 'mongoose';
import BoxOfficeDaily from './models/BoxOfficeDaily.js';
import BoxOfficeLifetime from './models/BoxOfficeLifetime.js';

await mongoose.connect(process.env.MONGO_URI);
const now = new Date();
const dailyTotal = await BoxOfficeDaily.countDocuments({ expiresAt: { $gt: now } });
const dailyWithTmdb = await BoxOfficeDaily.countDocuments({ expiresAt: { $gt: now }, tmdbId: { $ne: null } });
const lifeTotal = await BoxOfficeLifetime.countDocuments({ expiresAt: { $gt: now } });
const lifeWithTmdb = await BoxOfficeLifetime.countDocuments({ expiresAt: { $gt: now }, tmdbId: { $ne: null } });
const samples = await BoxOfficeLifetime.find({ expiresAt: { $gt: now } })
  .sort({ reportedAt: -1 })
  .limit(10)
  .select('movieTitle tmdbId sourceMovieKey collectionType amount')
  .lean();
console.log(JSON.stringify({ dailyTotal, dailyWithTmdb, lifeTotal, lifeWithTmdb, samples }, null, 2));
await mongoose.disconnect();
