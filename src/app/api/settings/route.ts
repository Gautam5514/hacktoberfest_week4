import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { z } from 'zod';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const SettingsSchema = z.object({
  ollamaEndpoint: z.string().url().refine(u => {
    const { protocol, hostname } = new URL(u);
    return (protocol === 'http:' || protocol === 'https:') && LOCAL_HOSTS.has(hostname);
  }, 'Ollama endpoint must be on localhost'),
  modelName: z.string().min(1).max(100),
  temperature: z.number().min(0).max(2),
  enableFallback: z.boolean(),
  autoVerify: z.boolean(),
  sandboxTimeoutSeconds: z.number().int().min(1).max(300)
}).partial().strict();

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
    const parsed = SettingsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues.map(i => i.message).join('; ') }, { status: 400 });
    }
    const updated = store.updateSettings(parsed.data);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
