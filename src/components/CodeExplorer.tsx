'use client';

import React, { useState, useEffect } from 'react';
import { FileCode, AlertTriangle, Check, Folder, ChevronRight, File, ShieldAlert } from 'lucide-react';
import { AutopsyFinding } from '@/lib/types';

interface CodeExplorerProps {
  repoId: string;
  findings: AutopsyFinding[];
}

interface RepoFile {
  path: string;
  size: number;
  language: string;
  loc: number;
}

export default function CodeExplorer({ repoId, findings }: CodeExplorerProps) {
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    fetch(`/api/repositories/${repoId}/files`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.files) {
          setFiles(data.files);
          if (data.files.length > 0) {
            setSelectedFile(data.files[0].path);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [repoId]);

  useEffect(() => {
    if (!selectedFile) return;
    setLoadingContent(true);
    fetch(`/api/repositories/${repoId}/files?file=${encodeURIComponent(selectedFile)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setFileContent(data.content);
        }
      })
      .finally(() => setLoadingContent(false));
  }, [repoId, selectedFile]);

  // Map findings to files
  const fileFindingsMap: Record<string, AutopsyFinding[]> = {};
  for (const f of findings) {
    for (const ev of f.evidence) {
      if (ev.file) {
        if (!fileFindingsMap[ev.file]) fileFindingsMap[ev.file] = [];
        fileFindingsMap[ev.file].push(f);
      }
    }
  }

  const currentFileFindings = fileFindingsMap[selectedFile] || [];
  const contentLines = fileContent.split('\n');

  if (loading) {
    return (
      <div className="p-10 text-center font-mono text-xs text-textMuted border border-border rounded-xl bg-panel">
        Loading workspace file tree...
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl bg-panel overflow-hidden font-mono text-xs">
      {/* Top Header */}
      <div className="bg-panelElevated border-b border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-textMuted text-[11px]">
          <Folder className="w-3.5 h-3.5 text-life" />
          <span>WORKSPACE EXPLORER</span>
          <ChevronRight className="w-3 h-3 text-borderLight" />
          <span className="text-textMain font-bold">{selectedFile || 'Select a file'}</span>
        </div>

        {currentFileFindings.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-crimson/15 text-crimson border border-crimson/30 font-bold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {currentFileFindings.length} Autopsy Defect{currentFileFindings.length > 1 ? 's' : ''} Active
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
        
        {/* Left Column: File Tree */}
        <div className="md:col-span-1 p-2 space-y-1 bg-void/50 max-h-[500px] overflow-y-auto">
          <div className="text-[10px] uppercase text-textMuted px-2 py-1 tracking-wider">
            Repository Files ({files.length})
          </div>
          {files.map(f => {
            const hasFlaws = (fileFindingsMap[f.path]?.length || 0) > 0;
            const isSelected = selectedFile === f.path;

            return (
              <button
                key={f.path}
                onClick={() => setSelectedFile(f.path)}
                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                  isSelected 
                    ? 'bg-border text-life font-semibold shadow-sm' 
                    : 'text-textMuted hover:text-textMain hover:bg-panelElevated'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <File className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{f.path}</span>
                </div>
                {hasFlaws && (
                  <span className="w-2 h-2 rounded-full bg-crimson shrink-0 ml-1"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Column: Code Viewer */}
        <div className="md:col-span-3 bg-void max-h-[500px] overflow-y-auto">
          {loadingContent ? (
            <div className="p-8 text-center text-textMuted text-xs">
              Fetching file source...
            </div>
          ) : (
            <div className="p-3 leading-relaxed">
              {contentLines.map((line, idx) => {
                const lineNum = idx + 1;
                const affectedFinding = currentFileFindings.find(f => 
                  f.evidence.some(e => e.lineStart === lineNum || (e.lineStart && e.lineEnd && lineNum >= e.lineStart && lineNum <= e.lineEnd))
                );

                return (
                  <div 
                    key={idx} 
                    className={`flex items-start ${
                      affectedFinding 
                        ? 'bg-crimson/10 border-l-2 border-crimson -mx-3 px-3' 
                        : 'hover:bg-panelElevated/50'
                    }`}
                  >
                    <span className="select-none w-10 text-right pr-4 text-[10px] text-textMuted/40 shrink-0">
                      {lineNum}
                    </span>
                    <span className="text-textMain/90 whitespace-pre overflow-x-auto flex-1 text-xs">
                      {line || ' '}
                    </span>
                    {affectedFinding && (
                      <span className="select-none text-[9px] text-crimson font-bold ml-2 shrink-0 uppercase tracking-tighter bg-crimson/20 px-1.5 py-0.5 rounded">
                        {affectedFinding.category} flaw
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
