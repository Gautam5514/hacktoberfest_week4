import { getDb } from './db';
import { refreshDerived } from './sync';
import type { ActivityStatus, TrackedRepo, TrackerEvent } from './types';

/** Time passes between syncs, so recompute idle time, status and score on read. */
export function refreshStatuses() {
  const now = Date.now();
  for (const r of Object.values(getDb().repos)) refreshDerived(r, now);
}

export interface RepoQuery {
  status?: ActivityStatus;
  q?: string;
  sort?: 'activity' | 'idle' | 'stars' | 'score' | 'name';
  tracking?: 'auto' | 'pinned' | 'ignored';
  includeMissing?: boolean;
}

export function queryRepos(o: RepoQuery): TrackedRepo[] {
  refreshStatuses();
  const q = o.q?.trim().toLowerCase();
  const list = Object.values(getDb().repos).filter(r =>
    (o.includeMissing || !r.missing) &&
    (!o.status || r.status === o.status) &&
    (!o.tracking || r.tracking === o.tracking) &&
    (!q || r.fullName.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.topics.some(t => t.includes(q))));
  const by: Record<string, (a: TrackedRepo, b: TrackedRepo) => number> = {
    activity: (a, b) => a.idleDays - b.idleDays,
    idle: (a, b) => b.idleDays - a.idleDays,
    stars: (a, b) => b.stars - a.stars,
    score: (a, b) => b.resurrectionScore - a.resurrectionScore,
    name: (a, b) => a.fullName.localeCompare(b.fullName),
  };
  return list.sort(by[o.sort || 'activity']);
}

export function queryEvents(o: { limit: number; repoId?: string; before?: string }): TrackerEvent[] {
  let ev = getDb().events;
  if (o.repoId) ev = ev.filter(e => e.repoId === o.repoId);
  if (o.before) ev = ev.filter(e => e.at < o.before!);
  return ev.slice(-o.limit).reverse();
}

export function summary() {
  refreshStatuses();
  const repos = Object.values(getDb().repos).filter(r => !r.missing);
  const counts: Record<ActivityStatus, number> = { active: 0, cooling: 0, dormant: 0, deep_sleep: 0, archived: 0 };
  for (const r of repos) counts[r.status]++;
  const candidates = repos.filter(r => r.resurrectionScore > 0 && r.tracking !== 'ignored')
    .sort((a, b) => b.resurrectionScore - a.resurrectionScore).slice(0, 5);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const commitsThisWeek = getDb().events.filter(e => e.type === 'commits' && new Date(e.at).getTime() > weekAgo)
    .reduce((n, e) => n + (Number(e.data?.count) || 0), 0);
  return { total: repos.length, counts, candidates, commitsThisWeek };
}
