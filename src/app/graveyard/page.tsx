'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Skull, Ghost, Search, Filter, ArrowUpRight, ShieldAlert, Sparkles, Calendar, GitFork, Star } from 'lucide-react';
import { Repository } from '@/lib/types';

export default function GraveyardPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [filter, setFilter] = useState<'all' | 'dormant' | 'resurrected'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/repositories')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setRepos(data.repositories);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredRepos = repos.filter(repo => {
    if (filter === 'dormant' && repo.status !== 'dormant') return false;
    if (filter === 'resurrected' && repo.status !== 'resurrected') return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        repo.name.toLowerCase().includes(q) ||
        repo.description.toLowerCase().includes(q) ||
        repo.deathCause.toLowerCase().includes(q) ||
        repo.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6 mb-8">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-pumpkin mb-1">
            <Skull className="w-4 h-4" />
            <span>MEMORIAL ARCHIVE</span>
          </div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-textMain">
            THE GRAVEYARD_
          </h1>
          <p className="text-xs text-textMuted mt-1 max-w-xl">
            A preserved catalog of abandoned codebases, frozen runtime environments, and resurrected software artifacts.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
            <input
              type="text"
              placeholder="Search tombstones..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-mono bg-panel border border-border rounded-lg text-textMain placeholder:text-textMuted focus:outline-none focus:border-life"
            />
          </div>

          <div className="flex items-center space-x-1 border border-border rounded-lg bg-panel p-1 text-xs font-mono w-full sm:w-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded transition-colors ${filter === 'all' ? 'bg-border text-life font-semibold' : 'text-textMuted hover:text-textMain'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('dormant')}
              className={`px-3 py-1 rounded transition-colors ${filter === 'dormant' ? 'bg-border text-pumpkin font-semibold' : 'text-textMuted hover:text-textMain'}`}
            >
              Dormant
            </button>
            <button
              onClick={() => setFilter('resurrected')}
              className={`px-3 py-1 rounded transition-colors ${filter === 'resurrected' ? 'bg-border text-life font-semibold' : 'text-textMuted hover:text-textMain'}`}
            >
              Resurrected
            </button>
          </div>
        </div>
      </div>

      {/* Tombstones Grid */}
      {loading ? (
        <div className="py-20 text-center font-mono text-xs text-textMuted">
          Exhuming graveyard catalog...
        </div>
      ) : filteredRepos.length === 0 ? (
        <div className="py-20 text-center font-mono text-xs text-textMuted border border-dashed border-border rounded-xl">
          No tombstones matching your query.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRepos.map(repo => {
            const isResurrected = repo.status === 'resurrected';
            return (
              <div
                key={repo.id}
                className="tombstone-card rounded-xl border border-border bg-panel hover:bg-panelElevated p-5 flex flex-col justify-between group transition-all"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="text-[11px] font-mono text-textMuted">
                        {repo.owner || 'abandoned'} /
                      </div>
                      <h2 className="text-base font-mono font-bold text-textMain group-hover:text-life transition-colors">
                        {repo.name}
                      </h2>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      isResurrected 
                        ? 'bg-life/10 text-life border-life/30' 
                        : 'bg-pumpkin/10 text-pumpkin border-pumpkin/30'
                    }`}>
                      {repo.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-textMuted line-clamp-2 mb-4 leading-relaxed font-sans">
                    {repo.description}
                  </p>

                  {/* Epitaph / Death Cause */}
                  <div className="p-2.5 rounded-lg bg-void border border-border/80 text-[11px] font-mono text-textMuted mb-4 space-y-1">
                    <div className="text-crimson font-medium flex items-center gap-1.5">
                      <Skull className="w-3.5 h-3.5" />
                      <span>Cause of Death:</span>
                    </div>
                    <div className="text-textMain/90 text-[11px] leading-tight">
                      {repo.deathCause}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {repo.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded bg-panelElevated border border-border/60 text-textMuted">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Bar */}
                <div className="border-t border-border/60 pt-3 flex items-center justify-between text-xs font-mono text-textMuted">
                  <div className="flex items-center space-x-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-textMuted" />
                      {repo.deathYear}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-pumpkin" />
                      {repo.stars || 0}
                    </span>
                  </div>

                  <Link
                    href={`/lab/${repo.id}`}
                    className="flex items-center space-x-1 text-life font-medium group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>Exhume</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
