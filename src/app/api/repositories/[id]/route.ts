import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const repo = store.getRepository(id);
    if (!repo) {
      return NextResponse.json({ success: false, error: 'Repository not found' }, { status: 404 });
    }

    const findings = store.getFindings(id);
    const architecture = store.getArchitecture(id);
    const patch = store.getPatch(id);
    const verification = store.getVerification(id);

    return NextResponse.json({
      success: true,
      repository: repo,
      findings,
      architecture,
      patch,
      verification
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
