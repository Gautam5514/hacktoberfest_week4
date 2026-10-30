import { NextResponse } from 'next/server';
import { getDb } from '@/lib/github/db';
import { currentSync, startSync } from '@/lib/github/sync';
import { recordDelivery, SYNC_EVENTS, verifySignature } from '@/lib/github/webhook';

export const dynamic = 'force-dynamic';

/**
 * Optional accelerator. Polling remains the source of truth because GitHub never retries a
 * missed delivery. Enabled only when GITHUB_WEBHOOK_SECRET is set.
 * Must answer within 10 s, so we only validate, dedupe, and kick off a background sync.
 */
export async function POST(req: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ success: false, error: 'Webhooks are not enabled' }, { status: 404 });

  const raw = await req.text(); // signature is computed over the unparsed body
  if (!verifySignature(secret, raw, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
  }

  const guid = req.headers.get('x-github-delivery');
  const event = req.headers.get('x-github-event') || '';
  if (!guid) return NextResponse.json({ success: false, error: 'Missing delivery id' }, { status: 400 });
  if (!recordDelivery(guid)) return NextResponse.json({ success: true, duplicate: true });
  if (event === 'ping') return NextResponse.json({ success: true, pong: true });

  let triggered = false;
  const last = currentSync();
  const recent = last && Date.now() - new Date(last.startedAt).getTime() < 15_000;
  if (SYNC_EVENTS.has(event) && getDb().connection?.status === 'ok' && !recent) {
    startSync('webhook');
    triggered = true;
  }
  return NextResponse.json({ success: true, event, syncStarted: triggered });
}
