'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Github, RefreshCw, Loader2, KeyRound, Star, GitCommit, Skull, Pin, EyeOff, Search,
  AlertTriangle, ExternalLink, Unplug, Sparkles, Lock, Archive, Clock,
} from 'lucide-react';
import type { ActivityStatus, SyncRun, TrackedRepo, TrackerEvent } from '@/lib/github/types';

type Connection =
  | { connected: false }
  | { connected: true; login: string; name: string | null; avatarUrl: string; tokenHint: string; status: 'ok' | 'invalid' };

interface Summary {
  total: number;
  counts: Record<ActivityStatus, number>;
  candidates: TrackedRepo[];
  commitsThisWeek: number;
}

const STATUS_META: Record<ActivityStatus, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'text-life border-life/40 bg-life/10' },
  cooling: { label: 'Cooling', cls: 'text-pumpkin border-pumpkin/30 bg-pumpkin/5' },
  dormant: { label: 'Dormant', cls: 'text-pumpkin border-pumpkin/50 bg-pumpkin/10' },
  deep_sleep: { label: 'Deep sleep', cls: 'text-crimson border-crimson/40 bg-crimson/10' },
  archived: { label: 'Archived', cls: 'text-textMuted border-border bg-panelElevated' },
};

const idleText = (d: number) =>
  d < 1 ? 'today' : d < 30 ? `${d}d ago` : d < 365 ? `${Math.round(d / 30)}mo ago` : `${(d / 365).toFixed(1)}y ago`;

const ago = (iso: string) => idleText(Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

async function j<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.error || 'Request failed');
  return data;
}

export default function TrackerPage() {
  const [conn, setConn] = useState<Connection | null>(null);
  const [sync, setSync] = useState<SyncRun | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [repos, setRepos] = useState<TrackedRepo[]>([]);
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityStatus | 'all'>('all');
  const [sort, setSort] = useState<'activity' | 'idle' | 'stars' | 'score'>('activity');
  const [q, setQ] = useState('');

  const running = sync?.state === 'running';

  const loadData = useCallback(async () => {
    const params = new URLSearchParams({ sort });
    if (filter !== 'all') params.set('status', filter);
    if (q.trim()) params.set('q', q.trim());
    const [s, r, e] = await Promise.all([
      j<Summary>('/api/github/summary'),
      j<{ repos: TrackedRepo[] }>(`/api/github/repos?${params}`),
      j<{ events: TrackerEvent[] }>('/api/github/events?limit=30'),
    ]);
    setSummary(s);
    setRepos(r.repos);
    setEvents(e.events);
  }, [filter, sort, q]);

  const loadStatus = useCallback(async () => {
    const [c, s] = await Promise.all([
      j<{ connection: Connection }>('/api/github/connection'),
      j<{ sync: SyncRun | null }>('/api/github/sync'),
    ]);
    setConn(c.connection);
    setSync(s.sync);
    return c.connection;
  }, []);

  useEffect(() => {
    loadStatus().then(c => { if (c.connected) return loadData(); }).catch(e => setError(e.message));
  }, [loadStatus, loadData]);

  // Poll while a sync runs, then refresh the data once it finishes
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      const s = await j<{ sync: SyncRun | null }>('/api/github/sync').catch(() => null);
      if (s) {
        setSync(s.sync);
        if (s.sync?.state !== 'running') loadData();
      }
    }, 1200);
    return () => clearInterval(t);
  }, [running, loadData]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await j<{ connection: Connection }>('/api/github/connection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      });
      setConn(r.connection);
      setToken('');
      await loadStatus();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setError(null);
    try {
      const r = await j<{ run: SyncRun }>('/api/github/sync', { method: 'POST' });
      setSync(r.run);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect GitHub and delete all tracked history?')) return;
    await j('/api/github/connection?purge=1', { method: 'DELETE' });
    setConn({ connected: false }); setRepos([]); setEvents([]); setSummary(null); setSync(null);
  };

  const setTracking = async (r: TrackedRepo, tracking: TrackedRepo['tracking']) => {
    const next = r.tracking === tracking ? 'auto' : tracking;
    setRepos(prev => prev.map(x => (x.id === r.id ? { ...x, tracking: next } : x)));
    await j(`/api/github/repos/${r.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tracking: next }),
    }).catch(e => setError(e.message));
  };

  const visible = useMemo(() => repos, [repos]);

  if (!conn) return <div className="py-24 text-center font-mono text-xs text-textMuted">Loading tracker…</div>;

  /* ---------- Not connected / invalid ---------- */
  if (!conn.connected || conn.status === 'invalid') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 font-mono space-y-6">
        <div className="text-center space-y-3">
          <Github className="w-10 h-10 text-life mx-auto" />
          <h1 className="text-3xl font-extrabold text-textMain">Track every repo you own.</h1>
          <p className="text-sm text-textMuted font-sans leading-relaxed">
            Connect GitHub once. We index all your repositories, watch for new commits, and surface the ones you
            have quietly abandoned, ranked by how much they deserve a second life.
          </p>
        </div>

        {conn.connected && conn.status === 'invalid' && (
          <div className="p-3 rounded-lg bg-crimson/10 border border-crimson/30 text-crimson text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> GitHub rejected your saved token. Paste a new one to resume tracking.
          </div>
        )}

        <div className="p-5 rounded-xl border border-border bg-panel space-y-4">
          <label className="text-xs text-textMain font-bold flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-life" /> GitHub personal access token
          </label>
          <input
            type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="off"
            onKeyDown={e => e.key === 'Enter' && token && connect()}
            placeholder="github_pat_… or ghp_…"
            className="w-full px-3 py-3 bg-void border border-border rounded-lg text-sm focus:outline-none focus:border-life"
          />
          <button
            onClick={connect} disabled={busy || token.length < 20}
            className="w-full py-3 rounded-lg bg-life text-void font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />} Connect &amp; index my repos
          </button>
          {error && <p className="text-xs text-crimson">{error}</p>}
          <ul className="text-[11px] text-textMuted font-sans space-y-1 list-disc pl-4">
            <li>
              Create a <a className="text-life underline" target="_blank" rel="noreferrer"
                href="https://github.com/settings/personal-access-tokens/new">fine-grained token</a> with{' '}
              <b>read-only</b> access to Contents and Metadata (or a classic token with <code>repo</code> for private repos).
            </li>
            <li>The token is encrypted (AES-256-GCM) on your machine and never sent to your browser again.</li>
            <li>Nothing is written to GitHub. This tool only reads.</li>
          </ul>
        </div>
      </div>
    );
  }

  /* ---------- Dashboard ---------- */
  const counts = summary?.counts;
  const tiles: { key: ActivityStatus; hint: string }[] = [
    { key: 'active', hint: '≤ 30 days' }, { key: 'cooling', hint: '31–90 days' }, { key: 'dormant', hint: '91–180 days' },
    { key: 'deep_sleep', hint: '> 180 days' }, { key: 'archived', hint: 'read-only on GitHub' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <img src={conn.avatarUrl} alt="" className="w-10 h-10 rounded-full border border-border" />
          <div>
            <h1 className="text-xl font-bold text-textMain">@{conn.login}<span className="text-life">_</span></h1>
            <p className="text-[11px] text-textMuted flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {running ? 'Syncing now…' : sync?.finishedAt ? `Last synced ${ago(sync.finishedAt)}` : 'Not synced yet'}
              {summary && ` · ${summary.total} repos · ${summary.commitsThisWeek} commits this week`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={syncNow} disabled={running}
            className="px-4 py-2.5 rounded-lg bg-life text-void font-bold text-xs flex items-center gap-2 disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
            {running ? (sync!.phase === 'commits' ? `Checking commits ${sync!.done}/${sync!.total}` : 'Syncing…') : 'Sync now'}
          </button>
          <button onClick={disconnect} title="Disconnect" className="p-2.5 rounded-lg border border-border text-textMuted hover:text-crimson hover:border-crimson/50">
            <Unplug className="w-4 h-4" />
          </button>
        </div>
      </div>

      {(error || (sync && sync.errors.length > 0 && !running)) && (
        <div className="p-3 rounded-lg bg-pumpkin/10 border border-pumpkin/30 text-pumpkin text-xs space-y-1">
          {error && <div>{error}</div>}
          {!running && sync?.errors.slice(0, 3).map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* Health tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tiles.map(t => (
          <button key={t.key} onClick={() => setFilter(filter === t.key ? 'all' : t.key)}
            className={`p-4 rounded-xl border text-left transition-all ${filter === t.key ? 'border-life bg-panelElevated' : 'border-border bg-panel hover:border-life/40'}`}>
            <div className={`text-2xl font-bold ${STATUS_META[t.key].cls.split(' ')[0]}`}>{counts?.[t.key] ?? 0}</div>
            <div className="text-xs text-textMain">{STATUS_META[t.key].label}</div>
            <div className="text-[10px] text-textMuted">{t.hint}</div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Forgotten gems */}
        <section className="lg:col-span-2 p-5 rounded-xl border border-border bg-panel space-y-3">
          <h2 className="text-xs uppercase tracking-wider font-bold text-textMain flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pumpkin" /> Forgotten gems worth reviving <span className="text-[10px] text-textMuted normal-case">(heuristic)</span>
          </h2>
          {summary?.candidates.length ? summary.candidates.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-void border border-border">
              <div className="min-w-0">
                <Link href={`/tracker/${r.id}`} className="text-sm font-bold text-textMain hover:text-life truncate block">{r.fullName}</Link>
                <p className="text-[11px] text-textMuted truncate font-sans">{r.description || 'No description'}</p>
              </div>
              <div className="text-right shrink-0 text-[11px]">
                <div className="text-crimson">idle {idleText(r.idleDays).replace(' ago', '')}</div>
                <div className="text-textMuted flex items-center gap-1 justify-end"><Star className="w-3 h-3" />{r.stars} · score {r.resurrectionScore}</div>
              </div>
            </div>
          )) : (
            <p className="text-xs text-textMuted font-sans py-4">Nothing abandoned yet. Repos idle for 6+ months show up here, ranked by interest and revival timing. Open one for the score breakdown.</p>
          )}
        </section>

        {/* Change feed */}
        <section className="p-5 rounded-xl border border-border bg-panel space-y-3 max-h-[26rem] overflow-auto">
          <h2 className="text-xs uppercase tracking-wider font-bold text-textMain flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-life" /> What changed
          </h2>
          {events.length ? events.map(e => (
            <div key={e.id} className="text-[11px] border-l-2 border-border pl-3 space-y-0.5">
              <div className="text-textMain font-sans leading-snug">{e.message}</div>
              <div className="text-textMuted">{ago(e.at)}</div>
            </div>
          )) : <p className="text-xs text-textMuted font-sans">Changes will appear here after the next sync.</p>}
        </section>
      </div>

      {/* Repo table */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search repos, descriptions, topics…"
              className="w-full pl-9 pr-3 py-2.5 bg-panel border border-border rounded-lg text-xs focus:outline-none focus:border-life" />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value as any)}
            className="px-3 py-2.5 bg-panel border border-border rounded-lg text-xs">
            <option value="activity">Most recently active</option>
            <option value="idle">Longest idle</option>
            <option value="stars">Most stars</option>
            <option value="score">Revival score</option>
          </select>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="text-xs text-life underline">clear: {filter}</button>
          )}
        </div>

        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border bg-panel">
          {visible.length === 0 && (
            <div className="p-8 text-center text-xs text-textMuted">{running ? 'Indexing your repositories…' : 'No repositories match.'}</div>
          )}
          {visible.map(r => (
            <div key={r.id} className={`p-4 flex flex-wrap items-center justify-between gap-3 ${r.tracking === 'ignored' ? 'opacity-50' : ''}`}>
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/tracker/${r.id}`} className="text-sm font-bold text-textMain hover:text-life">{r.fullName}</Link>
                  <a href={r.htmlUrl} target="_blank" rel="noreferrer" title="Open on GitHub"><ExternalLink className="w-3 h-3 opacity-50 hover:opacity-100" /></a>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_META[r.status].cls}`}>{STATUS_META[r.status].label}</span>
                  {r.private && <Lock className="w-3 h-3 text-textMuted" />}
                  {r.archived && <Archive className="w-3 h-3 text-textMuted" />}
                  {r.fork && <span className="text-[10px] text-textMuted">fork</span>}
                  {r.botOnly && <span className="text-[10px] text-pumpkin" title="Recent commits are all from automation">bots only</span>}
                  {r.status === 'deep_sleep' && <Skull className="w-3 h-3 text-crimson" />}
                </div>
                <p className="text-[11px] text-textMuted truncate font-sans mt-0.5">
                  {r.lastCommit ? <>“{r.lastCommit.message}” by {r.lastCommit.author}</> : r.description || 'No description'}
                </p>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-textMuted">
                {r.language && <span>{r.language}</span>}
                <span className="flex items-center gap-1"><Star className="w-3 h-3" />{r.stars}</span>
                <span className={r.idleDays > 180 ? 'text-crimson' : ''}>{idleText(r.idleDays)}</span>
                <button onClick={() => setTracking(r, 'pinned')} title="Pin"
                  className={`p-1.5 rounded border ${r.tracking === 'pinned' ? 'border-life text-life' : 'border-border hover:border-life/50'}`}>
                  <Pin className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setTracking(r, 'ignored')} title="Stop tracking"
                  className={`p-1.5 rounded border ${r.tracking === 'ignored' ? 'border-crimson text-crimson' : 'border-border hover:border-crimson/50'}`}>
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
