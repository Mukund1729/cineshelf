import dotenv from 'dotenv';
import { backupMongoDatabase } from '../scripts/backup-mongodb.js';

dotenv.config();

const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 60 * 60 * 1000;
let stopping = false;
let timer = null;
let running = false;

async function runAndSchedule() {
  if (stopping || running) return;
  running = true;
  let delay = DAY_MS;
  try {
    await backupMongoDatabase();
  } catch (error) {
    console.error('[MongoDB backup worker] Backup failed:', error.message);
    delay = RETRY_MS;
  } finally {
    running = false;
    if (!stopping) timer = setTimeout(runAndSchedule, delay);
  }
}

function stop(signal) {
  stopping = true;
  clearTimeout(timer);
  console.log(`[MongoDB backup worker] Received ${signal}; no further backups will start.`);
  if (!running) process.exit(0);
  const wait = setInterval(() => {
    if (!running) {
      clearInterval(wait);
      process.exit(0);
    }
  }, 250);
}

dotenv.config();
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
console.log('[MongoDB backup worker] Starting; first encrypted S3 backup will run now.');
await runAndSchedule();
