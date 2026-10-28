import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET() {
  try {
    const settings = store.getSettings();
    
    // Check live Ollama status
    let ollamaOnline = false;
    let availableModels: string[] = [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${settings.ollamaEndpoint}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        ollamaOnline = true;
        const data = await res.json();
        availableModels = (data.models || []).map((m: any) => m.name);
      }
    } catch (e) {
      // offline
    }

    return NextResponse.json({
      success: true,
      settings,
      ollamaStatus: {
        online: ollamaOnline,
        availableModels,
        detectedHardware: 'Apple Silicon / Metal (On-Device Inference)',
        activeModel: settings.modelName
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const updated = store.updateSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
