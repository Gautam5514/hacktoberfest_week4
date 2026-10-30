import { NextResponse } from 'next/server';
import { summary } from '@/lib/github/views';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ success: true, ...summary() });
}
