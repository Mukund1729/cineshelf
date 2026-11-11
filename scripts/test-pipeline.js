import dotenv from 'dotenv';
import connectDB from '../db.js';
import { syncMovieBoxOffice } from '../services/boxOfficePipelineService.js';

dotenv.config();

async function test() {
  console.log('Connecting to database...');
  await connectDB();
  
  const tmdbId = 872906;
  console.log(`Syncing box office for movie tmdbId ${tmdbId}...`);
  
  const result = await syncMovieBoxOffice(tmdbId);
  console.log('Sync result:');
  console.log(JSON.stringify(result, null, 2));
  
  console.log('Done! Exiting...');
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
