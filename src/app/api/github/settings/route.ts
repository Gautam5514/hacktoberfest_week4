import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, saveDb } from '@/lib/github/db';
import { sameOriginOrReject } from '@/lib/github/service';

export const dynamic = 'force-dynamic';

const Patch = z.object({
  intervalMinutes: z.number().int().min(5).max(1440),
  thresholds: z.object({
    active: z.number().int().min(1).max(3650),
    cooling: z.number().int().min(1).max(3650),
    dormant: z.number().int().min(1).max(3650),
  }).refine(t => t.active < t.cooling && t.cooling < t.dormant, 'Thresholds must increase: active < cooling < dormant'),
}).partial().strict();

export async function GET() {
  return NextResponse.json({ success: true, settings: getDb().settings, webhooksEnabled: !!process.env.GITHUB_WEBHOOK_SECRET });
}

export async function PATCH(req: Request) {
  const blocked = sameOriginOrReject(req);
  if (blocked) return blocked;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid settings' }, { status: 400 });
  const db = getDb();
  db.settings = { ...db.settings, ...parsed.data };
  saveDb();
  return NextResponse.json({ success: true, settings: db.settings });
}
