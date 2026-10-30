import { NextResponse } from 'next/server';
import { getDb } from '@/lib/github/db';
import { startAnalysis } from '@/lib/github/ai';
import { sameOriginOrReject } from '@/lib/github/service';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ success: true, analysis: getDb().analyses[params.id] ?? null });
}

/** Queues a local-model analysis and returns immediately; poll GET for the result. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const blocked = sameOriginOrReject(req);
  if (blocked) return blocked;
  const db = getDb();
  if (!db.repos[params.id]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  if (db.repos[params.id].tracking === 'ignored') return NextResponse.json({ success: false, error: 'Repository is set to ignored.' }, { status: 409 });
  const force = new URL(req.url).searchParams.get('force') === '1';
  return NextResponse.json({ success: true, analysis: startAnalysis(params.id, force) }, { status: 202 });
}
