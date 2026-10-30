'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, ExternalLink, GitCommit, GitPullRequest, CircleDot, Tag, Loader2, Sparkles, Ghost,
  Star, ScanSearch, ShieldCheck, AlertTriangle, CheckCircle2, HelpCircle, Lightbulb,
} from 'lucide-react';
import type { AiAnalysis, AnalysisStep, DeepScan, TrackedRepo } from '@/lib/github/types';

interface TimelineItem { at: string; kind: 'commit' | 'pull_request' | 'issue' | 'release'; title: string; author?: string; url?: string; bot?: boolean; meta?: string }
interface Payload { repo: TrackedRepo; timeline: TimelineItem[]; deep: DeepScan | null; plan: AnalysisStep[]; analysis: AiAnalysis | null }

const KIND = {
  commit: { icon: GitCommit, cls: 'text-life' },
  pull_request: { icon: GitPullRequest, cls: 'text-pumpkin' },
  issue: { icon: CircleDot, cls: 'text-crimson' },
  release: { icon: Tag, cls: 'text-textMain' },
} as const;

const STATUS_CLS: Record<string, string> = {
  confirmed: 'text-life border-life/40 bg-life/10',
  inferred: 'text-pumpkin border-pumpkin/40 bg-pumpkin/10',
  unknown: 'text-textMuted border-border bg-panelElevated',
};

const day = (iso: string) => iso.slice(0, 10);

async function j<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.error || 'Request failed');
  return data;
}

export default function RepoDetailPage() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(() => j<Payload>(`/api/github/repos/${id}/timeline`).then(setData).catch(e => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const analysis = data?.analysis;
  const running = analysis?.status === 'running';

  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [running, load]);

  const scan = async () => {
    setScanning(true); setError(null);
    try { await j(`/api/github/repos/${id}/scan`, { method: 'POST' }); await load(); }
    catch (e: any) { setError(e.message); }
    finally { setScanning(false); }
  };

  const analyze = async (force = false) => {
    setError(null);
    try { await j(`/api/github/repos/${id}/analyze${force ? '?force=1' : ''}`, { method: 'POST' }); await load(); }
    catch (e: any) { setError(e.message); }
  };

  if (!data) return <div className="py-24 text-center font-mono text-xs text-textMuted">{error || 'Loading…'}</div>;

  const { repo, timeline, deep, plan } = data;
  const b = repo.scoreBreakdown;
  const evById = new Map((analysis?.evidence ?? []).map(e => [e.id, e]));
  const result = analysis?.status === 'completed' ? analysis.result : undefined;

  const Cite = ({ ids }: { ids: string[] }) => (
    <span className="inline-flex flex-wrap gap-1 ml-1">
      {ids.map(i => {
        const e = evById.get(i);
        return e?.url
          ? <a key={i} href={e.url} target="_blank" rel="noreferrer" title={`${e.label}: ${e.text.slice(0, 120)}`} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-life hover:border-life">{i}</a>
          : <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-textMuted">{i}</span>;
      })}
    </span>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-mono">
      <Link href="/tracker" className="text-xs text-textMuted hover:text-life flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> All repositories</Link>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-textMain flex items-center gap-2">
            {repo.fullName}
            <a href={repo.htmlUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 opacity-50 hover:opacity-100" /></a>
          </h1>
          <p className="text-xs text-textMuted font-sans mt-1 max-w-2xl">{repo.description || 'No description'}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-textMuted">
            <span className="px-2 py-0.5 rounded border border-border text-life uppercase">{repo.status.replace('_', ' ')}</span>
            <span>last human commit {day(repo.lastActivityAt)} ({repo.idleDays} days ago)</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3" />{repo.stars}</span>
            {repo.botOnly && <span className="text-pumpkin">recent commits are all bots</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={scan} disabled={scanning} className="px-3.5 py-2.5 rounded-lg border border-border bg-panel hover:border-life/50 text-xs flex items-center gap-2 disabled:opacity-60">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4 text-life" />} {deep ? 'Rescan PRs, issues, releases' : 'Scan PRs, issues, releases'}
          </button>
          <button onClick={() => analyze(!!analysis)} disabled={running} className="px-4 py-2.5 rounded-lg bg-life text-void font-bold text-xs flex items-center gap-2 disabled:opacity-60">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ghost className="w-4 h-4" />} {analysis ? 'Re-run Ghost analysis' : 'Ghost analysis (local AI)'}
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-crimson/10 border border-crimson/30 text-crimson text-xs">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Score breakdown */}
        <section className="p-5 rounded-xl border border-border bg-panel space-y-3">
          <h2 className="text-xs uppercase tracking-wider font-bold text-textMain flex items-center gap-2"><Sparkles className="w-4 h-4 text-pumpkin" /> Revival score <span className="text-[10px] text-textMuted normal-case">heuristic</span></h2>
          {b ? (
            <>
              <div className="text-4xl font-bold text-pumpkin">{b.total}</div>
              <div className="text-[11px] text-textMuted space-y-1">
                <div>interest {b.value} + feasibility {b.feasibility}</div>
                <div>× timing {b.timing} × fork {b.forkPenalty}</div>
              </div>
              <ul className="text-[11px] text-textMuted font-sans space-y-1 list-disc pl-4">{b.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              <p className="text-[10px] text-textMuted font-sans border-t border-border pt-2">Not a probability. No study validates a revival predictor; timing follows research showing most revivals happen within 1–2 years.</p>
            </>
          ) : <p className="text-xs text-textMuted font-sans">Scored only for non-archived repos idle 6+ months. This one is {repo.status === 'archived' ? 'archived' : 'still recent'}.</p>}
        </section>

        {/* Plan */}
        <section className="lg:col-span-2 p-5 rounded-xl border border-border bg-panel space-y-3">
          <h2 className="text-xs uppercase tracking-wider font-bold text-textMain flex items-center gap-2"><Lightbulb className="w-4 h-4 text-life" /> Revival plan from facts <span className="text-[10px] text-textMuted normal-case">rules, no AI</span></h2>
          {plan.map((s, i) => (
            <div key={i} className="p-3 rounded-lg bg-void border border-border space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-textMain font-bold">{i + 1}. {s.title}</span>
                <span className="flex gap-2 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded border ${s.kind === 'found' ? STATUS_CLS.confirmed : STATUS_CLS.inferred}`}>{s.kind}</span>
                  <span className="px-1.5 py-0.5 rounded border border-border text-textMuted">effort {s.effort}</span>
                </span>
              </div>
              <p className="text-[11px] text-textMuted font-sans">{s.why}</p>
              {s.evidenceIds.length > 0 && <p className="text-[10px] text-life/80">evidence: {s.evidenceIds.join(' · ')}</p>}
            </div>
          ))}
          {!deep && <p className="text-[11px] text-textMuted font-sans">Run a scan to include open PRs, issues, releases and README in this plan.</p>}
        </section>
      </div>

      {/* Ghost analysis */}
      {analysis && (
        <section className="p-5 rounded-xl border border-border bg-panel space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs uppercase tracking-wider font-bold text-textMain flex items-center gap-2"><Ghost className="w-4 h-4 text-life" /> Ghost memory <span className="text-[10px] text-textMuted normal-case">{analysis.model || 'local model'}</span></h2>
            {result && <span className="text-[10px] text-textMuted flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-life" />{result.verification.confirmed}/{result.verification.claims} claims quote-verified · {result.verification.downgraded} downgraded · {result.verification.dropped} dropped</span>}
          </div>
          {running && <p className="text-xs text-textMuted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Reading the repository evidence with your local model…</p>}
          {analysis.status === 'failed' && <p className="text-xs text-crimson flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{analysis.error}</p>}
          {analysis.truncated && <p className="text-[11px] text-pumpkin">The evidence filled the model's context window; some of it may have been ignored.</p>}
          {result && (
            <div className="space-y-4 text-xs">
              {([['What it was for', result.purpose], ['Where development stopped', result.whereItStopped]] as const).map(([label, c]) => (
                <div key={label} className="space-y-1">
                  <div className="text-[10px] uppercase text-textMuted">{label}</div>
                  <p className="font-sans text-sm text-textMain leading-relaxed">
                    {c.text} <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_CLS[c.status]}`}>{c.status}</span><Cite ids={c.evidenceIds} />
                  </p>
                  {c.quoteVerified && <p className="text-[11px] text-life/80 border-l-2 border-life/40 pl-2">“{c.quote}”</p>}
                  {c.note && <p className="text-[10px] text-pumpkin">{c.note}</p>}
                </div>
              ))}
              {result.unfinishedWork.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase text-textMuted">Possibly unfinished</div>
                  {result.unfinishedWork.map((c, i) => (
                    <p key={i} className="font-sans text-sm text-textMain">• {c.text} <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_CLS[c.status]}`}>{c.status}</span><Cite ids={c.evidenceIds} /></p>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <div className="text-[10px] uppercase text-textMuted">AI revival plan</div>
                {result.revivalPlan.map((s, i) => (
                  <div key={i} className="p-3 rounded-lg bg-void border border-border">
                    <div className="text-sm text-textMain font-bold">{i + 1}. {s.title} <span className="text-[10px] text-textMuted font-normal">effort {s.effort}</span> <span className={`text-[10px] px-1.5 py-0.5 rounded border ${s.kind === 'found' ? STATUS_CLS.confirmed : STATUS_CLS.inferred}`}>{s.kind}</span></div>
                    <p className="text-[11px] text-textMuted font-sans mt-1">{s.why}<Cite ids={s.evidenceIds} /></p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-textMuted font-sans border-t border-border pt-2 flex items-start gap-1.5"><HelpCircle className="w-3 h-3 shrink-0 mt-0.5" />“confirmed” means the quote was found verbatim in the cited GitHub data. It does not prove the model read it correctly. “inferred” is the model's reading; treat it as a lead, not a fact.</p>
            </div>
          )}
        </section>
      )}

      {/* Timeline */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider font-bold text-textMain">Timeline</h2>
        <div className="rounded-xl border border-border bg-panel divide-y divide-border">
          {timeline.length === 0 && <div className="p-6 text-xs text-textMuted text-center">No history fetched yet. Run a sync, then scan.</div>}
          {timeline.slice(0, 60).map((t, i) => {
            const K = KIND[t.kind];
            return (
              <div key={i} className={`p-3 flex items-start gap-3 text-xs ${t.bot ? 'opacity-50' : ''}`}>
                <K.icon className={`w-4 h-4 mt-0.5 shrink-0 ${K.cls}`} />
                <div className="min-w-0 flex-1">
                  {t.url ? <a href={t.url} target="_blank" rel="noreferrer" className="text-textMain hover:text-life font-sans break-words">{t.title}</a> : <span className="text-textMain font-sans">{t.title}</span>}
                  <div className="text-[10px] text-textMuted">{t.kind.replace('_', ' ')}{t.meta ? ` · ${t.meta}` : ''}{t.author ? ` · ${t.author}` : ''}{t.bot ? ' · bot' : ''}</div>
                </div>
                <span className="text-[10px] text-textMuted shrink-0">{day(t.at)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
