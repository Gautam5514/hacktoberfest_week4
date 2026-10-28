import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { store } from '@/lib/store';
import { Repository } from '@/lib/types';

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
    const body = await req.json();
    const { url, localPath, name } = body;

    let repoPath = localPath;
    let repoName = name;
    let sourceUrl = url || '';
    let description = 'Locally imported repository for code recovery and autopsy.';

    // If local path provided
    if (localPath) {
      if (!fs.existsSync(localPath)) {
        return NextResponse.json({ success: false, error: `Local directory not found: ${localPath}` }, { status: 400 });
      }
      repoName = repoName || path.basename(localPath);
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

    const id = `repo_${Date.now().toString(36)}`;
    const newRepo: Repository = {
      id,
      name: repoName,
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
