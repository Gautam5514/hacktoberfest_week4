'use client';

import React, { useState } from 'react';
import { PatchFile } from '@/lib/types';
import { FileCode, Copy, Check, Download, Split, AlignJustify } from 'lucide-react';

interface DiffViewerProps {
  files: PatchFile[];
}

export default function DiffViewer({ files }: DiffViewerProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const [copied, setCopied] = useState(false);

  if (!files || files.length === 0) {
    return (
      <div className="p-8 text-center text-textMuted font-mono text-xs border border-border rounded-lg bg-panel">
        No diff files available for preview.
      </div>
    );
  }

  const currentFile = files[selectedIdx] || files[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPatch = () => {
    const blob = new Blob([currentFile.diff], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFile.path.replace(/[/\\?%*:|"<>]/g, '_')}.patch`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const diffLines = (currentFile.diff || '').split('\n');
  const origLines = (currentFile.originalContent || '').split('\n');
  const patchedLines = (currentFile.patchedContent || '').split('\n');

  return (
    <div className="border border-border rounded-xl bg-panel overflow-hidden font-mono text-xs">
      
      {/* Top File Selector & View Controls */}
      <div className="bg-panelElevated border-b border-border flex flex-wrap items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none">
          {files.map((file, idx) => (
            <button
              key={file.path}
              onClick={() => setSelectedIdx(idx)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-colors ${
                selectedIdx === idx
                  ? 'bg-void text-life border border-border font-semibold shadow-sm'
                  : 'text-textMuted hover:text-textMain'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{file.path}</span>
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* View Toggle */}
          <div className="flex items-center border border-border rounded-lg bg-void p-0.5 text-[11px]">
            <button
              onClick={() => setViewMode('unified')}
              className={`px-2 py-0.5 rounded flex items-center space-x-1 ${
                viewMode === 'unified' ? 'bg-border text-life font-bold' : 'text-textMuted hover:text-textMain'
              }`}
            >
              <AlignJustify className="w-3 h-3" />
              <span>Unified</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-2 py-0.5 rounded flex items-center space-x-1 ${
                viewMode === 'split' ? 'bg-border text-life font-bold' : 'text-textMuted hover:text-textMain'
              }`}
            >
              <Split className="w-3 h-3" />
              <span>Side-by-Side</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded bg-void hover:bg-border text-textMuted hover:text-textMain border border-border transition-colors"
            title="Copy Unified Diff"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-life" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownloadPatch}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded bg-void hover:bg-border text-textMuted hover:text-textMain border border-border transition-colors"
            title="Download .patch file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">.patch</span>
          </button>
        </div>
      </div>

      {/* Diff Content View */}
      {viewMode === 'unified' ? (
        <div className="overflow-x-auto p-4 bg-void text-xs leading-relaxed max-h-[520px]">
          {diffLines.map((line, i) => {
            let lineClass = 'text-textMuted';
            let bgClass = '';

            if (line.startsWith('+') && !line.startsWith('+++')) {
              lineClass = 'text-life font-medium';
              bgClass = 'bg-life/10 -mx-4 px-4 block border-l-2 border-life';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              lineClass = 'text-crimson line-through opacity-85';
              bgClass = 'bg-crimson/10 -mx-4 px-4 block border-l-2 border-crimson';
            } else if (line.startsWith('@@')) {
              lineClass = 'text-pumpkin/90 font-semibold';
              bgClass = 'bg-pumpkin/5 -mx-4 px-4 block my-1';
            }

            return (
              <div key={i} className={`whitespace-pre ${bgClass}`}>
                <span className="inline-block select-none w-8 text-textMuted/40 text-right mr-3 text-[10px]">
                  {i + 1}
                </span>
                <span className={lineClass}>{line || ' '}</span>
              </div>
            );
          })}
        </div>
      ) : (
        /* Split Side-by-Side View */
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border bg-void max-h-[520px] overflow-y-auto">
          
          {/* Left: Original Code */}
          <div className="p-3 overflow-x-auto">
            <div className="text-[10px] uppercase text-crimson font-bold pb-2 border-b border-border/60 mb-2 flex items-center justify-between">
              <span>Original (Legacy)</span>
              <span>{origLines.length} lines</span>
            </div>
            {origLines.map((line, i) => (
              <div key={i} className="flex hover:bg-crimson/5 text-textMuted text-xs whitespace-pre">
                <span className="select-none w-8 text-right pr-3 text-[10px] text-textMuted/40 shrink-0">
                  {i + 1}
                </span>
                <span className="truncate">{line || ' '}</span>
              </div>
            ))}
          </div>

          {/* Right: Resurrected Code */}
          <div className="p-3 overflow-x-auto">
            <div className="text-[10px] uppercase text-life font-bold pb-2 border-b border-border/60 mb-2 flex items-center justify-between">
              <span>Resurrected (Modernized)</span>
              <span>{patchedLines.length} lines</span>
            </div>
            {patchedLines.map((line, i) => (
              <div key={i} className="flex hover:bg-life/5 text-textMain text-xs whitespace-pre">
                <span className="select-none w-8 text-right pr-3 text-[10px] text-textMuted/40 shrink-0">
                  {i + 1}
                </span>
                <span className="truncate">{line || ' '}</span>
              </div>
            ))}
          </div>

        </div>
      )}

    </div>
  );
}
