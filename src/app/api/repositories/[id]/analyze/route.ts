import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const result = store.runAutopsy(id);

    return NextResponse.json({
      success: true,
      job: result.job,
      findings: result.findings,
      architecture: result.architecture
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
