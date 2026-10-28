import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { askGhostAgent, GhostContext } from '@/lib/ghost-ai';
import { GhostMessage } from '@/lib/types';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const messages = store.getMessages(id);
    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    const repo = store.getRepository(id);
    if (!repo) {
      return NextResponse.json({ success: false, error: 'Repository not found' }, { status: 404 });
    }

    const findings = store.getFindings(id);
    const architecture = store.getArchitecture(id);
    const recentMessages = store.getMessages(id);
    const settings = store.getSettings();

    // Collect indexed file list
    const fileInventory: Array<{ path: string; loc: number; language: string }> = [];
    if (fs.existsSync(repo.workspacePath)) {
      const walk = (dir: string, rel = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (['node_modules', '.git', '.next'].includes(e.name)) continue;
          const full = path.join(dir, e.name);
          const r = path.join(rel, e.name);
          if (e.isDirectory()) walk(full, r);
          else if (e.isFile()) {
            fileInventory.push({ path: r, loc: 50, language: 'javascript' });
          }
        }
      };
      try { walk(repo.workspacePath); } catch (e) {}
    }

    // Save user message
    const userMsg: GhostMessage = {
      id: `msg_user_${Date.now()}`,
      conversationId: id,
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    store.addMessage(id, userMsg);

    const ghostContext: GhostContext = {
      repoName: repo.name,
      files: fileInventory,
      findings,
      architecture,
      recentMessages
    };

    // Ask Ghost Agent
    const { reply, citations } = await askGhostAgent(
      content,
      ghostContext,
      settings.ollamaEndpoint,
      settings.modelName
    );

    const assistantMsg: GhostMessage = {
      id: `msg_agent_${Date.now()}`,
      conversationId: id,
      role: 'assistant',
      content: reply,
      citations,
      timestamp: new Date().toISOString()
    };
    store.addMessage(id, assistantMsg);

    return NextResponse.json({
      success: true,
      message: assistantMsg
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
