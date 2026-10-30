import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, saveDb } from '@/lib/github/db';
import { sameOriginOrReject } from '@/lib/github/service';
import { refreshStatuses } from '@/lib/github/views';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  refreshStatuses();
  const repo = getDb().repos[params.id];
  if (!repo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  const events = getDb().events.filter(e => e.repoId === repo.id).slice(-50).reverse();
  return NextResponse.json({ success: true, repo, events });
}

const Patch = z.object({ tracking: z.enum(['auto', 'pinned', 'ignored']) }).strict();

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const blocked = sameOriginOrReject(req);
  if (blocked) return blocked;
  const repo = getDb().repos[params.id];
  if (!repo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
  repo.tracking = parsed.data.tracking;
  saveDb();
  return NextResponse.json({ success: true, repo });
}
