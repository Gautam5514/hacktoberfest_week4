import { NextResponse } from 'next/server';
import { z } from 'zod';
import { queryEvents } from '@/lib/github/views';

export const dynamic = 'force-dynamic';

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  repoId: z.string().max(40).optional(),
  before: z.string().max(40).optional(),
});

export async function GET(req: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid query' }, { status: 400 });
  return NextResponse.json({ success: true, events: queryEvents(parsed.data) });
}
