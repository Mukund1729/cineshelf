import mongoose from 'mongoose';

const DEFAULT_LIMIT_BYTES = 512 * 1024 * 1024;
const DEFAULT_WARNING_PERCENTAGES = [60, 75, 85, 90];
let warnedThresholds = new Set();

function getLimitBytes() {
  const configured = Number(process.env.MONGO_STORAGE_LIMIT_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_LIMIT_BYTES;
}

function getWarningPercentages() {
  const configured = process.env.MONGO_STORAGE_WARNING_PCTS;
  if (!configured) return DEFAULT_WARNING_PERCENTAGES;
  const values = configured.split(',').map(value => Number(value.trim()));
  if (!values.length || values.some(value => !Number.isInteger(value) || value <= 0 || value > 100)) {
    throw new Error('MONGO_STORAGE_WARNING_PCTS must be comma-separated integers from 1 to 100.');
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

export async function getDatabaseStorageStats() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected; storage statistics are unavailable.');

  const stats = await db.command({ dbStats: 1, scale: 1 });
  const limitBytes = getLimitBytes();
  const dataBytes = Number(stats.dataSize) || 0;
  const collectionStorageBytes = Number(stats.storageSize) || 0;
  const indexBytes = Number(stats.indexSize) || 0;
  const usageBytes = collectionStorageBytes + indexBytes;

  return {
    database: db.databaseName,
    collections: Number(stats.collections) || 0,
    documents: Number(stats.objects) || 0,
    dataBytes,
    collectionStorageBytes,
    indexBytes,
    usageBytes,
    limitBytes,
    usagePercent: (usageBytes / limitBytes) * 100,
    generatedAt: new Date().toISOString(),
  };
}

export async function monitorDatabaseStorage() {
  const stats = await getDatabaseStorageStats();
  const thresholds = getWarningPercentages();
  for (const threshold of thresholds) {
    if (stats.usagePercent >= threshold && !warnedThresholds.has(threshold)) {
      console.warn(
        `[MongoDB storage] Usage is ${stats.usagePercent.toFixed(2)}% ` +
        `(${stats.usageBytes} / ${stats.limitBytes} bytes), threshold ${threshold}%.`
      );
      warnedThresholds.add(threshold);
    } else if (stats.usagePercent < threshold) {
      warnedThresholds.delete(threshold);
    }
  }
  return stats;
}

export async function ensureBoxOfficeCacheWritesAllowed() {
  const configured = Number(process.env.MONGO_STORAGE_BLOCK_AT_PERCENT);
  const criticalPercent = Number.isFinite(configured) && configured > 0 && configured <= 100
    ? configured
    : 85;
  const stats = await getDatabaseStorageStats();
  if (stats.usagePercent >= criticalPercent) {
    const error = new Error(
      `Box Office cache writes are paused because MongoDB storage is at ` +
      `${stats.usagePercent.toFixed(2)}% (limit ${criticalPercent}%).`
    );
    error.code = 'MONGO_STORAGE_CRITICAL';
    error.status = 507;
    throw error;
  }
  return stats;
}
