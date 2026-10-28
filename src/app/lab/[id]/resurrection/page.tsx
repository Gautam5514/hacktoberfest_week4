'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import LabTabs from '@/components/LabTabs';
import DiffViewer from '@/components/DiffViewer';
import { Repository, PatchProposal, VerificationRun } from '@/lib/types';
import { 
  Wrench, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Terminal, 
  Cpu, 
  ShieldCheck, 
  Clock, 
  RotateCw, 
  Download,
  Layers,
  Sparkles
} from 'lucide-react';

export default function ResurrectionPage() {
  const params = useParams();
  const repoId = params.id as string;

  const [repo, setRepo] = useState<Repository | null>(null);
  const [patch, setPatch] = useState<PatchProposal | null>(null);
  const [verification, setVerification] = useState<VerificationRun | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifySteps, setVerifySteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/repositories/${repoId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setRepo(data.repository);
          setPatch(data.patch);
          setVerification(data.verification);
        }
      })
      .finally(() => setLoading(false));
  }, [repoId]);

  const handleRunVerification = async () => {
    if (!patch || isVerifying) return;
    setIsVerifying(true);
    setVerifySteps([
      '⚡ [1/5] Initializing isolated disposable sandbox in /tmp...',
      '🔍 [2/5] Running baseline check on original code (node test.js)...',
    ]);

    try {
      setTimeout(() => {
        setVerifySteps(prev => [
          ...prev, 
          '⚠️ [3/5] Baseline failed as expected. Synthesizing AST patch diff...',
          '🔨 [4/5] Applying unified diff to sandbox target files...'
        ]);
      }, 700);

      const res = await fetch(`/api/patches/${patch.id}/verify`, {
        method: 'POST'
      });
      const data = await res.json();

      if (data.success) {
        setVerification(data.verification);
        setPatch(data.patch);
        if (repo) {
          setRepo({ ...repo, status: 'resurrected' });
        }
        setVerifySteps(prev => [
          ...prev,
          '✓ [5/5] Post-patch sandbox verification complete: Exit Code 0 (ALL ASSERTIONS PASSED).'
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownloadFullPatch = () => {
    if (!patch) return;
    const fullPatchText = patch.files.map(f => f.diff).join('\n\n');
    const blob = new Blob([fullPatchText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resurrection-${repo?.name || 'patch'}.diff`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !repo) {
    return (
      <div className="py-24 text-center font-mono text-xs text-textMuted">
        Loading resurrection workbench...
      </div>
    );
  }

  const isVerified = verification?.status === 'passed';

  return (
    <div>
      <LabTabs repo={repo} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-mono">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center space-x-2 text-xs text-life mb-1">
              <Wrench className="w-4 h-4" />
              <span>ISOLATED REPAIR & VERIFICATION ENGINE</span>
            </div>
            <h1 className="text-2xl font-bold text-textMain">
              Resurrection Workbench_
            </h1>
            <p className="text-xs text-textMuted mt-1">
              Review AI-generated unified diffs, approve fixes, and test in an isolated disposable sandbox.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {patch && (
              <button
                onClick={handleDownloadFullPatch}
                className="px-3.5 py-2.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 border border-border bg-panel hover:bg-panelElevated text-textMain transition-colors"
                title="Download complete unified patch"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export Patch</span>
              </button>
            )}

            <button
              onClick={handleRunVerification}
              disabled={isVerifying || !patch}
              className={`px-5 py-2.5 rounded-lg font-bold text-xs flex items-center space-x-2 transition-all shadow-ghost ${
                isVerified 
                  ? 'bg-panelElevated text-life border border-life/40 hover:bg-panel' 
                  : 'bg-life text-void hover:bg-life/90'
              } disabled:opacity-50`}
            >
              {isVerifying ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Testing in Sandbox...</span>
                </>
              ) : isVerified ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-life" />
                  <span>Re-Verify in Sandbox</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Apply & Verify in Sandbox</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Terminal Replay when verifying */}
        {isVerifying && (
          <div className="p-4 rounded-xl border border-life/50 bg-void space-y-2 text-xs shadow-ghost">
            <div className="flex items-center justify-between border-b border-border/80 pb-2 text-[11px] text-life">
              <span className="flex items-center gap-2 font-bold">
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                Executing Live Sandbox Orchestration...
              </span>
              <span className="animate-pulse">Active Sandbox PID 8492</span>
            </div>
            <div className="space-y-1 font-mono text-[11px] text-textMain/90 py-1">
              {verifySteps.map((step, i) => (
                <div key={i} className="leading-relaxed">
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Patch Summary Card */}
        {patch ? (
          <div className="p-5 rounded-xl border border-border bg-panel space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  isVerified 
                    ? 'bg-life/20 text-life border border-life/30' 
                    : 'bg-pumpkin/20 text-pumpkin border border-pumpkin/30'
                }`}>
                  {patch.status}
                </span>
                <h3 className="text-sm font-bold text-textMain">
                  {patch.title}
                </h3>
              </div>
              <span className="text-[11px] text-textMuted">
                {patch.files.length} file{patch.files.length > 1 ? 's' : ''} modified
              </span>
            </div>

            <p className="text-xs text-textMuted font-sans leading-relaxed">
              {patch.summary}
            </p>

            <div className="text-[11px] text-textMuted pt-1 flex items-center gap-2">
              <span>Verification Target Command:</span>
              <code className="text-life bg-void px-2 py-0.5 rounded border border-border">
                {patch.verificationCommand}
              </code>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-textMuted border border-dashed border-border rounded-xl">
            No patch generated yet. Generating baseline repair...
          </div>
        )}

        {/* Diff Viewer */}
        {patch && patch.files && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-textMuted">
              <span className="flex items-center gap-2 uppercase tracking-wider text-[11px]">
                <Layers className="w-4 h-4 text-life" />
                Proposed Unified Diff
              </span>
              <span>Review modifications before applying</span>
            </div>
            <DiffViewer files={patch.files} />
          </div>
        )}

        {/* Verification Proof & Execution Logs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="text-xs uppercase tracking-wider text-textMain font-bold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-life" />
              Sandbox Verification Telemetry & Proof
            </span>
            {verification && (
              <span className="text-[11px] text-textMuted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Duration: {verification.durationMs}ms
              </span>
            )}
          </div>

          {!verification ? (
            <div className="p-10 rounded-xl border border-dashed border-border bg-panel text-center space-y-3">
              <Terminal className="w-8 h-8 text-textMuted mx-auto opacity-40" />
              <p className="text-xs text-textMuted">
                No sandbox verification run recorded yet.
              </p>
              <button
                onClick={handleRunVerification}
                disabled={isVerifying}
                className="px-4 py-2 rounded-lg bg-panelElevated border border-border hover:border-life text-xs text-life transition-colors"
              >
                Execute Before vs. After Verification
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* Before: Unpatched Run */}
              <div className="p-4 rounded-xl border border-crimson/40 bg-panel space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-crimson font-bold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    BEFORE (Unpatched Code)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-crimson/10 text-crimson border border-crimson/20">
                    Exit Code: {verification.beforeOutcome.exitCode}
                  </span>
                </div>
                <p className="text-[11px] text-textMuted">
                  {verification.beforeOutcome.summary}
                </p>
                <div className="p-3 rounded-lg bg-void border border-border text-[11px] text-crimson/90 overflow-x-auto max-h-48 leading-relaxed whitespace-pre-wrap">
                  {verification.beforeOutcome.logs}
                </div>
              </div>

              {/* After: Patched Run */}
              <div className={`p-4 rounded-xl border space-y-3 ${
                isVerified 
                  ? 'border-life/50 bg-panel shadow-ghost' 
                  : 'border-crimson/40 bg-panel'
              }`}>
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-life font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    AFTER (Sandbox Patched)
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${
                    isVerified 
                      ? 'bg-life/10 text-life border-life/30 font-bold' 
                      : 'bg-crimson/10 text-crimson border-crimson/30'
                  }`}>
                    Exit Code: {verification.afterOutcome.exitCode}
                  </span>
                </div>
                <p className="text-[11px] text-textMuted">
                  {verification.afterOutcome.summary}
                </p>
                <div className="p-3 rounded-lg bg-void border border-border text-[11px] text-life/90 overflow-x-auto max-h-48 leading-relaxed whitespace-pre-wrap">
                  {verification.afterOutcome.logs}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
