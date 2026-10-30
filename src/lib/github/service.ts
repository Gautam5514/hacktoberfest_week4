import { NextResponse } from 'next/server';
import { getDb, saveDb } from './db';
import { encryptSecret } from './crypto';
import { GitHubClient, GitHubError } from './client';
import { startSync, currentSync } from './sync';
import { refreshStatuses } from './views';

const g = globalThis as unknown as { __trackerTimer?: NodeJS.Timeout };

/** Starts the background scheduler once per process; safe to call from any route. */
export function ensureScheduler() {
  if (g.__trackerTimer) return;
  g.__trackerTimer = setInterval(() => {
    const db = getDb();
    if (!db.connection || db.connection.status !== 'ok' || currentSync()?.state === 'running') return;
    const last = db.lastSync?.finishedAt ? new Date(db.lastSync.finishedAt).getTime() : 0;
    if (Date.now() - last >= db.settings.intervalMinutes * 60_000) startSync('scheduled');
  }, 60_000);
  g.__trackerTimer.unref();
}

function resetData(db: ReturnType<typeof getDb>) {
  db.repos = {}; db.events = []; db.baselineDoneAt = null; db.lastSync = null; db.syncHistory = [];
  db.etags = {}; db.lastFullListAt = null; db.deep = {}; db.analyses = {}; db.deliveries = [];
}

export async function connect(token: string) {
  const client = new GitHubClient(token);
  const viewer = await client.getViewer(); // throws GitHubError on bad token
  const db = getDb();
  if (db.connection && db.connection.login !== viewer.login) {
    // different account: old snapshots would be misleading
    resetData(db);
  }
  db.connection = {
    login: viewer.login, name: viewer.name, avatarUrl: viewer.avatarUrl, scopes: viewer.scopes,
    tokenEnc: encryptSecret(token), tokenHint: `…${token.slice(-4)}`,
    connectedAt: new Date().toISOString(), status: 'ok',
  };
  saveDb();
  ensureScheduler();
  startSync('connect');
  return publicConnection();
}

export function disconnect(purge: boolean) {
  const db = getDb();
  db.connection = null;
  if (purge) { resetData(db); }
  saveDb();
}

/** Connection info safe to send to the browser: never includes the token. */
export function publicConnection() {
  const c = getDb().connection;
  if (!c) return { connected: false as const };
  const { tokenEnc: _omit, ...safe } = c;
  return { connected: true as const, ...safe };
}

export function snapshot() {
  refreshStatuses();
  const db = getDb();
  return { connection: publicConnection(), sync: currentSync() ?? db.lastSync, intervalMinutes: db.settings.intervalMinutes };
}

/** Block cross-site writes: browsers always send Origin on cross-origin POST/PATCH/DELETE. */
export function sameOriginOrReject(req: Request): NextResponse | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;
  try {
    if (new URL(origin).host === req.headers.get('host')) return null;
  } catch { /* fall through */ }
  return NextResponse.json({ success: false, error: 'Cross-origin request blocked' }, { status: 403 });
}

export function errorResponse(e: unknown) {
  if (e instanceof GitHubError) {
    const status = e.code === 'unauthorized' ? 401 : e.code === 'rate_limited' ? 429 : e.code === 'forbidden' ? 403 : 502;
    return NextResponse.json({ success: false, error: e.message, code: e.code }, { status });
  }
  console.error(e);
  return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
}
