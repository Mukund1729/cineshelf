import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../db.js';
import { syncIndianBoxOfficeFeed } from '../services/boxOfficeDataService.js';
import { monitorDatabaseStorage } from '../services/storageMonitor.js';

dotenv.config();

const configuredHours = Number(process.env.BOX_OFFICE_SYNC_INTERVAL_HOURS || 4);
if (!Number.isFinite(configuredHours) || configuredHours < 3 || configuredHours > 6) {
  throw new Error('BOX_OFFICE_SYNC_INTERVAL_HOURS must be between 3 and 6.');
}

let stopping = false;
let running = false;
let timer;

async function syncOnce() {
  if (running || stopping) return;
  running = true;
  try {
    const result = await syncIndianBoxOfficeFeed();
    console.log(
      `[Box Office worker] RSS sync completed: ${result.dailyReports} daily and ` +
      `${result.lifetimeReports} lifetime reports.`
    );
  } catch (error) {
    console.error('[Box Office worker] RSS sync failed:', error.code || error.message);
  } finally {
    running = false;
  }
  try {
    await monitorDatabaseStorage();
  } catch (error) {
    console.error('[MongoDB storage] Monitoring failed:', error.message);
  }
}

function scheduleNext() {
  if (stopping) return;
  timer = setTimeout(async () => {
    await syncOnce();
    scheduleNext();
  }, configuredHours * 60 * 60 * 1000);
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  console.log(`[Box Office worker] Received ${signal}; shutting down.`);
  if (running) {
    const waitForSync = () => {
      if (running) return setTimeout(waitForSync, 250);
      mongoose.disconnect().finally(() => process.exit(0));
    };
    waitForSync();
    return;
  }
  await mongoose.disconnect();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await connectDB();
console.log(`[Box Office worker] Starting RSS sync every ${configuredHours} hours.`);
await syncOnce();
scheduleNext();
