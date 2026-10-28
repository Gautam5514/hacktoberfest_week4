'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Stethoscope, Ghost, Wrench, FileText, ChevronRight } from 'lucide-react';
import { Repository } from '@/lib/types';

interface LabTabsProps {
  repo: Repository;
}

export default function LabTabs({ repo }: LabTabsProps) {
  const pathname = usePathname();
  const basePath = `/lab/${repo.id}`;

  const tabs = [
    { name: 'Overview', href: basePath, icon: Activity, exact: true },
    { name: 'Autopsy & Evidence', href: `${basePath}/autopsy`, icon: Stethoscope },
    { name: 'The Ghost AI', href: `${basePath}/ghost`, icon: Ghost },
    { name: 'Resurrection Workbench', href: `${basePath}/resurrection`, icon: Wrench },
    { name: 'Recovery Report', href: `${basePath}/report`, icon: FileText },
  ];

  return (
    <div className="border-b border-border bg-panel">
      {/* Breadcrumb Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center space-x-2 text-textMuted">
          <Link href="/graveyard" className="hover:text-life transition-colors">
            graveyard
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-textMain font-semibold flex items-center gap-1.5">
            {repo.name}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              repo.status === 'resurrected' 
                ? 'bg-life/20 text-life border border-life/30' 
                : 'bg-pumpkin/20 text-pumpkin border border-pumpkin/30'
            }`}>
              {repo.status.toUpperCase()}
            </span>
          </span>
        </div>

        <div className="flex items-center space-x-4 text-textMuted text-[11px]">
          <span>Commit: <code className="text-life">{repo.commitSha}</code></span>
          <span>Died: <span className="text-crimson font-medium">{repo.deathYear}</span></span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = tab.exact 
            ? pathname === tab.href 
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-mono font-medium border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-life text-life bg-life/5'
                  : 'border-transparent text-textMuted hover:text-textMain hover:border-borderLight'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-life' : 'text-textMuted'}`} />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
