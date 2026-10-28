'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Skull, 
  Ghost, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Terminal, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Flame,
  Activity,
  FolderGit2
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [repoInput, setRepoInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (targetPathOrUrl?: string) => {
    const inputVal = targetPathOrUrl || repoInput.trim();
    if (!inputVal) {
      setError('Please enter a GitHub repository URL or a local folder path.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const isLocal = inputVal.startsWith('/') || inputVal.startsWith('./') || inputVal.includes('examples/');
      const payload = isLocal 
        ? { localPath: inputVal }
        : { url: inputVal };

      const res = await fetch('/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to import repository.');
      }

      // Navigate to the lab overview
      router.push(`/lab/${data.repository.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred during import.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-life/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-pumpkin/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 relative z-10 w-full">
        
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-border bg-panel text-xs font-mono text-textMuted shadow-sm">
            <span className="w-2 h-2 rounded-full bg-life animate-ping"></span>
            <span className="text-textMain font-medium">HACKTOBERFEST 2026 · WEEK 4</span>
            <span className="text-border">|</span>
            <span className="text-life">DEV CHALLENGE</span>
          </div>
        </div>

        {/* Hero Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight font-mono text-textMain">
            DEAD CODE DESERVES A <span className="text-life underline decoration-life/30 underline-offset-8">SECOND LIFE</span>.
          </h1>
          <p className="text-base sm:text-lg text-textMuted max-w-2xl mx-auto font-sans leading-relaxed">
            An open-source AI-powered resurrection lab for forgotten software. 
            Enter an abandoned repository — our local <span className="text-textMain font-semibold">Gemma 3</span> AI autopsies the failure, generates a verified modernizing patch, and proves the revival works.
          </p>
        </div>

        {/* Importer Form */}
        <div className="mt-10 max-w-2xl mx-auto">
          <div className="p-2 sm:p-2.5 rounded-xl border border-border bg-panel shadow-2xl backdrop-blur-sm focus-within:border-life/60 transition-all">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-textMuted">
                  <FolderGit2 className="w-5 h-5 text-life" />
                </div>
                <input
                  type="text"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                  placeholder="https://github.com/owner/abandoned-repo or local folder path..."
                  className="w-full pl-11 pr-4 py-3 bg-void border border-border/80 rounded-lg text-sm font-mono text-textMain placeholder:text-textMuted/60 focus:outline-none focus:border-life transition-colors"
                />
              </div>
              <button
                onClick={() => handleImport()}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-life hover:bg-life/90 text-void font-mono font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-ghost disabled:opacity-50 whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin" />
                    <span>Autopsying...</span>
                  </>
                ) : (
                  <>
                    <span>Begin Resurrection</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-lg bg-crimson/10 border border-crimson/30 text-crimson text-xs font-mono flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Subtext info */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-textMuted">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-life" /> Local AI (Gemma 3 4B)
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-life" /> 100% Private On-Device
            </span>
            <span>•</span>
            <span>No AI API Key Required</span>
          </div>
        </div>

        {/* Quick Launch Pre-analyzed Specimens */}
        <div className="mt-14 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono text-textMuted tracking-wider uppercase flex items-center gap-2">
              <Skull className="w-4 h-4 text-pumpkin" />
              Pre-Loaded Graveyard Specimens
            </span>
            <Link href="/graveyard" className="text-xs font-mono text-life hover:underline flex items-center gap-1">
              View All in Graveyard &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Specimen 1 */}
            <div 
              onClick={() => router.push('/lab/sample-broken-app')}
              className="p-4 rounded-xl border border-border bg-panel hover:border-life/50 hover:bg-panelElevated transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="text-textMain font-semibold group-hover:text-life transition-colors">
                    markdown-tomb-parser
                  </span>
                  <span className="text-crimson font-medium text-[11px]">Died 2016</span>
                </div>
                <p className="text-xs text-textMuted line-clamp-2 mb-3">
                  Markdown extractor failing due to deprecated Buffer constructor & broken import.
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono border-t border-border/60 pt-2 text-textMuted">
                <span className="text-pumpkin">Node 8-14 API</span>
                <span className="text-life group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Resurrect &rarr;
                </span>
              </div>
            </div>

            {/* Specimen 2 */}
            <div 
              onClick={() => router.push('/lab/express-vintage-2016')}
              className="p-4 rounded-xl border border-border bg-panel hover:border-life/50 hover:bg-panelElevated transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="text-textMain font-semibold group-hover:text-life transition-colors">
                    auth-vault-microservice
                  </span>
                  <span className="text-crimson font-medium text-[11px]">Died 2017</span>
                </div>
                <p className="text-xs text-textMuted line-clamp-2 mb-3">
                  Legacy OAuth broker relying on deprecated request package and obsolete crypto.createCipher().
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono border-t border-border/60 pt-2 text-textMuted">
                <span className="text-pumpkin">Crypto Obsolete</span>
                <span className="text-life group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Resurrect &rarr;
                </span>
              </div>
            </div>

            {/* Specimen 3 */}
            <div 
              onClick={() => router.push('/lab/angularjs-tombstone')}
              className="p-4 rounded-xl border border-border bg-panel hover:border-life/50 hover:bg-panelElevated transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="text-textMain font-semibold group-hover:text-life transition-colors">
                    dash-metrics-angular
                  </span>
                  <span className="text-crimson font-medium text-[11px]">Died 2015</span>
                </div>
                <p className="text-xs text-textMuted line-clamp-2 mb-3">
                  AngularJS 1.5 metrics tool with broken Node-Sass native build bindings.
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono border-t border-border/60 pt-2 text-textMuted">
                <span className="text-pumpkin">Node-Sass LibSass</span>
                <span className="text-life group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Resurrect &rarr;
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* 5 Questions / Value Props */}
        <div className="mt-20 border-t border-border pt-12">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-lg font-mono font-bold text-textMain uppercase tracking-wider">
              The 5 Questions Every Autopsy Answers
            </h2>
            <p className="text-xs text-textMuted mt-1">
              Deterministic AST checks combined with local Gemma 3 reasoning.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs font-mono">
            
            <div className="p-4 rounded-lg border border-border bg-panel space-y-2">
              <span className="text-life font-bold">01 / PURPOSE</span>
              <p className="text-textMain font-semibold">What was it built to do?</p>
              <p className="text-textMuted text-[11px]">Extracts original intent from code, docs, and manifests.</p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-panel space-y-2">
              <span className="text-crimson font-bold">02 / AUTOPSY</span>
              <p className="text-textMain font-semibold">Why did it die?</p>
              <p className="text-textMuted text-[11px]">Flags deprecated APIs, engine mismatches, and broken imports.</p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-panel space-y-2">
              <span className="text-pumpkin font-bold">03 / SALVAGE</span>
              <p className="text-textMain font-semibold">Which parts survive?</p>
              <p className="text-textMuted text-[11px]">Identifies healthy business logic and salvageable modules.</p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-panel space-y-2">
              <span className="text-life font-bold">04 / PATCH</span>
              <p className="text-textMain font-semibold">What must change?</p>
              <p className="text-textMuted text-[11px]">Generates a clean unified diff for human code review.</p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-panel space-y-2">
              <span className="text-life font-bold">05 / PROOF</span>
              <p className="text-textMain font-semibold">Can we prove it works?</p>
              <p className="text-textMuted text-[11px]">Runs isolated test commands with before vs. after exit codes.</p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
