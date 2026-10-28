'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import LabTabs from '@/components/LabTabs';
import { Repository, AutopsyFinding, ArchitectureSummary } from '@/lib/types';
import { 
  Activity, 
  Stethoscope, 
  Ghost, 
  Wrench, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Cpu, 
  Layers, 
  ArrowRight,
  Flame,
  ShieldAlert
} from 'lucide-react';

export default function LabOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const repoId = params.id as string;

  const [repo, setRepo] = useState<Repository | null>(null);
  const [findings, setFindings] = useState<AutopsyFinding[]>([]);
  const [architecture, setArchitecture] = useState<ArchitectureSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/repositories/${repoId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setRepo(data.repository);
          setFindings(data.findings);
          setArchitecture(data.architecture);
        }
      })
      .finally(() => setLoading(false));
  }, [repoId]);

  if (loading) {
    return (
      <div className="py-24 text-center font-mono text-xs text-textMuted">
        Loading specimen telemetry...
      </div>
    );
  }

  if (!repo || !architecture) {
    return (
      <div className="py-24 text-center font-mono text-xs text-crimson">
        Specimen not found in resurrection lab.
      </div>
    );
  }

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;
  const mediumCount = findings.filter(f => f.severity === 'medium').length;

  return (
    <div>
      <LabTabs repo={repo} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Specimen Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Health Score */}
          <div className="p-5 rounded-xl border border-border bg-panel flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-textMuted mb-2">
              <span>HEALTH SCORE</span>
              <Activity className="w-4 h-4 text-life" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-4xl font-mono font-extrabold ${
                architecture.healthScore > 70 
                  ? 'text-life' 
                  : architecture.healthScore > 40 
                  ? 'text-pumpkin' 
                  : 'text-crimson'
              }`}>
                {architecture.healthScore}
              </span>
              <span className="text-xs font-mono text-textMuted">/100</span>
            </div>
            <p className="text-[11px] font-mono text-textMuted mt-2">
              {architecture.healthScore < 50 ? 'Severe obsolescence detected' : 'Moderate recovery pathway'}
            </p>
          </div>

          {/* Card 2: Autopsy Findings */}
          <div className="p-5 rounded-xl border border-border bg-panel flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-textMuted mb-2">
              <span>DISCOVERED FLAWS</span>
              <AlertTriangle className="w-4 h-4 text-crimson" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-mono font-extrabold text-textMain">
                {findings.length}
              </span>
              <span className="text-xs font-mono text-textMuted">defects</span>
            </div>
            <p className="text-[11px] font-mono text-crimson mt-2 flex items-center gap-1.5">
              <span>{criticalCount} Critical</span>
              <span>•</span>
              <span className="text-pumpkin">{highCount} High</span>
            </p>
          </div>

          {/* Card 3: Target vs Modern Runtime */}
          <div className="p-5 rounded-xl border border-border bg-panel flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-textMuted mb-2">
              <span>RUNTIME DELTA</span>
              <Cpu className="w-4 h-4 text-pumpkin" />
            </div>
            <div className="text-xs font-mono space-y-1">
              <div className="text-crimson line-through text-[11px]">{architecture.targetRuntime}</div>
              <div className="text-life font-bold text-sm">&rarr; {architecture.modernRuntime}</div>
            </div>
            <p className="text-[11px] font-mono text-textMuted mt-2">
              V8 ECMAScript Engine upgrade
            </p>
          </div>

          {/* Card 4: Salvageable Modules */}
          <div className="p-5 rounded-xl border border-border bg-panel flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-textMuted mb-2">
              <span>SALVAGEABLE ASSETS</span>
              <Layers className="w-4 h-4 text-life" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-mono font-extrabold text-life">
                {architecture.reusableComponents.length}
              </span>
              <span className="text-xs font-mono text-textMuted">clean files</span>
            </div>
            <p className="text-[11px] font-mono text-textMuted mt-2">
              {architecture.locCount || 200} lines of salvageable code
            </p>
          </div>

        </div>

        {/* Deep Overview Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Purpose & Strategy */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="p-6 rounded-xl border border-border bg-panel space-y-4">
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-textMain flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-life"></span>
                Original Intent & Purpose
              </h2>
              <p className="text-xs sm:text-sm text-textMuted leading-relaxed font-sans">
                {architecture.originalPurpose}
              </p>
              
              <div className="pt-2">
                <span className="text-xs font-mono text-textMuted block mb-2">Identified Technology Stack:</span>
                <div className="flex flex-wrap gap-2">
                  {architecture.techStack.map(tech => (
                    <span key={tech} className="px-2.5 py-1 rounded bg-panelElevated border border-border text-xs font-mono text-life">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-border bg-panel space-y-3">
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-textMain flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pumpkin"></span>
                Gemma 3 Revival Strategy
              </h2>
              <pre className="p-4 rounded-lg bg-void border border-border font-mono text-xs text-textMain/90 whitespace-pre-wrap leading-relaxed">
                {architecture.revivalStrategy}
              </pre>
            </div>

          </div>

          {/* Right Column: Lab Station Shortcuts */}
          <div className="space-y-4">
            
            <h3 className="text-xs font-mono uppercase tracking-wider text-textMuted">
              Resurrection Lab Stations
            </h3>

            {/* Station 1: Autopsy */}
            <Link
              href={`/lab/${repo.id}/autopsy`}
              className="p-4 rounded-xl border border-border bg-panel hover:bg-panelElevated hover:border-crimson/50 transition-all block group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold text-textMain group-hover:text-crimson transition-colors flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-crimson" />
                  Station 1: Autopsy & Evidence
                </span>
                <ArrowRight className="w-4 h-4 text-textMuted group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-[11px] text-textMuted font-sans">
                Inspect categorized findings, exact line citations, and AST diagnostics.
              </p>
            </Link>

            {/* Station 2: Ghost */}
            <Link
              href={`/lab/${repo.id}/ghost`}
              className="p-4 rounded-xl border border-border bg-panel hover:bg-panelElevated hover:border-life/50 transition-all block group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold text-textMain group-hover:text-life transition-colors flex items-center gap-2">
                  <Ghost className="w-4 h-4 text-life" />
                  Station 2: The Ghost AI
                </span>
                <ArrowRight className="w-4 h-4 text-textMuted group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-[11px] text-textMuted font-sans">
                Engage with our on-device recovery agent grounded in indexed source files.
              </p>
            </Link>

            {/* Station 3: Resurrection */}
            <Link
              href={`/lab/${repo.id}/resurrection`}
              className="p-4 rounded-xl border border-border bg-panel hover:bg-panelElevated hover:border-life/50 transition-all block group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold text-textMain group-hover:text-life transition-colors flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-life" />
                  Station 3: Patch & Sandbox Test
                </span>
                <ArrowRight className="w-4 h-4 text-textMuted group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-[11px] text-textMuted font-sans">
                Review unified diff, approve patch, and execute isolated sandbox verification.
              </p>
            </Link>

            {/* Station 4: Report */}
            <Link
              href={`/lab/${repo.id}/report`}
              className="p-4 rounded-xl border border-border bg-panel hover:bg-panelElevated hover:border-borderLight transition-all block group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold text-textMain group-hover:text-textMain transition-colors flex items-center gap-2">
                  <FileText className="w-4 h-4 text-pumpkin" />
                  Station 4: Recovery Report
                </span>
                <ArrowRight className="w-4 h-4 text-textMuted group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-[11px] text-textMuted font-sans">
                Generate and export the formal verification report in Markdown or JSON.
              </p>
            </Link>

          </div>

        </div>

      </div>
    </div>
  );
}
