import { NextResponse } from 'next/server';
import { z } from 'zod';
import { queryRepos } from '@/lib/github/views';

export const dynamic = 'force-dynamic';

const Query = z.object({
  status: z.enum(['active', 'cooling', 'dormant', 'deep_sleep', 'archived']).optional(),
  tracking: z.enum(['auto', 'pinned', 'ignored']).optional(),
  sort: z.enum(['activity', 'idle', 'stars', 'score', 'name']).optional(),
  q: z.string().max(100).optional(),
});

export async function GET(req: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid query' }, { status: 400 });
  return NextResponse.json({ success: true, repos: queryRepos(parsed.data) });
}
