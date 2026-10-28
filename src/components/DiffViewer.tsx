'use client';

import React, { useState } from 'react';
import { PatchFile } from '@/lib/types';
import { FileCode, Copy, Check } from 'lucide-react';

interface DiffViewerProps {
  files: PatchFile[];
}

export default function DiffViewer({ files }: DiffViewerProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
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

  const diffLines = (currentFile.diff || '').split('\n');

  return (
    <div className="border border-border rounded-lg bg-panel overflow-hidden">
      {/* File Selector Bar */}
      <div className="bg-panelElevated border-b border-border flex items-center justify-between px-3 py-2">
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none">
          {files.map((file, idx) => (
            <button
              key={file.path}
              onClick={() => setSelectedIdx(idx)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-mono transition-colors ${
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

        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 px-2.5 py-1 text-xs font-mono rounded bg-void hover:bg-border text-textMuted hover:text-textMain border border-border transition-colors"
          title="Copy Unified Diff"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-life" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy Diff'}</span>
        </button>
      </div>

      {/* Code Diff Display */}
      <div className="overflow-x-auto p-4 bg-void font-mono text-xs leading-relaxed max-h-[500px]">
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
              <span className={`inline-block select-none w-8 text-textMuted/50 text-right mr-3 text-[10px]`}>
                {i + 1}
              </span>
              <span className={lineClass}>{line || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
