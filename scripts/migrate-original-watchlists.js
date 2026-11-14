import mongoose from 'mongoose';
import connectDB from '../db.js';
import User from '../models/User.js';
import Watchlist from '../models/Watchlist.js';
import {
  getOriginalWatchlistEntries,
  mergeMissingOriginalWatchlistMovies,
} from '../services/originalFilmService.js';

async function migrateOriginalWatchlists() {
  const seedEntries = getOriginalWatchlistEntries();
  const users = User.find({ originalWatchlistSeedVersion: { $ne: 1 } })
    .select('_id')
    .lean()
    .cursor({ batchSize: 100 });
  let processed = 0;
  let added = 0;
  let failures = 0;

  for await (const user of users) {
    try {
      const watchlist = await Watchlist.findOne({ user: user._id });
      if (watchlist) {
        const missing = mergeMissingOriginalWatchlistMovies(watchlist.movies);
        if (missing.length) {
          watchlist.movies.push(...missing);
          await watchlist.save();
          added += missing.length;
        }
      } else {
        await Watchlist.create({ user: user._id, movies: seedEntries });
        added += seedEntries.length;
      }
      await User.updateOne(
        { _id: user._id, originalWatchlistSeedVersion: { $ne: 1 } },
        { $set: { originalWatchlistSeedVersion: 1 } }
      );
      processed += 1;
    } catch (error) {
      failures += 1;
      console.error(`[Original watchlist migration] User ${user._id} failed:`, error.message);
    }
  }

  console.log(`[Original watchlist migration] Processed ${processed} users; added ${added} entries; ${failures} failures.`);
  if (failures) process.exitCode = 1;
}

try {
  await connectDB();
  await migrateOriginalWatchlists();
} finally {
  await mongoose.disconnect();
}
