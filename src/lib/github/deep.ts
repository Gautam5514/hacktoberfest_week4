import { getDb, saveDb } from './db';
import { decryptSecret } from './crypto';
import { GitHubClient, GitHubError } from './client';
import { redactSecrets } from './redact';
import type { DeepScan } from './types';

const README_MAX = 6000;

/** Fetches open PRs, open issues, releases and the README for one repo (4 requests). */
export async function runDeepScan(repoId: string): Promise<DeepScan> {
  const db = getDb();
  const repo = db.repos[repoId];
  if (!repo) throw new Error('Repository not found');
  if (!db.connection || db.connection.status !== 'ok') throw new Error('GitHub is not connected.');
  const client = new GitHubClient(decryptSecret(db.connection.tokenEnc));

  const errors: string[] = [];
  const guard = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch (e) {
      if (e instanceof GitHubError && e.code === 'unauthorized') throw e;
      errors.push(`${label}: ${(e as Error).message}`);
      return fallback;
    }
  };

  const [pulls, issues, releases, readme] = await Promise.all([
    guard('pull requests', () => client.listOpenPulls(repo.fullName), [] as any[]),
    guard('issues', () => client.listOpenIssues(repo.fullName), [] as any[]),
    guard('releases', () => client.listReleases(repo.fullName), [] as any[]),
    guard('readme', () => client.getReadme(repo.fullName), null as string | null),
  ]);

  const text = readme ? redactSecrets(readme) : null;
  const scan: DeepScan = {
    scannedAt: new Date().toISOString(),
    pulls: pulls.map(p => ({ number: p.number, title: String(p.title).slice(0, 200), author: p.user?.login ?? 'unknown', updatedAt: p.updated_at, draft: !!p.draft, url: p.html_url })),
    issues: issues.filter(i => !i.pull_request).map(i => ({ number: i.number, title: String(i.title).slice(0, 200), author: i.user?.login ?? 'unknown', updatedAt: i.updated_at, labels: (i.labels || []).map((l: any) => (typeof l === 'string' ? l : l.name)).slice(0, 5), url: i.html_url })),
    releases: releases.map(r => ({ tag: r.tag_name, name: String(r.name || r.tag_name).slice(0, 120), publishedAt: r.published_at, url: r.html_url })),
    readme: text ? { text: text.slice(0, README_MAX), truncated: text.length > README_MAX } : null,
    errors,
  };
  db.deep[repoId] = scan;
  saveDb();
  return scan;
}

export interface TimelineItem { at: string; kind: 'commit' | 'pull_request' | 'issue' | 'release'; title: string; author?: string; url?: string; bot?: boolean; meta?: string }

/** Merges everything we know about a repo into one newest-first timeline. */
export function buildTimeline(repoId: string): TimelineItem[] {
  const db = getDb();
  const repo = db.repos[repoId];
  if (!repo) return [];
  const deep = db.deep[repoId];
  const items: TimelineItem[] = repo.recentCommits.map(c => ({ at: c.date, kind: 'commit', title: c.message, author: c.author, url: c.url, bot: c.bot, meta: c.sha.slice(0, 7) }));
  if (deep) {
    items.push(...deep.pulls.map(p => ({ at: p.updatedAt, kind: 'pull_request' as const, title: `#${p.number} ${p.title}`, author: p.author, url: p.url, meta: p.draft ? 'draft, open' : 'open' })));
    items.push(...deep.issues.map(i => ({ at: i.updatedAt, kind: 'issue' as const, title: `#${i.number} ${i.title}`, author: i.author, url: i.url, meta: 'open' })));
    items.push(...deep.releases.filter(r => r.publishedAt).map(r => ({ at: r.publishedAt!, kind: 'release' as const, title: `${r.tag} ${r.name}`.trim(), url: r.url })));
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
