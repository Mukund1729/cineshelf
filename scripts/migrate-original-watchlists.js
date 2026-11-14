import mongoose from 'mongoose';
import connectDB from '../db.js';
import { migrateOriginalWatchlists as migrateExistingWatchlists } from '../services/originalFilmService.js';

async function migrateOriginalWatchlists() {
  const result = await migrateExistingWatchlists();
  console.log(`[Original watchlist migration] Processed ${result.processed} users; added ${result.added} entries; ${result.failures} failures.`);
  if (result.failures) process.exitCode = 1;
}

try {
  await connectDB();
  await migrateOriginalWatchlists();
} finally {
  await mongoose.disconnect();
}
