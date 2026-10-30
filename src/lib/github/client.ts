const API = process.env.LASTCOMMIT_GITHUB_API || 'https://api.github.com';
const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

export type GitHubErrorCode = 'unauthorized' | 'rate_limited' | 'forbidden' | 'not_found' | 'empty_repo' | 'network' | 'unknown';

export class GitHubError extends Error {
  constructor(message: string, public code: GitHubErrorCode, public status = 0, public resetAt?: number) {
    super(message);
  }
}

export interface RateInfo { remaining: number; resetAt: number }

export interface GhRepo {
  id: number; full_name: string; name: string; owner: { login: string }; description: string | null;
  html_url: string; private: boolean; fork: boolean; archived: boolean; language: string | null;
  topics?: string[]; stargazers_count: number; forks_count: number; open_issues_count: number;
  size: number; default_branch: string; created_at: string; pushed_at: string | null;
  license?: { spdx_id: string | null; name: string } | null;
}

export interface GhCommit {
  sha: string; html_url: string;
  commit: { message: string; author: { name: string; date: string } | null; committer: { date: string } | null };
  author: { login: string; type?: string } | null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class GitHubClient {
  lastRate: RateInfo | null = null;

  constructor(private token: string) {}

  private async request(url: string, etag?: string): Promise<{ data: any; headers: Headers; notModified: boolean }> {
    let attempt = 0;
    for (;;) {
      attempt++;
      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'the-last-commit',
            ...(etag ? { 'If-None-Match': etag } : {}),
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: 'no-store',
        });
      } catch (e: any) {
        if (attempt < MAX_ATTEMPTS) { await sleep(500 * 2 ** attempt); continue; }
        throw new GitHubError(`Network error talking to GitHub: ${e?.message || e}`, 'network');
      }

      const remaining = res.headers.get('x-ratelimit-remaining');
      const reset = res.headers.get('x-ratelimit-reset');
      if (remaining !== null && reset !== null) {
        this.lastRate = { remaining: Number(remaining), resetAt: Number(reset) * 1000 };
      }

      if (res.status === 304) return { data: null, headers: res.headers, notModified: true };
      if (res.ok) return { data: await res.json(), headers: res.headers, notModified: false };

      if (res.status === 401) throw new GitHubError('GitHub rejected the token (expired or revoked).', 'unauthorized', 401);
      if (res.status === 404) throw new GitHubError('Not found', 'not_found', 404);
      if (res.status === 409) throw new GitHubError('Repository is empty', 'empty_repo', 409);

      if (res.status === 403 || res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after'));
        if (remaining === '0') {
          throw new GitHubError('GitHub rate limit reached.', 'rate_limited', res.status, Number(reset) * 1000);
        }
        if (retryAfter > 0 && retryAfter <= 60 && attempt < MAX_ATTEMPTS) { await sleep(retryAfter * 1000); continue; }
        if (retryAfter > 0) throw new GitHubError('GitHub secondary rate limit hit.', 'rate_limited', res.status, Date.now() + retryAfter * 1000);
        throw new GitHubError('Token lacks permission for this resource.', 'forbidden', res.status);
      }

      if (res.status >= 500 && attempt < MAX_ATTEMPTS) { await sleep(500 * 2 ** attempt); continue; }
      throw new GitHubError(`GitHub returned ${res.status}`, 'unknown', res.status);
    }
  }

  async getViewer() {
    const { data, headers } = await this.request(`${API}/user`);
    return {
      login: data.login as string,
      name: (data.name as string | null) ?? null,
      avatarUrl: data.avatar_url as string,
      scopes: (headers.get('x-oauth-scopes') || '').split(',').map(s => s.trim()).filter(Boolean),
    };
  }

  /**
   * Every repo the user can see, following pagination (capped at 2,000 repos).
   * Page 1 is requested conditionally: if `etag` still matches, GitHub answers 304
   * (free against the rate limit) and `repos` is null.
   */
  async listRepos(etag?: string): Promise<{ repos: GhRepo[] | null; etag: string | null }> {
    const all: GhRepo[] = [];
    let firstEtag: string | null = null;
    let url: string | null =
      `${API}/user/repos?per_page=100&sort=pushed&visibility=all&affiliation=owner,collaborator,organization_member`;
    for (let page = 0; url && page < 20; page++) {
      const res: { data: GhRepo[]; headers: Headers; notModified: boolean } = await this.request(url, page === 0 ? etag : undefined);
      if (page === 0) {
        if (res.notModified) return { repos: null, etag: etag ?? null };
        firstEtag = res.headers.get('etag');
      }
      all.push(...res.data);
      const next = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') || '')?.[1] ?? null;
      url = next && next.startsWith(`${API}/`) ? next : null; // never follow a link off api.github.com
    }
    return { repos: all, etag: firstEtag };
  }

  async listCommits(fullName: string, branch: string, opts: { since?: string; perPage: number }): Promise<GhCommit[]> {
    const q = new URLSearchParams({ sha: branch, per_page: String(opts.perPage) });
    if (opts.since) q.set('since', opts.since);
    try {
      const { data } = await this.request(`${API}/repos/${fullName}/commits?${q}`);
      return data;
    } catch (e) {
      if (e instanceof GitHubError && (e.code === 'empty_repo' || e.code === 'not_found')) return [];
      throw e;
    }
  }

  private async optionalList(path: string): Promise<any[]> {
    try {
      const { data } = await this.request(`${API}${path}`);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      if (e instanceof GitHubError && (e.code === 'not_found' || e.code === 'empty_repo')) return [];
      throw e;
    }
  }

  listOpenPulls(fullName: string) {
    return this.optionalList(`/repos/${fullName}/pulls?state=open&sort=updated&direction=desc&per_page=30`);
  }

  /** The issues endpoint also returns pull requests; callers filter on `pull_request`. */
  listOpenIssues(fullName: string) {
    return this.optionalList(`/repos/${fullName}/issues?state=open&sort=updated&direction=desc&per_page=50`);
  }

  listReleases(fullName: string) {
    return this.optionalList(`/repos/${fullName}/releases?per_page=5`);
  }

  async getReadme(fullName: string): Promise<string | null> {
    try {
      const { data } = await this.request(`${API}/repos/${fullName}/readme`);
      return data?.encoding === 'base64' ? Buffer.from(data.content, 'base64').toString('utf8') : null;
    } catch (e) {
      if (e instanceof GitHubError && e.code === 'not_found') return null;
      throw e;
    }
  }
}
