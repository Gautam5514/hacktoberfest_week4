import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { store } from '@/lib/store';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const requestedFile = searchParams.get('file');

    const repo = store.getRepository(id);
    if (!repo) {
      return NextResponse.json({ success: false, error: 'Repository not found' }, { status: 404 });
    }

    if (!fs.existsSync(repo.workspacePath)) {
      return NextResponse.json({ success: false, error: 'Workspace path does not exist' }, { status: 404 });
    }

    // If a specific file is requested, read its content
    if (requestedFile) {
      const fullPath = path.resolve(repo.workspacePath, requestedFile);
      if (!fullPath.startsWith(path.resolve(repo.workspacePath))) {
        return NextResponse.json({ success: false, error: 'Access forbidden outside workspace' }, { status: 403 });
      }
      if (!fs.existsSync(fullPath)) {
        return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      return NextResponse.json({ success: true, file: requestedFile, content });
    }

    // Otherwise, return file tree
    const fileList: Array<{ path: string; size: number; language: string; loc: number }> = [];
    const walk = (dir: string, rel = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (['node_modules', '.git', '.next', 'dist', 'build', '.DS_Store'].includes(e.name)) continue;
        const full = path.join(dir, e.name);
        const r = path.join(rel, e.name);
        if (e.isDirectory()) walk(full, r);
        else if (e.isFile()) {
          const stat = fs.statSync(full);
          const ext = path.extname(e.name).toLowerCase();
          const language = ext === '.ts' || ext === '.tsx' ? 'typescript' : ext === '.js' ? 'javascript' : ext === '.json' ? 'json' : 'text';
          const content = fs.readFileSync(full, 'utf8');
          fileList.push({ path: r, size: stat.size, language, loc: content.split('\n').length });
        }
      }
    };

    walk(repo.workspacePath);
    return NextResponse.json({ success: true, files: fileList });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
