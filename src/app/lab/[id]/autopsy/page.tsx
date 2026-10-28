'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import LabTabs from '@/components/LabTabs';
import { Repository, AutopsyFinding, FindingCategory, FindingSeverity } from '@/lib/types';
import { 
  Stethoscope, 
  AlertTriangle, 
  ShieldAlert, 
  FileCode, 
  CheckCircle2, 
  Filter, 
  Info, 
  Terminal,
  ExternalLink
} from 'lucide-react';

export default function AutopsyPage() {
  const params = useParams();
  const repoId = params.id as string;

  const [repo, setRepo] = useState<Repository | null>(null);
  const [findings, setFindings] = useState<AutopsyFinding[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/repositories/${repoId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setRepo(data.repository);
          setFindings(data.findings || []);
        }
      })
      .finally(() => setLoading(false));
  }, [repoId]);

  if (loading || !repo) {
    return (
      <div className="py-24 text-center font-mono text-xs text-textMuted">
        Loading autopsy findings...
      </div>
    );
  }

  const filteredFindings = findings.filter(f => {
    if (selectedCategory !== 'all' && f.category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && f.severity !== selectedSeverity) return false;
    return true;
  });

  const categories = ['all', 'runtime', 'dependencies', 'compatibility', 'security', 'tests'];
  const severities = ['all', 'critical', 'high', 'medium', 'low'];

  return (
    <div>
      <LabTabs repo={repo} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-crimson mb-1">
              <Stethoscope className="w-4 h-4" />
              <span>DETERMINISTIC CODE AUTOPSY</span>
            </div>
            <h1 className="text-2xl font-mono font-bold text-textMain">
              Autopsy & Evidence Log_
            </h1>
            <p className="text-xs text-textMuted mt-1">
              AST inspection, lockfile analysis, and runtime deprecation tracking with exact file citations.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-lg border border-border bg-panel text-textMuted">
              Total Deficiencies: <span className="text-textMain font-bold">{findings.length}</span>
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-panel text-xs font-mono">
          {/* Categories */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-textMuted mr-2 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Category:
            </span>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded transition-colors uppercase text-[11px] ${
                  selectedCategory === cat 
                    ? 'bg-border text-life font-bold' 
                    : 'text-textMuted hover:text-textMain'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Severities */}
          <div className="flex items-center gap-1">
            <span className="text-textMuted mr-2">Severity:</span>
            {severities.map(sev => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`px-2 py-1 rounded transition-colors uppercase text-[11px] ${
                  selectedSeverity === sev 
                    ? 'bg-border text-textMain font-bold' 
                    : 'text-textMuted hover:text-textMain'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Findings List */}
        {filteredFindings.length === 0 ? (
          <div className="p-12 text-center font-mono text-xs text-textMuted border border-dashed border-border rounded-xl">
            No autopsy findings match the active filters.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFindings.map((finding) => {
              const isCrit = finding.severity === 'critical';
              const isHigh = finding.severity === 'high';

              return (
                <div
                  key={finding.id}
                  className={`p-5 rounded-xl border transition-all ${
                    isCrit 
                      ? 'border-crimson/40 bg-panel hover:border-crimson/70' 
                      : isHigh 
                      ? 'border-pumpkin/40 bg-panel hover:border-pumpkin/70' 
                      : 'border-border bg-panel hover:border-borderLight'
                  }`}
                >
                  {/* Top Finding Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          isCrit 
                            ? 'bg-crimson/20 text-crimson border border-crimson/30' 
                            : isHigh 
                            ? 'bg-pumpkin/20 text-pumpkin border border-pumpkin/30' 
                            : 'bg-border text-textMuted'
                        }`}>
                          {finding.severity}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-panelElevated border border-border text-textMuted uppercase">
                          {finding.category}
                        </span>
                        <span className="text-[10px] font-mono text-life/80">
                          Confidence: {(finding.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <h3 className="text-base font-mono font-bold text-textMain">
                        {finding.title}
                      </h3>
                    </div>

                    <div className="text-[10px] font-mono text-textMuted">
                      ID: {finding.id}
                    </div>
                  </div>

                  {/* Explanation */}
                  <p className="text-xs text-textMuted mb-4 leading-relaxed font-sans">
                    {finding.explanation}
                  </p>

                  {/* Code Evidence Block */}
                  {finding.evidence && finding.evidence.length > 0 && (
                    <div className="mb-4 rounded-lg bg-void border border-border overflow-hidden">
                      <div className="bg-panelElevated px-3 py-1.5 border-b border-border flex items-center justify-between text-[11px] font-mono text-textMuted">
                        <div className="flex items-center space-x-1.5">
                          <FileCode className="w-3.5 h-3.5 text-life" />
                          <span className="text-textMain font-medium">{finding.evidence[0].file}</span>
                          {finding.evidence[0].lineStart && (
                            <span>(lines {finding.evidence[0].lineStart} - {finding.evidence[0].lineEnd || finding.evidence[0].lineStart})</span>
                          )}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-life/10 text-life border border-life/20 uppercase font-semibold">
                          {finding.evidence[0].type}
                        </span>
                      </div>
                      {finding.evidence[0].snippet && (
                        <pre className="p-3 font-mono text-xs text-textMain/90 overflow-x-auto">
                          <code>{finding.evidence[0].snippet}</code>
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Proposed Fix & Verification Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-border/60 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-void/60 border border-border/70 space-y-1">
                      <span className="text-life font-medium text-[11px] block">
                        &rarr; Proposed Solution
                      </span>
                      <p className="text-textMuted text-[11px] font-sans">
                        {finding.proposedFix}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-void/60 border border-border/70 space-y-1">
                      <span className="text-pumpkin font-medium text-[11px] block">
                        &bull; Verification Method
                      </span>
                      <p className="text-textMuted text-[11px] font-sans">
                        {finding.verification}
                      </p>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
