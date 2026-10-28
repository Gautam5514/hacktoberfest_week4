import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const patch = store.getPatch(id);
    return NextResponse.json({ success: true, patch });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const patch = store.createPatch(id);
    return NextResponse.json({ success: true, patch });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
