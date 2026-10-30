import type { ActivityStatus, DeepScan, ScoreBreakdown, TrackedRepo, TrackerSettings } from './types';

const DAY = 86_400_000;

export function idleDaysSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY));
}

export const DEFAULT_THRESHOLDS: TrackerSettings['thresholds'] = { active: 30, cooling: 90, dormant: 180 };

/**
 * Dormancy is a measurable state: days since the last *human* default-branch commit.
 * Cut points are configurable; defaults follow the product spec (30/90/180).
 * Archived is a separate terminal state, not a failure.
 */
export function classify(idleDays: number, archived: boolean, t = DEFAULT_THRESHOLDS): ActivityStatus {
  if (archived) return 'archived';
  if (idleDays <= t.active) return 'active';
  if (idleDays <= t.cooling) return 'cooling';
  if (idleDays <= t.dormant) return 'dormant';
  return 'deep_sleep';
}

/**
 * Resurrection potential is an *assessment*, not a measurement, and no study validates
 * weights for it. It is shown as a transparent breakdown labelled "heuristic".
 *
 * Timing follows the revival literature: most revivals of abandoned projects happen within
 * the first year or two (Avelino et al. 2019), so the multiplier is 0 until 6 months idle,
 * full strength between 6 and 24 months, then decays rather than climbing forever.
 */
export function resurrectionScore(
  r: Pick<TrackedRepo, 'stars' | 'forks' | 'sizeKb' | 'fork' | 'archived' | 'license' | 'openIssues'>,
  idleDays: number,
  deep?: DeepScan,
): ScoreBreakdown | null {
  if (r.archived || idleDays < 180) return null;
  const notes: string[] = [];

  const value = Math.min(10, Math.log2(1 + r.stars + 2 * r.forks)) + (r.openIssues > 0 ? 1 : 0);
  if (r.stars + r.forks > 0) notes.push(`${r.stars} stars, ${r.forks} forks show outside interest`);
  if (r.openIssues > 0) notes.push(`${r.openIssues} open issues/PRs show unmet demand`);

  let feasibility = 0;
  if (r.license) { feasibility += 1; notes.push(`license ${r.license}: safe to build on`); }
  else notes.push('no license detected: reuse is legally unclear');
  if (r.sizeKb > 100) { feasibility += 1; notes.push('non-trivial codebase'); }
  if (deep?.readme) { feasibility += 1; notes.push('README present'); }
  if (deep?.pulls.length) { feasibility += 1; notes.push(`${deep.pulls.length} open PR(s) hold unfinished work`); }

  const years = idleDays / 365;
  const timing = idleDays <= 730 ? 1 : Math.max(0.4, 1 - ((years - 2) / 3) * 0.6);
  if (timing < 1) notes.push('long idle time lowers odds that a revival sticks');

  const forkPenalty = r.fork ? 0.5 : 1;
  if (r.fork) notes.push('fork: upstream may already carry the work');

  const total = Math.round((value + feasibility) * timing * forkPenalty * 10) / 10;
  return {
    value: Math.round(value * 10) / 10, feasibility, timing: Math.round(timing * 100) / 100, forkPenalty, total, notes,
  };
}

export const STATUS_RANK: Record<ActivityStatus, number> = {
  active: 0, cooling: 1, dormant: 2, deep_sleep: 3, archived: 4,
};
