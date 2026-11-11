import connectDB from '../db.js';
import BoxOffice from '../models/BoxOffice.js';

async function clear() {
  await connectDB();
  console.log('Clearing BoxOffice collection...');
  const res = await BoxOffice.deleteMany({});
  console.log(`Deleted ${res.deletedCount} documents.`);
  process.exit(0);
}
clear();
