'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import LabTabs from '@/components/LabTabs';
import { Repository, GhostMessage, Citation } from '@/lib/types';
import { Ghost, Send, Terminal, Sparkles, FileCode, Bot, User, ArrowRight, ShieldCheck } from 'lucide-react';

export default function GhostChatPage() {
  const params = useParams();
  const repoId = params.id as string;

  const [repo, setRepo] = useState<Repository | null>(null);
  const [messages, setMessages] = useState<GhostMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/repositories/${repoId}`).then(res => res.json()),
      fetch(`/api/repositories/${repoId}/chat`).then(res => res.json())
    ])
    .then(([repoData, chatData]) => {
      if (repoData.success) setRepo(repoData.repository);
      if (chatData.success) setMessages(chatData.messages);
    })
    .finally(() => setLoading(false));
  }, [repoId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || isSending) return;

    setInput('');
    setIsSending(true);

    // Optimistically add user message
    const tempUserMsg: GhostMessage = {
      id: `temp_${Date.now()}`,
      conversationId: repoId,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/repositories/${repoId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: textToSend })
      });

      const data = await res.json();
      if (data.success && data.message) {
        setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), tempUserMsg, data.message]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  if (loading || !repo) {
    return (
      <div className="py-24 text-center font-mono text-xs text-textMuted">
        Awakening The Ghost intelligence...
      </div>
    );
  }

  const promptSuggestions = [
    'Why did this repository die?',
    'What was its original architecture and purpose?',
    'Which source components are clean enough to salvage?',
    'What minimal patch is required to revive it on Node 22?'
  ];

  return (
    <div>
      <LabTabs repo={repo} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col h-[calc(100vh-10rem)]">
        
        {/* Header Badge */}
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-void border border-border flex items-center justify-center text-life shadow-ghost">
              <Ghost className="w-5 h-5 animate-pulseGhost" />
            </div>
            <div>
              <h1 className="text-base font-mono font-bold text-textMain flex items-center gap-2">
                THE GHOST INTELLIGENCE
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-life/10 text-life border border-life/30 font-normal">
                  Gemma 3 Grounded
                </span>
              </h1>
              <p className="text-[11px] font-mono text-textMuted">
                Source-grounded agent for <span className="text-textMain font-medium">{repo.name}</span>
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-textMuted bg-panel px-3 py-1.5 rounded-lg border border-border">
            <ShieldCheck className="w-3.5 h-3.5 text-life" />
            <span>Untrusted Repository Guard Active</span>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-panelElevated border border-border flex items-center justify-center text-life shrink-0">
                    <Ghost className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-2xl rounded-xl p-4 text-xs font-mono leading-relaxed ${
                  isUser 
                    ? 'bg-border/60 text-textMain border border-border self-end' 
                    : 'bg-panel text-textMain/90 border border-border'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Grounded Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                      <span className="text-[10px] text-textMuted uppercase tracking-wider block">
                        Source Citations:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((c, i) => (
                          <div 
                            key={i} 
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-void border border-border text-[10px] text-life"
                          >
                            <FileCode className="w-3 h-3" />
                            <span>{c.file}{c.lineStart ? `:${c.lineStart}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-border flex items-center justify-center text-textMuted shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isSending && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-panelElevated border border-border flex items-center justify-center text-life shrink-0">
                <Ghost className="w-4 h-4 animate-spin" />
              </div>
              <div className="rounded-xl p-4 text-xs font-mono bg-panel border border-border text-textMuted flex items-center space-x-2">
                <span>The Ghost is examining codebase AST and formulating response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Suggestions */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none mb-2">
          {promptSuggestions.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              disabled={isSending}
              className="text-[11px] font-mono whitespace-nowrap px-3 py-1 rounded-full border border-border bg-panel hover:bg-panelElevated hover:border-life/40 text-textMuted hover:text-textMain transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3 text-life" />
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-2 rounded-xl border border-border bg-panel focus-within:border-life/50 transition-colors">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask The Ghost about this codebase..."
              disabled={isSending}
              className="flex-1 bg-void px-3 py-2.5 text-xs font-mono text-textMain placeholder:text-textMuted rounded-lg border border-border/80 focus:outline-none focus:border-life"
            />
            <button
              onClick={() => handleSend()}
              disabled={isSending || !input.trim()}
              className="px-4 py-2.5 rounded-lg bg-life hover:bg-life/90 text-void font-mono font-bold text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-40"
            >
              <span>Transmit</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
