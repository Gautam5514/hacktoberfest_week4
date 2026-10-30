import crypto from 'crypto';
import { getDb, saveDb } from './db';

const MAX_DELIVERIES = 500;

/** HMAC-SHA256 over the raw body; constant-time compare. Header looks like `sha256=<hex>`. */
export function verifySignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  let given: Buffer;
  try {
    given = Buffer.from(header.slice(7), 'hex');
  } catch {
    return false;
  }
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/** Returns true if this delivery GUID is new (and records it); false if it is a replay. */
export function recordDelivery(guid: string): boolean {
  const db = getDb();
  if (db.deliveries.includes(guid)) return false;
  db.deliveries.push(guid);
  if (db.deliveries.length > MAX_DELIVERIES) db.deliveries = db.deliveries.slice(-MAX_DELIVERIES);
  saveDb();
  return true;
}

export const SYNC_EVENTS = new Set([
  'push', 'pull_request', 'issues', 'release', 'create', 'delete', 'repository', 'installation', 'installation_repositories',
]);
