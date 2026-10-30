import fs from 'fs';
import path from 'path';
import { dataDir } from './paths';
import type { TrackerDb } from './types';
import { classify, idleDaysSince } from './classify';

const MAX_EVENTS = 2000;

export function defaultSettings() {
  return {
    intervalMinutes: Number(process.env.LASTCOMMIT_SYNC_MINUTES) || 30,
    thresholds: { active: 30, cooling: 90, dormant: 180 },
  };
}

function emptyDb(): TrackerDb {
  return {
    version: 1,
    connection: null,
    baselineDoneAt: null,
    repos: {},
    events: [],
    lastSync: null,
    syncHistory: [],
    etags: {},
    lastFullListAt: null,
    deep: {},
    analyses: {},
    deliveries: [],
    settings: defaultSettings(),
  };
}

/** Older files used a different status ladder; recompute silently so no bogus events fire. */
function migrate(db: TrackerDb) {
  for (const r of Object.values(db.repos)) {
    r.idleDays = idleDaysSince(r.lastActivityAt);
    r.status = classify(r.idleDays, r.archived, db.settings.thresholds);
    r.botOnly ??= false;
    r.license ??= null;
    r.scoreBreakdown ??= null;
  }
}

const g = globalThis as unknown as { __trackerDb?: TrackerDb };

function file() {
  return path.join(dataDir(), 'tracker.json');
}

/** Loads once per process. A corrupt file is quarantined, never silently overwritten. */
export function getDb(): TrackerDb {
  if (g.__trackerDb) return g.__trackerDb;
  let db = emptyDb();
  try {
    const raw = fs.readFileSync(file(), 'utf8');
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1) {
        db = { ...db, ...parsed, settings: { ...db.settings, ...parsed.settings } };
        migrate(db);
      }
      else throw new Error('unknown schema version');
    } catch {
      fs.renameSync(file(), `${file()}.corrupt-${Date.now()}`);
    }
  } catch {
    /* first run */
  }
  g.__trackerDb = db;
  return db;
}

/** Atomic write: temp file + rename, so a crash never leaves a half-written database. */
export function saveDb(): void {
  const db = getDb();
  if (db.events.length > MAX_EVENTS) db.events = db.events.slice(-MAX_EVENTS);
  const tmp = `${file()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, file());
}
