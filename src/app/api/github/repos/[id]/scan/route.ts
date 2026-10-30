import { NextResponse } from 'next/server';
import { runDeepScan } from '@/lib/github/deep';
import { errorResponse, sameOriginOrReject } from '@/lib/github/service';

export const dynamic = 'force-dynamic';

/** Fetches open PRs, issues, releases and README for one repo on demand. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const blocked = sameOriginOrReject(req);
  if (blocked) return blocked;
  try {
    return NextResponse.json({ success: true, deep: await runDeepScan(params.id) });
  } catch (e) {
    if (e instanceof Error && e.message === 'Repository not found') return NextResponse.json({ success: false, error: e.message }, { status: 404 });
    return errorResponse(e);
  }
}
