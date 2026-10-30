import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connect, disconnect, ensureScheduler, errorResponse, publicConnection, sameOriginOrReject } from '@/lib/github/service';

export const dynamic = 'force-dynamic';

const Body = z.object({ token: z.string().trim().min(20).max(255).regex(/^[A-Za-z0-9_]+$/, 'Token has invalid characters') });

export async function GET() {
  ensureScheduler();
  return NextResponse.json({ success: true, connection: publicConnection() });
}

export async function POST(req: Request) {
  const blocked = sameOriginOrReject(req);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'That does not look like a GitHub token.' }, { status: 400 });
  try {
    return NextResponse.json({ success: true, connection: await connect(parsed.data.token) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  const blocked = sameOriginOrReject(req);
  if (blocked) return blocked;
  disconnect(new URL(req.url).searchParams.get('purge') === '1');
  return NextResponse.json({ success: true });
}
