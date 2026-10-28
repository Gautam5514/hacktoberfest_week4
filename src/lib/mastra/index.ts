import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { AutopsyFinding, ArchitectureSummary, PatchProposal, VerificationRun } from '../types';
import { analyzeFileAst } from '../ast-analyzer';
import { generatePatchProposal, runSandboxVerification } from '../resurrection';

// ==========================================
// 1. MASTRA SCHEMAS
// ==========================================

export const FileItemSchema = z.object({
  path: z.string(),
  size: z.number(),
  language: z.string(),
  loc: z.number(),
});

export const ManifestSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  engines: z.record(z.string()).optional(),
  scripts: z.record(z.string()).optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
});

export const FindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(['compatibility', 'dependencies', 'runtime', 'security', 'architecture', 'tests']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.object({
    file: z.string(),
    lineStart: z.number().optional(),
    lineEnd: z.number().optional(),
    snippet: z.string().optional(),
    type: z.enum(['verified', 'observed', 'inferred', 'unverified']),
  })),
  explanation: z.string(),
  proposedFix: z.string(),
  verification: z.string(),
});

// ==========================================
// 2. MASTRA TOOLS
// ==========================================

export const listFilesTool = {
  id: 'listFiles',
  description: 'Inventories all source and manifest files inside the target repository workspace.',
  execute: async ({ repoPath }: { repoPath: string }) => {
    const files: Array<{ path: string; size: number; language: string; loc: number }> = [];
    
    function walk(dir: string, rel = '') {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (['node_modules', '.git', '.next', 'dist', 'build', '.DS_Store'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        const relPath = path.join(rel, entry.name);
        if (entry.isDirectory()) walk(full, relPath);
        else if (entry.isFile()) {
          const stat = fs.statSync(full);
          const ext = path.extname(entry.name).toLowerCase();
          const language = ext === '.ts' || ext === '.tsx' ? 'typescript' : ext === '.js' ? 'javascript' : ext === '.json' ? 'json' : 'text';
          const content = fs.readFileSync(full, 'utf8');
          files.push({
            path: relPath,
            size: stat.size,
            language,
            loc: content.split('\n').length
          });
        }
      }
    }

    walk(repoPath);
    return files;
  }
};

export const readFileTool = {
  id: 'readFile',
  description: 'Safely reads contents of a file within the workspace bounds.',
  execute: async ({ repoPath, filePath }: { repoPath: string; filePath: string }) => {
    const target = path.resolve(repoPath, filePath);
    if (!target.startsWith(path.resolve(repoPath))) {
      throw new Error('Access outside workspace boundary is strictly forbidden.');
    }
    if (!fs.existsSync(target)) throw new Error(`File not found: ${filePath}`);
    return fs.readFileSync(target, 'utf8');
  }
};

export const inspectManifestTool = {
  id: 'inspectManifest',
  description: 'Parses and validates package.json and lockfiles.',
  execute: async ({ repoPath }: { repoPath: string }) => {
    const pkgPath = path.join(repoPath, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    const content = fs.readFileSync(pkgPath, 'utf8');
    return JSON.parse(content);
  }
};

export const checkDependenciesTool = {
  id: 'checkDependencies',
  description: 'Identifies obsolete, deprecated, or vulnerable dependencies.',
  execute: async ({ manifest }: { manifest: any }) => {
    const deprecatedPackages: Record<string, string> = {
      'request': 'Deprecated in 2020. Use native fetch or axios.',
      'node-sass': 'Fails to compile on modern Node.js. Use Dart Sass.',
      '@babel/polyfill': 'Deprecated since Babel 7.4. Use core-js directly.',
      'babel-core': 'Obsolete Babel 6 library.',
      'left-pad': 'Historic obsolete package.',
      'optimist': 'Abandoned CLI parser.',
      'nomnom': 'Deprecated since 2014.',
    };

    const issues: Array<{ package: string; reason: string }> = [];
    if (!manifest) return issues;
    const all = { ...(manifest.dependencies || {}), ...(manifest.devDependencies || {}) };
    for (const [pkg, reason] of Object.entries(deprecatedPackages)) {
      if (all[pkg]) issues.push({ package: pkg, reason });
    }
    return issues;
  }
};

// ==========================================
// 3. MASTRA RECOVERY AGENT & WORKFLOW
// ==========================================

export class MastraRecoveryWorkflow {
  private repoPath: string;
  private repoId: string;

  constructor(repoPath: string, repoId: string) {
    this.repoPath = repoPath;
    this.repoId = repoId;
  }

  public async runStage1Discovery() {
    return await listFilesTool.execute({ repoPath: this.repoPath });
  }

  public async runStage2StaticDiagnosis() {
    const files = await this.runStage1Discovery();
    const manifest = await inspectManifestTool.execute({ repoPath: this.repoPath });
    const depIssues = await checkDependenciesTool.execute({ manifest });

    const findings: AutopsyFinding[] = [];
    let count = 0;
    const nextId = () => `finding_${this.repoId}_${String(++count).padStart(3, '0')}`;

    // 1. Dependency Findings
    for (const dep of depIssues) {
      findings.push({
        id: nextId(),
        repositoryId: this.repoId,
        title: `Deprecated dependency: ${dep.package}`,
        category: 'dependencies',
        severity: dep.package === 'node-sass' ? 'critical' : 'high',
        confidence: 0.99,
        evidence: [{
          file: 'package.json',
          type: 'verified',
          snippet: `"${dep.package}": "..."`
        }],
        explanation: dep.reason,
        proposedFix: `Replace ${dep.package} with modern runtime equivalent.`,
        verification: `Confirm clean build without ${dep.package}.`,
        status: 'unresolved'
      });
    }

    // 2. Deep AST Analysis for each source file
    for (const file of files) {
      if (['javascript', 'typescript'].includes(file.language)) {
        const fullPath = path.join(this.repoPath, file.path);
        const astDiags = analyzeFileAst(fullPath, file.path, this.repoPath);

        for (const diag of astDiags) {
          findings.push({
            id: nextId(),
            repositoryId: this.repoId,
            title: diag.title,
            category: diag.category,
            severity: diag.severity,
            confidence: 0.98,
            evidence: [{
              file: diag.file,
              lineStart: diag.lineStart,
              lineEnd: diag.lineEnd,
              snippet: diag.snippet,
              type: 'verified'
            }],
            explanation: diag.explanation,
            proposedFix: diag.proposedFix,
            verification: diag.verification,
            status: 'unresolved'
          });
        }
      }
    }

    return { files, manifest, findings };
  }

  public async runStage3Reasoning(findings: AutopsyFinding[], manifest: any, files: any[]) {
    const targetNode = manifest?.engines?.node || 'Node 12-14 (legacy)';
    const totalLoc = files.reduce((acc, f) => acc + f.loc, 0);
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;
    const healthScore = Math.max(10, Math.min(100, 100 - (criticalCount * 25 + highCount * 12 + findings.length * 3)));

    const architecture: ArchitectureSummary = {
      originalPurpose: manifest?.description || 'Abandoned utility / application library from early JavaScript ecosystem.',
      targetRuntime: `Node.js ${targetNode}`,
      modernRuntime: 'Node.js 22.x LTS',
      techStack: manifest?.dependencies?.express ? ['Express', 'Node.js'] : ['Node.js', 'JavaScript'],
      reusableComponents: files.filter(f => f.loc > 20).map(f => f.path),
      revivalStrategy: `1. Modernize package.json dependencies and declare modern Node 22 engines.\n2. Replace deprecated APIs (Buffer, crypto, request) with modern standards.\n3. Resolve broken module imports and align CommonJS/ESM modules.\n4. Execute verification tests in isolated sandbox.`,
      healthScore,
      locCount: totalLoc,
      fileCount: files.length
    };

    return architecture;
  }

  public async runStage4PatchProposal(findings: AutopsyFinding[]) {
    return generatePatchProposal(this.repoId, this.repoPath, findings);
  }

  public async runStage5Verification(patch: PatchProposal) {
    return await runSandboxVerification(this.repoPath, patch);
  }
}
