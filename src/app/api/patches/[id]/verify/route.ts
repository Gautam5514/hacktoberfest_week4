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
    // patch ids look like patch_<repoId>_<timestamp>; repo ids may contain underscores
    const patchMatch = id.match(/^patch_(.+)_[^_]+$/);
    if (patchMatch) repoId = patchMatch[1];

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
