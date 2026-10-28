'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Skull, Ghost, Archive, Cpu, Settings, Terminal, ShieldCheck } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-panel/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-void border border-border flex items-center justify-center text-life group-hover:border-life transition-colors shadow-ghost">
              <Ghost className="w-5 h-5 animate-pulseGhost" />
            </div>
            <div className="flex flex-col">
              <span className="font-mono font-bold tracking-wider text-textMain group-hover:text-life transition-colors flex items-center gap-1.5">
                THE LAST COMMIT<span className="text-life animate-ping">_</span>
              </span>
              <span className="text-[10px] font-mono text-textMuted tracking-tight">
                AI CODE RESURRECTION LAB
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-border/60">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-mono transition-colors ${
                pathname === '/' 
                  ? 'bg-border text-life font-semibold' 
                  : 'text-textMuted hover:text-textMain hover:bg-panelElevated'
              }`}
            >
              /resurrect
            </Link>

            <Link
              href="/graveyard"
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-mono transition-colors flex items-center gap-1.5 ${
                pathname.startsWith('/graveyard') 
                  ? 'bg-border text-life font-semibold' 
                  : 'text-textMuted hover:text-textMain hover:bg-panelElevated'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              /graveyard
            </Link>

            <Link
              href="/settings"
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-mono transition-colors flex items-center gap-1.5 ${
                pathname === '/settings' 
                  ? 'bg-border text-life font-semibold' 
                  : 'text-textMuted hover:text-textMain hover:bg-panelElevated'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              /settings
            </Link>
          </nav>
        </div>

        {/* Right Status Badges */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded border border-border bg-void text-textMuted">
            <Cpu className="w-3.5 h-3.5 text-life" />
            <span>Gemma 3 4B</span>
            <span className="w-1.5 h-1.5 rounded-full bg-life animate-pulse"></span>
          </div>

          <div className="flex items-center space-x-1 px-2.5 py-1 rounded border border-life/30 bg-life/10 text-life">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Local-First</span>
          </div>
        </div>

      </div>
    </header>
  );
}
