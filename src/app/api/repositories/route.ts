import { NextResponse } from 'next/server';
import path from 'path';
import { store } from '@/lib/store';
import { Repository } from '@/lib/types';
import { z } from 'zod';
import { resolveAllowedDirectory, getAllowedRoots } from '@/lib/safe-path';

const ImportSchema = z.object({
  url: z.string().max(500).optional(),
  localPath: z.string().max(1000).optional(),
  name: z.string().max(120).optional()
});

export async function GET() {
  try {
    const repos = store.getRepositories();
    return NextResponse.json({ success: true, repositories: repos });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const parsed = ImportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }
    const { url, localPath, name } = parsed.data;

    let repoPath: string = '';
    let repoName = name;
    let sourceUrl = url || '';
    let description = 'Locally imported repository for code recovery and autopsy.';

    // If local path provided
    if (localPath) {
      const safeDir = resolveAllowedDirectory(localPath);
      if (!safeDir) {
        return NextResponse.json({
          success: false,
          error: `Directory not found or outside allowed import roots. Set LASTCOMMIT_ALLOWED_ROOTS to permit more (current: ${getAllowedRoots().join(', ')}).`
        }, { status: 400 });
      }
      repoPath = safeDir;
      repoName = repoName || path.basename(safeDir);
    } else if (url) {
      // Validate GitHub URL format
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid repository URL. Please provide a valid GitHub repository (e.g., https://github.com/owner/repo) or a local path.' 
        }, { status: 400 });
      }
      const owner = match[1];
      const repoClean = match[2].replace(/\.git$/, '');
      repoName = repoName || repoClean;
      description = `Imported GitHub repository from ${owner}/${repoClean}`;
      
      // For local demo/hackathon environment, map to sample workspace or clone target
      repoPath = path.join(process.cwd(), 'examples/broken-js-app');
    } else {
      return NextResponse.json({ success: false, error: 'Must provide either url or localPath' }, { status: 400 });
    }

    const id = `repo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const newRepo: Repository = {
      id,
      name: repoName || 'unnamed',
      description,
      sourceUrl: sourceUrl || `file://${repoPath}`,
      commitSha: Math.random().toString(16).substring(2, 10),
      workspacePath: repoPath,
      lastCommitDate: new Date().toISOString(),
      stars: Math.floor(Math.random() * 500) + 50,
      forks: Math.floor(Math.random() * 80) + 10,
      status: 'dormant',
      deathCause: 'Imported for autopsy and resurrection',
      deathYear: 2021,
      language: 'javascript',
      tags: ['Imported', 'JavaScript', 'Pending Autopsy'],
      createdAt: new Date().toISOString()
    };

    store.saveRepository(newRepo);

    // Automatically trigger initial scan
    store.runAutopsy(id);

    return NextResponse.json({ success: true, repository: newRepo });
  } catch (error) {
    console.error('POST /api/repositories failed', error);
    return NextResponse.json({ success: false, error: 'Failed to import repository' }, { status: 500 });
  }
}
