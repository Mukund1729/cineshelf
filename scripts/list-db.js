import connectDB from '../db.js';
import BoxOffice from '../models/BoxOffice.js';

async function list() {
  await connectDB();
  const movies = await BoxOffice.find({});
  console.log(`Found ${movies.length} records in BoxOffice collection.`);
  for (const m of movies) {
    console.log(`tmdbId: ${m.tmdbId}, title: ${m.title}`);
    console.log(`  indiaNet:`, m.indiaNet);
    console.log(`  worldwideGross:`, m.worldwideGross);
    console.log(`  overseasGross:`, m.overseasGross);
    console.log(`  budget:`, m.budget);
  }
  process.exit(0);
}
list();
