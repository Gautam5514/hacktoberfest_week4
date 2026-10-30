import crypto from 'crypto';
import { getDb, saveDb } from './db';
import { decryptSecret } from './crypto';
import { GitHubClient, GitHubError, type GhCommit, type GhRepo } from './client';
import { classify, idleDaysSince, resurrectionScore, STATUS_RANK } from './classify';
import { isBot } from './bots';
import type { CommitInfo, EventType, SyncRun, TrackedRepo, TrackerEvent } from './types';

const COMMIT_CONCURRENCY = 5;
const RECENT_COMMITS_KEPT = 30;
const FULL_LIST_EVERY_MS = 6 * 3_600_000; // metadata reconciliation interval
const RATE_FLOOR = 25; // stop before the budget is fully spent

const g = globalThis as unknown as { __trackerSync?: { run: SyncRun; promise: Promise<void> } };

export function currentSync(): SyncRun | null {
  return g.__trackerSync?.run ?? null;
}

function toCommit(c: GhCommit): CommitInfo {
  return {
    sha: c.sha,
    message: c.commit.message.split('\n')[0].slice(0, 200),
    author: c.author?.login || c.commit.author?.name || 'unknown',
    date: c.commit.author?.date || c.commit.committer?.date || new Date(0).toISOString(),
    url: c.html_url,
    bot: isBot(c.author?.login, c.author?.type, c.commit.author?.name),
  };
}

export function refreshDerived(r: TrackedRepo, now = Date.now(), thresholds = getDb().settings.thresholds) {
  const human = r.recentCommits.find(c => !c.bot);
  r.botOnly = !human && r.recentCommits.length > 0;
  r.lastActivityAt = human?.date ?? r.lastCommit?.date ?? r.pushedAt ?? r.createdAt;
  r.idleDays = idleDaysSince(r.lastActivityAt, now);
  r.status = classify(r.idleDays, r.archived, thresholds);
  r.scoreBreakdown = resurrectionScore(r, r.idleDays, getDb().deep[r.id]);
  r.resurrectionScore = r.scoreBreakdown?.total ?? 0;
}

function fromRemote(gh: GhRepo, prev: TrackedRepo | undefined, nowIso: string): TrackedRepo {
  const base: TrackedRepo = prev ?? {
    id: String(gh.id), fullName: gh.full_name, name: gh.name, owner: gh.owner.login, description: '',
    htmlUrl: gh.html_url, private: gh.private, fork: gh.fork, archived: gh.archived, language: null,
    topics: [], stars: 0, forks: 0, openIssues: 0, sizeKb: 0, defaultBranch: gh.default_branch,
    createdAt: gh.created_at, pushedAt: null, lastCommit: null, recentCommits: [], commitsCheckedFor: null,
    lastActivityAt: gh.created_at, botOnly: false, status: 'active', idleDays: 0, resurrectionScore: 0, scoreBreakdown: null, license: null,
    tracking: 'auto', missing: false, firstSeenAt: nowIso, lastSeenAt: nowIso,
  };
  return {
    ...base,
    fullName: gh.full_name, name: gh.name, owner: gh.owner.login, description: gh.description ?? '',
    htmlUrl: gh.html_url, private: gh.private, fork: gh.fork, archived: gh.archived, language: gh.language,
    topics: gh.topics ?? [], license: gh.license?.spdx_id && gh.license.spdx_id !== 'NOASSERTION' ? gh.license.spdx_id : gh.license ? gh.license.name : null, stars: gh.stargazers_count, forks: gh.forks_count, openIssues: gh.open_issues_count,
    sizeKb: gh.size, defaultBranch: gh.default_branch, pushedAt: gh.pushed_at, missing: false, lastSeenAt: nowIso,
  };
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>, stop: () => boolean) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length && !stop()) await fn(items[i++]);
    }),
  );
}

/** Starts a sync unless one is already running; returns the (possibly existing) run. */
export function startSync(trigger: SyncRun['trigger']): SyncRun {
  if (g.__trackerSync?.run.state === 'running') return g.__trackerSync.run;
  const run: SyncRun = {
    id: crypto.randomUUID(), trigger, state: 'running', startedAt: new Date().toISOString(),
    phase: 'listing', total: 0, done: 0, reposSeen: 0, newCommits: 0, eventsCreated: 0, errors: [],
  };
  const promise = execute(run).catch(e => {
    run.state = 'failed';
    run.errors.push(e?.message || String(e));
    run.finishedAt = new Date().toISOString();
    const db = getDb();
    db.lastSync = run;
    db.syncHistory = [...db.syncHistory.slice(-19), run];
    saveDb();
  });
  g.__trackerSync = { run, promise };
  return run;
}

async function execute(run: SyncRun): Promise<void> {
  const db = getDb();
  if (!db.connection || db.connection.status !== 'ok') throw new Error('GitHub is not connected.');

  const client = new GitHubClient(decryptSecret(db.connection.tokenEnc));
  const nowIso = new Date().toISOString();
  const now = Date.now();
  const events: TrackerEvent[] = [];
  const emit = (type: EventType, r: TrackedRepo | null, message: string, data?: Record<string, unknown>) =>
    events.push({ id: crypto.randomUUID(), at: new Date().toISOString(), type, repoId: r?.id ?? null, fullName: r?.fullName ?? null, message, data });
  const isBaseline = db.baselineDoneAt === null;

  try {
    // 1. Inventory
    // Conditional poll of page 1 (304 = free). A full re-list still happens every 6 h so
    // star/metadata changes on later pages are reconciled.
    const justAdded = new Set<string>();
    const fullDue = !db.lastFullListAt || now - new Date(db.lastFullListAt).getTime() > FULL_LIST_EVERY_MS;
    let listed = await client.listRepos(db.etags['repos:page1']);
    if (listed.repos === null && fullDue) listed = await client.listRepos();
    const remote = listed.repos;

    if (remote) {
      const seen = new Set<string>();
      for (const gh of remote) {
        const id = String(gh.id);
        seen.add(id);
        const prev = db.repos[id];
        const next = fromRemote(gh, prev, nowIso);
        if (!prev) {
          justAdded.add(id);
          if (!isBaseline) emit('repo_added', next, `New repository ${next.fullName}`);
        } else {
          if (!prev.archived && next.archived) emit('archived', next, `${next.fullName} was archived`);
          if (prev.archived && !next.archived) emit('unarchived', next, `${next.fullName} was unarchived`);
          if (next.stars !== prev.stars && Math.abs(next.stars - prev.stars) >= 1 && !isBaseline) {
            emit('stars', next, `${next.fullName} ${next.stars > prev.stars ? 'gained' : 'lost'} ${Math.abs(next.stars - prev.stars)} star(s) (now ${next.stars})`, { from: prev.stars, to: next.stars });
          }
        }
        db.repos[id] = next;
      }

      for (const r of Object.values(db.repos)) {
        if (!seen.has(r.id) && !r.missing) {
          r.missing = true;
          emit('repo_removed', r, `${r.fullName} is no longer visible (deleted, transferred, or access removed)`);
        }
      }
      if (listed.etag) db.etags['repos:page1'] = listed.etag;
      db.lastFullListAt = nowIso;
    }
    run.reposSeen = Object.values(db.repos).filter(r => !r.missing).length;
    const needCommits = Object.values(db.repos).filter(
      r => !r.missing && r.tracking !== 'ignored' && r.pushedAt && r.commitsCheckedFor !== r.pushedAt,
    );

    // 2. Incremental commit fetch: only repos whose pushed_at moved
    run.phase = 'commits';
    run.total = needCommits.length;
    let rateStop = false;
    await pool(needCommits, COMMIT_CONCURRENCY, async r => {
      if (client.lastRate && client.lastRate.remaining < RATE_FLOOR) { rateStop = true; return; }
      try {
        const prevSha = r.lastCommit?.sha;
        const raw = await client.listCommits(r.fullName, r.defaultBranch, {
          since: r.lastCommit?.date, perPage: r.lastCommit ? 30 : RECENT_COMMITS_KEPT,
        });
        const commits = raw.map(toCommit);
        const fresh = prevSha ? commits.filter(c => c.sha !== prevSha) : commits;
        if (commits.length) {
          r.lastCommit = commits[0];
          r.recentCommits = [...commits, ...r.recentCommits.filter(o => !commits.some(c => c.sha === o.sha))].slice(0, RECENT_COMMITS_KEPT);
        }
        r.commitsCheckedFor = r.pushedAt;
        if (prevSha && fresh.length && !isBaseline) {
          run.newCommits += fresh.length;
          emit('commits', r, `${fresh.length} new commit${fresh.length > 1 ? 's' : ''} in ${r.fullName}: ${fresh[0].message}`, {
            count: fresh.length, commits: fresh.slice(0, 5).map(c => ({ sha: c.sha.slice(0, 7), message: c.message, author: c.author, url: c.url })),
          });
        }
      } catch (e) {
        if (e instanceof GitHubError && (e.code === 'rate_limited' || e.code === 'unauthorized')) throw e;
        run.errors.push(`${r.fullName}: ${(e as Error).message}`);
      } finally {
        run.done++;
      }
    }, () => rateStop);

    // 3. Recompute status for everything; emit transitions (time moves even when repos don't)
    run.phase = 'finalizing';
    for (const r of Object.values(db.repos)) {
      const before = r.status;
      refreshDerived(r, now);
      if (!isBaseline && !justAdded.has(r.id) && before !== r.status && r.status !== 'archived' && before !== 'archived') {
        const worse = STATUS_RANK[r.status] > STATUS_RANK[before];
        emit('status_change', r, worse
          ? `${r.fullName} went ${r.status} (${r.idleDays} days idle)`
          : `${r.fullName} is back to ${r.status}`, { from: before, to: r.status, idleDays: r.idleDays });
      }
    }

    if (isBaseline) {
      emit('baseline', null, `Connected. Indexed ${run.reposSeen} repositories as the starting point for change tracking.`, { repos: run.reposSeen });
      db.baselineDoneAt = nowIso;
    }

    run.state = rateStop ? 'partial' : run.errors.length ? 'partial' : 'completed';
    if (rateStop) run.errors.push('Stopped early to stay under the GitHub rate limit; the rest will sync next run.');
  } catch (e) {
    if (e instanceof GitHubError && e.code === 'unauthorized' && db.connection) db.connection.status = 'invalid';
    if (e instanceof GitHubError && e.code === 'rate_limited') {
      run.state = 'partial';
      run.errors.push(`${e.message} Resets at ${new Date(e.resetAt || Date.now()).toISOString()}.`);
    } else {
      run.state = 'failed';
      run.errors.push((e as Error).message);
    }
  } finally {
    if (client.lastRate) run.rateLimit = { remaining: client.lastRate.remaining, resetAt: new Date(client.lastRate.resetAt).toISOString() };
    run.phase = 'done';
    run.finishedAt = new Date().toISOString();
    run.eventsCreated = events.length;
    db.events.push(...events);
    db.lastSync = run;
    db.syncHistory = [...db.syncHistory.slice(-19), run];
    saveDb();
  }
}
