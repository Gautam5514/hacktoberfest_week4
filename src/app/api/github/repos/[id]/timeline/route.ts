import { NextResponse } from 'next/server';
import { getDb } from '@/lib/github/db';
import { buildTimeline } from '@/lib/github/deep';
import { rulesPlan } from '@/lib/github/plan';
import { refreshStatuses } from '@/lib/github/views';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  refreshStatuses();
  const db = getDb();
  const repo = db.repos[params.id];
  if (!repo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    success: true,
    repo,
    timeline: buildTimeline(repo.id),
    deep: db.deep[repo.id] ? { ...db.deep[repo.id], readme: db.deep[repo.id].readme ? { truncated: db.deep[repo.id].readme!.truncated, text: db.deep[repo.id].readme!.text.slice(0, 1500) } : null } : null,
    plan: rulesPlan(repo.id),
    analysis: db.analyses[repo.id] ?? null,
  });
}
