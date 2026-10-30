'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Skull,
  Search,
  Stethoscope,
  Wrench,
  ShieldCheck,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  FileText,
  Layers,
  Ghost,
  RotateCcw,
} from 'lucide-react';
import type {
  Repository,
  AutopsyFinding,
  ArchitectureSummary,
  PatchProposal,
  VerificationRun,
} from '@/lib/types';

type StepState = 'idle' | 'running' | 'done' | 'error';

const STEPS = [
  { key: 'scan', icon: Search, title: 'Scan', blurb: 'Import the dead repo and read every file' },
  { key: 'autopsy', icon: Stethoscope, title: 'Autopsy', blurb: 'Find exactly why it died, with evidence' },
  { key: 'repair', icon: Wrench, title: 'Repair', blurb: 'Generate a minimal, reviewable patch' },
  { key: 'verify', icon: ShieldCheck, title: 'Prove', blurb: 'Run the tests before and after in a sandbox' },
] as const;

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'text-crimson border-crimson/40 bg-crimson/10',
  high: 'text-pumpkin border-pumpkin/40 bg-pumpkin/10',
  medium: 'text-pumpkin border-pumpkin/30 bg-pumpkin/5',
  low: 'text-textMuted border-border bg-panelElevated',
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `Request failed: ${url}`);
  return data;
}

export default function DemoPage() {
  const [states, setStates] = useState<StepState[]>(['idle', 'idle', 'idle', 'idle']);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [repo, setRepo] = useState<Repository | null>(null);
  const [findings, setFindings] = useState<AutopsyFinding[]>([]);
  const [arch, setArch] = useState<ArchitectureSummary | null>(null);
  const [patch, setPatch] = useState<PatchProposal | null>(null);
  const [verification, setVerification] = useState<VerificationRun | null>(null);
  const running = useRef(false);

  const setStep = (i: number, s: StepState) =>
    setStates(prev => prev.map((p, idx) => (idx === i ? s : p)));
  const say = (line: string) => setLog(prev => [...prev, line]);

  const reset = () => {
    setStates(['idle', 'idle', 'idle', 'idle']);
    setLog([]);
    setError(null);
    setRepo(null);
    setFindings([]);
    setArch(null);
    setPatch(null);
    setVerification(null);
  };

  const run = async () => {
    if (running.current) return;
    running.current = true;
    reset();
    let step = 0;
    try {
      // 1. Scan: import the bundled broken app (also kicks off the first autopsy)
      setStep(0, 'running');
      say('$ lastcommit import examples/broken-js-app');
      const imported = await api<{ repository: Repository }>('/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localPath: 'examples/broken-js-app', name: 'markdown-tomb-parser' }),
      });
      const id = imported.repository.id;
      setRepo(imported.repository);
      await sleep(600);
      say('✓ workspace mounted, files indexed');
      setStep(0, 'done');

      // 2. Autopsy
      step = 1;
      setStep(1, 'running');
      say('$ lastcommit autopsy --evidence');
      const detail = await api<{
        findings: AutopsyFinding[];
        architecture: ArchitectureSummary;
      }>(`/api/repositories/${id}`);
      await sleep(700);
      setFindings(detail.findings);
      setArch(detail.architecture);
      say(`✓ ${detail.findings.length} findings, health score ${detail.architecture.healthScore}/100`);
      setStep(1, 'done');

      // 3. Repair
      step = 2;
      setStep(2, 'running');
      say('$ lastcommit repair --minimal');
      const { patch: created } = await api<{ patch: PatchProposal }>(
        `/api/repositories/${id}/patches`,
        { method: 'POST' },
      );
      await sleep(700);
      setPatch(created);
      say(`✓ patch ready: ${created.files.length} file(s) changed`);
      setStep(2, 'done');

      // 4. Prove
      step = 3;
      setStep(3, 'running');
      say(`$ ${created.verificationCommand}  # before and after, in a sandbox`);
      const proved = await api<{ verification: VerificationRun }>(
        `/api/patches/${created.id}/verify`,
        { method: 'POST' },
      );
      await sleep(500);
      setVerification(proved.verification);
      say(
        proved.verification.status === 'passed'
          ? `✓ exit ${proved.verification.beforeOutcome.exitCode} → exit ${proved.verification.afterOutcome.exitCode}. Revived.`
          : '✗ patched run still failing',
      );
      setStep(3, proved.verification.status === 'passed' ? 'done' : 'error');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setStep(step, 'error');
    } finally {
      running.current = false;
    }
  };

  const started = states.some(s => s !== 'idle');
  const revived = verification?.status === 'passed';
  const topFindings = findings.slice(0, 4);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[320px] bg-life/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10 font-mono">
        {/* Header */}
        <div className="text-center space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-panel text-xs text-textMuted">
            <Ghost className="w-3.5 h-3.5 text-life" />
            <span>Guided demo · runs the real pipeline, locally</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-textMain">
            Watch dead code <span className="text-life">come back to life</span>.
          </h1>
          <p className="text-sm text-textMuted max-w-2xl mx-auto font-sans leading-relaxed">
            This app crashes on modern Node. One click: we find out why, write the smallest fix,
            and prove it with a real test run, before and after.
          </p>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {STEPS.map((s, i) => {
            const st = states[i];
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className={`p-4 rounded-xl border transition-all duration-500 ${
                  st === 'running'
                    ? 'border-life bg-panelElevated shadow-ghost'
                    : st === 'done'
                      ? 'border-life/40 bg-panel'
                      : st === 'error'
                        ? 'border-crimson/50 bg-panel'
                        : 'border-border bg-panel opacity-70'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-textMuted">0{i + 1}</span>
                  {st === 'running' ? (
                    <Loader2 className="w-4 h-4 text-life animate-spin" />
                  ) : st === 'done' ? (
                    <CheckCircle2 className="w-4 h-4 text-life" />
                  ) : st === 'error' ? (
                    <XCircle className="w-4 h-4 text-crimson" />
                  ) : (
                    <Icon className="w-4 h-4 text-textMuted" />
                  )}
                </div>
                <div className="text-sm font-bold text-textMain">{s.title}</div>
                <p className="text-[11px] text-textMuted mt-1 font-sans leading-snug">{s.blurb}</p>
              </div>
            );
          })}
        </div>

        {/* Action */}
        <div className="flex justify-center mb-8">
          <button
            onClick={run}
            disabled={states.includes('running')}
            className="px-7 py-3.5 rounded-lg bg-life hover:bg-life/90 text-void font-bold text-sm flex items-center gap-2 shadow-ghost disabled:opacity-50 transition-all"
          >
            {states.includes('running') ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Resurrecting…
              </>
            ) : started ? (
              <>
                <RotateCcw className="w-4 h-4" /> Run it again
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Resurrect the broken app
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-crimson/10 border border-crimson/30 text-crimson text-xs">
            {error}
          </div>
        )}

        {/* Live terminal */}
        {log.length > 0 && (
          <div className="mb-8 p-4 rounded-xl border border-border bg-void text-[11px] space-y-1">
            {log.map((l, i) => (
              <div key={i} className={l.startsWith('✓') ? 'text-life' : l.startsWith('✗') ? 'text-crimson' : 'text-textMuted'}>
                {l}
              </div>
            ))}
          </div>
        )}

        {/* Autopsy findings */}
        {topFindings.length > 0 && (
          <section className="mb-8 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="uppercase tracking-wider text-textMain font-bold flex items-center gap-2">
                <Skull className="w-4 h-4 text-crimson" /> Cause of death
              </span>
              {arch && (
                <span className="text-textMuted">
                  health <span className="text-pumpkin font-bold">{arch.healthScore}/100</span> · {arch.targetRuntime} → {arch.modernRuntime}
                </span>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {topFindings.map(f => (
                <div key={f.id} className="p-4 rounded-xl border border-border bg-panel space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-textMain">{f.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${SEVERITY_STYLE[f.severity]}`}>
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-textMuted font-sans leading-relaxed">{f.explanation}</p>
                  {f.evidence[0] && (
                    <div className="text-[10px] text-life/80">
                      {f.evidence[0].file}
                      {f.evidence[0].lineStart ? `:${f.evidence[0].lineStart}` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Before / After proof */}
        {verification && (
          <section className="mb-8 space-y-3">
            <div className="uppercase tracking-wider text-xs text-textMain font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-life" /> Proof
            </div>
            <div className="grid gap-4 md:grid-cols-2 text-xs">
              <div className="p-4 rounded-xl border border-crimson/40 bg-panel space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-crimson font-bold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" /> Before
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded border border-crimson/30 bg-crimson/10 text-crimson">
                    exit {verification.beforeOutcome.exitCode}
                  </span>
                </div>
                <pre className="p-3 rounded-lg bg-void border border-border text-[11px] text-crimson/90 whitespace-pre-wrap max-h-44 overflow-auto">
                  {verification.beforeOutcome.logs}
                </pre>
              </div>
              <div className={`p-4 rounded-xl border bg-panel space-y-2 ${revived ? 'border-life/50 shadow-ghost' : 'border-crimson/40'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-life font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> After
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${revived ? 'border-life/30 bg-life/10 text-life font-bold' : 'border-crimson/30 bg-crimson/10 text-crimson'}`}>
                    exit {verification.afterOutcome.exitCode}
                  </span>
                </div>
                <pre className="p-3 rounded-lg bg-void border border-border text-[11px] text-life/90 whitespace-pre-wrap max-h-44 overflow-auto">
                  {verification.afterOutcome.logs}
                </pre>
              </div>
            </div>
          </section>
        )}

        {/* What next */}
        {revived && repo && (
          <section className="p-6 rounded-xl border border-life/40 bg-panel shadow-ghost space-y-4">
            <div>
              <h2 className="text-lg font-bold text-life">Revived. Now go deeper.</h2>
              <p className="text-xs text-textMuted font-sans mt-1">
                {patch?.title}. Everything below runs on your machine; nothing left it.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              {[
                { href: `/lab/${repo.id}/resurrection`, icon: Layers, label: 'Review the diff' },
                { href: `/lab/${repo.id}/autopsy`, icon: Stethoscope, label: 'Read the full autopsy' },
                { href: `/lab/${repo.id}/ghost`, icon: Ghost, label: 'Ask the Ghost about the code' },
                { href: `/lab/${repo.id}/report`, icon: FileText, label: 'Export the recovery report' },
              ].map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="p-3 rounded-lg border border-border bg-void hover:border-life/60 transition-colors flex items-center justify-between group"
                >
                  <span className="flex items-center gap-2 text-textMain">
                    <l.icon className="w-4 h-4 text-life" /> {l.label}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-textMuted group-hover:text-life group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
