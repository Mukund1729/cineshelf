import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { randomUUID } from 'node:crypto';

const MAGIC = Buffer.from('VCB1');
const DEFAULT_RETENTION_DAYS = 30;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for MongoDB backups.`);
  return value;
}

function getEncryptionKey() {
  const encoded = requiredEnv('BACKUP_ENCRYPTION_KEY');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  return key;
}

function getRetentionDays() {
  const value = Number(process.env.BACKUP_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  if (!Number.isInteger(value) || value < 1 || value > 3650) {
    throw new Error('BACKUP_RETENTION_DAYS must be an integer between 1 and 3650.');
  }
  return value;
}

function getS3Config() {
  const bucket = requiredEnv('S3_BUCKET');
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/i.test(bucket)) {
    throw new Error('S3_BUCKET is not a valid bucket name.');
  }
  const prefix = (process.env.S3_PREFIX || 'cineshelf/backups').replace(/^\/+|\/+$/g, '');
  if (!prefix || prefix.includes('..') || prefix.includes('\\') || /[?#]/.test(prefix)) {
    throw new Error('S3_PREFIX contains invalid path characters.');
  }
  return {
    bucket,
    prefix,
    endpoint: process.env.S3_ENDPOINT_URL?.trim() || null,
    region: process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
    cli: process.env.AWS_CLI_PATH || 'aws',
  };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      ...options,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.length > 10 * 1024 * 1024) child.kill();
    });
    child.stderr.on('data', chunk => {
      if (stderr.length < 16 * 1024) stderr += chunk.toString();
    });
    child.once('error', () => reject(new Error(`${path.basename(command)} could not be started.`)));
    child.once('close', code => {
      if (code !== 0) return reject(new Error(`${path.basename(command)} failed with exit code ${code}.`));
      resolve({ stdout, stderr });
    });
  });
}

function s3Args(config, args) {
  const result = [...args];
  if (config.endpoint) result.push('--endpoint-url', config.endpoint);
  result.push('--region', config.region, '--no-cli-pager');
  return result;
}

function getObjectPrefix(config) {
  return `${config.prefix}/mongodb-`;
}

async function pruneOldBackups(config, retentionDays) {
  const listed = await runCommand(config.cli, s3Args(config, [
    's3api',
    'list-objects-v2',
    '--bucket',
    config.bucket,
    '--prefix',
    getObjectPrefix(config),
    '--output',
    'json',
  ]), { capture: true });
  let response;
  try {
    response = JSON.parse(listed.stdout || '{}');
  } catch {
    throw new Error('S3 backup retention listing returned invalid JSON.');
  }

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const oldKeys = (response.Contents || [])
    .filter(item => item.Key?.startsWith(getObjectPrefix(config)) &&
      /\.archive\.enc$/.test(item.Key) &&
      Number.isFinite(new Date(item.LastModified).getTime()) &&
      new Date(item.LastModified).getTime() < cutoff)
    .map(item => item.Key);

  for (const key of oldKeys) {
    await runCommand(config.cli, s3Args(config, [
      's3api',
      'delete-object',
      '--bucket',
      config.bucket,
      '--key',
      key,
      '--output',
      'json',
    ]));
  }
  if (oldKeys.length) console.log(`[MongoDB backup] Removed ${oldKeys.length} expired backup object(s).`);
}

export function createBackupCipher(key, iv = crypto.randomBytes(12)) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Backup encryption requires a 32-byte key.');
  if (!Buffer.isBuffer(iv) || iv.length !== 12) throw new Error('Backup encryption requires a 12-byte IV.');
  return { iv, cipher: crypto.createCipheriv('aes-256-gcm', key, iv) };
}

export async function backupMongoDatabase() {
  const mongoUri = requiredEnv('MONGO_URI');
  const key = getEncryptionKey();
  const config = getS3Config();
  const retentionDays = getRetentionDays();
  const id = randomUUID();
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
  const fileName = `mongodb-${timestamp}.archive.enc`;
  const objectKey = `${config.prefix}/${fileName}`;
  const tempBase = path.join(os.tmpdir(), `cineshelf-backup-${id}`);
  const mongoConfigPath = `${tempBase}.yaml`;
  const bodyPath = `${tempBase}.body`;
  const encryptedPath = `${tempBase}.archive.enc`;
  const mongoDump = process.env.MONGODUMP_BINARY_PATH || 'mongodump';
  const iv = crypto.randomBytes(12);

  try {
    await fs.promises.writeFile(mongoConfigPath, `uri: ${JSON.stringify(mongoUri)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });

    const dump = spawn(mongoDump, ['--config', mongoConfigPath, '--archive', '--gzip'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let dumpError = '';
    dump.stderr.on('data', chunk => {
      if (dumpError.length < 16 * 1024) dumpError += chunk.toString();
    });
    const dumpExit = new Promise((resolve, reject) => {
      dump.once('error', () => reject(new Error('mongodump could not be started.')));
      dump.once('close', code => {
        if (code === 0) return resolve();
        reject(new Error(`mongodump failed with exit code ${code}.`));
      });
    });
    const { cipher } = createBackupCipher(key, iv);
    try {
      await Promise.all([
        pipeline(dump.stdout, cipher, createWriteStream(bodyPath, { flags: 'wx', mode: 0o600 })),
        dumpExit,
      ]);
    } catch (error) {
      if (dump.pid) dump.kill();
      if (dumpError) console.error('[MongoDB backup] mongodump reported an error.');
      throw error;
    }

    const authTag = cipher.getAuthTag();
    const encryptedFile = createWriteStream(encryptedPath, { flags: 'wx', mode: 0o600 });
    encryptedFile.write(Buffer.concat([MAGIC, iv, authTag]));
    await pipeline(createReadStream(bodyPath), encryptedFile);

    const destination = `s3://${config.bucket}/${objectKey}`;
    await runCommand(config.cli, s3Args(config, [
      's3',
      'cp',
      encryptedPath,
      destination,
      '--only-show-errors',
    ]));
    await pruneOldBackups(config, retentionDays);
    console.log(`[MongoDB backup] Encrypted backup uploaded: ${objectKey}`);
    return { objectKey, retentionDays };
  } finally {
    await Promise.all([
      mongoConfigPath,
      bodyPath,
      encryptedPath,
    ].map(file => fs.promises.rm(file, { force: true })));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  backupMongoDatabase().catch(error => {
    console.error('[MongoDB backup] Failed:', error.message);
    process.exitCode = 1;
  });
}
