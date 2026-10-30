import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { dataDir } from './paths';

let cachedKey: Buffer | null = null;

/** Key comes from LASTCOMMIT_SECRET, else a random key file (mode 0600) in the data dir. */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const env = process.env.LASTCOMMIT_SECRET;
  if (env) {
    cachedKey = crypto.createHash('sha256').update(env).digest();
    return cachedKey;
  }
  const file = path.join(dataDir(), 'secret.key');
  try {
    cachedKey = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
    if (cachedKey.length === 32) return cachedKey;
  } catch {
    /* create below */
  }
  cachedKey = crypto.randomBytes(32);
  fs.writeFileSync(file, cachedKey.toString('base64'), { mode: 0o600 });
  return cachedKey;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

export function decryptSecret(enc: string): string {
  const [v, iv, tag, ct] = enc.split(':');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Unrecognised secret format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}
