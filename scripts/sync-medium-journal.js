import mongoose from 'mongoose';
import connectDB from '../db.js';
import { getMediumJournalSyncStatus, syncMediumJournal } from '../services/mediumJournalService.js';

try {
  await connectDB();
  const result = await syncMediumJournal();
  if (result.skipped) {
    console.log('[Journal] A sync already holds the database lease; no work was started.');
  } else {
    console.log('[Journal] RSS synchronization report:', JSON.stringify({
      ...result,
      oldestArticleAt: result.oldestArticleAt?.toISOString() || null,
      newestArticleAt: result.newestArticleAt?.toISOString() || null,
    }, null, 2));
    console.log('[Journal] Current archive status:', JSON.stringify(await getMediumJournalSyncStatus(), null, 2));
    if (result.failed) process.exitCode = 1;
  }
} catch (error) {
  console.error('[Journal] RSS synchronization failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
