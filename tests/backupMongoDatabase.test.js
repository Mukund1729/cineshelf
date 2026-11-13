import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createBackupCipher } from '../scripts/backup-mongodb.js';

test('encrypted backup payload authenticates and decrypts with its key', () => {
  const key = crypto.randomBytes(32);
  const plaintext = Buffer.from('permanent accounts and chat archive');
  const { iv, cipher } = createBackupCipher(key);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const header = Buffer.concat([Buffer.from('VCB1'), iv, tag]);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, header.subarray(4, 16));
  decipher.setAuthTag(header.subarray(16, 32));
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  assert.deepEqual(decrypted, plaintext);
});

test('encrypted backup payload fails authentication with a wrong key', () => {
  const { cipher, iv } = createBackupCipher(crypto.randomBytes(32));
  const encrypted = Buffer.concat([cipher.update('backup'), cipher.final()]);
  const header = Buffer.concat([Buffer.from('VCB1'), iv, cipher.getAuthTag()]);
  const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.randomBytes(32), header.subarray(4, 16));
  decipher.setAuthTag(header.subarray(16, 32));
  decipher.update(encrypted);
  assert.throws(() => decipher.final());
});
