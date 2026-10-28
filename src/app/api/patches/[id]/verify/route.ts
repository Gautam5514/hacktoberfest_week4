import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    // id can be repoId or patchId
    let repoId = id;
    if (id.startsWith('patch_')) {
      const parts = id.split('_');
      repoId = parts[1];
    }

    const verification = await store.verifyPatch(repoId);
    const patch = store.getPatch(repoId);

    return NextResponse.json({
      success: true,
      verification,
      patch
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
