import { NextResponse } from 'next/server';
import { getDb } from '@/lib/github/db';
import { currentSync, startSync } from '@/lib/github/sync';
import { ensureScheduler, sameOriginOrReject, snapshot } from '@/lib/github/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  ensureScheduler();
  const s = snapshot();
  return NextResponse.json({ success: true, running: currentSync()?.state === 'running', ...s });
}

export async function POST(req: Request) {
  const blocked = sameOriginOrReject(req);
  if (blocked) return blocked;
  const c = getDb().connection;
  if (!c) return NextResponse.json({ success: false, error: 'Connect GitHub first.' }, { status: 409 });
  if (c.status !== 'ok') return NextResponse.json({ success: false, error: 'Token is no longer valid. Reconnect.' }, { status: 401 });
  const run = startSync('manual');
  return NextResponse.json({ success: true, run }, { status: 202 });
}
