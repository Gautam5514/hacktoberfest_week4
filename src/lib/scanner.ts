import fs from 'fs';
import path from 'path';
import { AutopsyFinding, ArchitectureSummary, FindingEvidence, FindingCategory, FindingSeverity } from './types';

export interface ScanResult {
  fileInventory: Array<{ path: string; size: number; language: string; loc: number }>;
  findings: AutopsyFinding[];
  architecture: ArchitectureSummary;
  manifest: any | null;
}

const DEPRECATED_NPM_PACKAGES: Record<string, { replacement: string; severity: FindingSeverity; reason: string }> = {
  'request': { replacement: 'native fetch or undici / axios', severity: 'high', reason: 'Deprecated in 2020 and unmaintained. Causes memory leaks and lacks modern HTTP/2 support.' },
  'node-sass': { replacement: 'sass (Dart Sass)', severity: 'critical', reason: 'Fails to compile on Node.js 16+ due to native C++ binding incompatibilities (LibSass deprecated).' },
  '@babel/polyfill': { replacement: 'core-js/stable and regenerator-runtime/runtime', severity: 'medium', reason: 'Deprecated since Babel 7.4.0 in favor of direct core-js inclusions.' },
  'babel-core': { replacement: '@babel/core', severity: 'high', reason: 'Obsolete Babel 6 core library, incompatible with modern ECMAScript proposals and TypeScript.' },
  'left-pad': { replacement: 'String.prototype.padStart()', severity: 'low', reason: 'Historic obsolete package, native JavaScript padStart is standard.' },
  'optimist': { replacement: 'yargs or commander', severity: 'medium', reason: 'Deprecated and abandoned CLI argument parser.' },
  'nomnom': { replacement: 'commander or meow', severity: 'medium', reason: 'Deprecated since 2014.' },
  'querystring': { replacement: 'URLSearchParams', severity: 'low', reason: 'Node.js querystring API is legacy; URLSearchParams is standard.' },
  'colors': { replacement: 'picocolors or chalk', severity: 'medium', reason: 'Security issues and protestware history in 1.4.x releases.' },
};

const DEPRECATED_NODE_APIS = [
  {
    regex: /new\s+Buffer\s*\(/g,
    title: 'Deprecated new Buffer() constructor',
    category: 'security' as FindingCategory,
    severity: 'high' as FindingSeverity,
    explanation: 'new Buffer() was deprecated in Node.js 6 and poses security risks (uninitialized memory exposure). Use Buffer.from() or Buffer.alloc().',
    proposedFix: 'Replace new Buffer(arg) with Buffer.from(arg) for strings/arrays or Buffer.alloc(arg) for sizes.',
    verification: 'Verify with Node.js runtime execution without DEP0005 deprecation warnings.'
  },
  {
    regex: /fs\.exists\s*\(/g,
    title: 'Deprecated fs.exists() method',
    category: 'runtime' as FindingCategory,
    severity: 'medium' as FindingSeverity,
    explanation: 'fs.exists() is an asynchronous method that does not follow the standard Node.js error-first callback signature and is prone to race conditions.',
    proposedFix: 'Use fs.stat, fs.access, or fs.existsSync instead.',
    verification: 'Run test suite to confirm file existence check succeeds without deprecation notices.'
  },
  {
    regex: /crypto\.createCipher\s*\(/g,
    title: 'Insecure crypto.createCipher() usage',
    category: 'security' as FindingCategory,
    severity: 'critical' as FindingSeverity,
    explanation: 'crypto.createCipher() derives keys using MD5 without an initialization vector (IV), which is vulnerable and removed in modern Node.js versions.',
    proposedFix: 'Use crypto.createCipheriv() with an explicit initialization vector (IV) and key derivation like PBKDF2 or scrypt.',
    verification: 'Verify encryption/decryption works on modern Node.js runtime.'
  },
  {
    regex: /sys\.puts\s*\(|util\.print\s*\(/g,
    title: 'Obsolete sys/util logging calls',
    category: 'runtime' as FindingCategory,
    severity: 'high' as FindingSeverity,
    explanation: 'sys.puts() and util.print() were removed from modern Node.js runtimes, causing fatal runtime exceptions.',
    proposedFix: 'Replace with console.log() or process.stdout.write().',
    verification: 'Execute script to ensure logging executes cleanly.'
  }
];

export function scanRepository(repoPath: string, repoId: string): ScanResult {
  const fileInventory: ScanResult['fileInventory'] = [];
  const findings: AutopsyFinding[] = [];
  let findingCount = 0;

  const getNextFindingId = () => `finding_${repoId}_${String(++findingCount).padStart(3, '0')}`;

  function walkDir(currentPath: string, relPath = '') {
    if (!fs.existsSync(currentPath)) return;
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryRel = path.join(relPath, entry.name);
      const entryFull = path.join(currentPath, entry.name);

      // Ignore noise
      if (['node_modules', '.git', '.next', 'dist', 'build', '.DS_Store', 'coverage'].includes(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        walkDir(entryFull, entryRel);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(entryFull);
          const ext = path.extname(entry.name).toLowerCase();
          const language = getLanguageFromExt(ext);
          
          let loc = 0;
          if (['javascript', 'typescript', 'json', 'markdown', 'html', 'css'].includes(language)) {
            const content = fs.readFileSync(entryFull, 'utf8');
            loc = content.split('\n').length;
          }

          fileInventory.push({
            path: entryRel,
            size: stat.size,
            language,
            loc
          });
        } catch (e) {
          // ignore unreadable file
        }
      }
    }
  }

  walkDir(repoPath);

  // 1. Analyze package.json
  const packageJsonPath = path.join(repoPath, 'package.json');
  let manifest: any = null;

  if (fs.existsSync(packageJsonPath)) {
    try {
      const rawContent = fs.readFileSync(packageJsonPath, 'utf8');
      manifest = JSON.parse(rawContent);
      const lines = rawContent.split('\n');

      // Check engines
      if (manifest.engines && manifest.engines.node) {
        const engineSpec = manifest.engines.node;
        if (engineSpec.includes('8') || engineSpec.includes('10') || engineSpec.includes('12') || engineSpec.includes('14')) {
          const lineIndex = lines.findIndex(l => l.includes('"node"'));
          findings.push({
            id: getNextFindingId(),
            repositoryId: repoId,
            title: `Outdated Node.js engine specification (${engineSpec})`,
            category: 'runtime',
            severity: 'high',
            confidence: 0.98,
            evidence: [{
              file: 'package.json',
              lineStart: lineIndex >= 0 ? lineIndex + 1 : 1,
              lineEnd: lineIndex >= 0 ? lineIndex + 1 : 1,
              snippet: lines[lineIndex >= 0 ? lineIndex : 0]?.trim(),
              type: 'verified'
            }],
            explanation: `The repository declares compatibility with Node.js ${engineSpec}, which reached End-of-Life. Modern runtimes (Node 20/22 LTS) will trigger deprecation warnings or fail strict engine checks.`,
            proposedFix: 'Update package.json "engines": { "node": ">=20.0.0" } and test build scripts.',
            verification: 'Run npm or node on current environment to ensure engine constraint passes.',
            status: 'unresolved'
          });
        }
      } else {
        findings.push({
          id: getNextFindingId(),
          repositoryId: repoId,
          title: 'Missing Node.js engine constraint',
          category: 'compatibility',
          severity: 'low',
          confidence: 0.90,
          evidence: [{
            file: 'package.json',
            lineStart: 1,
            lineEnd: 2,
            snippet: '{\n  "name": "' + (manifest.name || 'app') + '"',
            type: 'observed'
          }],
          explanation: 'No "engines" field found in package.json. Users on differing Node versions may encounter unexpected runtime failures.',
          proposedFix: 'Specify explicit target engine in package.json: "engines": { "node": ">=20.0.0" }.',
          verification: 'Validate package.json schema.',
          status: 'unresolved'
        });
      }

      // Check dependencies for deprecated packages
      const allDeps = { ...(manifest.dependencies || {}), ...(manifest.devDependencies || {}) };
      for (const [dep, version] of Object.entries(allDeps)) {
        if (DEPRECATED_NPM_PACKAGES[dep]) {
          const info = DEPRECATED_NPM_PACKAGES[dep];
          const lineIndex = lines.findIndex(l => l.includes(`"${dep}"`));
          findings.push({
            id: getNextFindingId(),
            repositoryId: repoId,
            title: `Deprecated dependency: ${dep} (${version})`,
            category: 'dependencies',
            severity: info.severity,
            confidence: 0.99,
            evidence: [{
              file: 'package.json',
              lineStart: lineIndex >= 0 ? lineIndex + 1 : 1,
              lineEnd: lineIndex >= 0 ? lineIndex + 1 : 1,
              snippet: lines[lineIndex >= 0 ? lineIndex : 0]?.trim(),
              type: 'verified'
            }],
            explanation: `${dep} is deprecated. ${info.reason}`,
            proposedFix: `Replace ${dep} with modern alternative: ${info.replacement}.`,
            verification: `Remove ${dep} from package.json and verify code compiles without references to ${dep}.`,
            status: 'unresolved'
          });
        }
      }

      // Check scripts
      const scripts = manifest.scripts || {};
      if (!scripts.test || scripts.test.includes('no test specified')) {
        findings.push({
          id: getNextFindingId(),
          repositoryId: repoId,
          title: 'Missing or placeholder test script',
          category: 'tests',
          severity: 'medium',
          confidence: 0.95,
          evidence: [{
            file: 'package.json',
            lineStart: 1,
            lineEnd: 5,
            snippet: `"scripts": ${JSON.stringify(scripts)}`,
            type: 'verified'
          }],
          explanation: 'No executable test suite is defined in package.json. Code cannot be automatically verified in sandbox environments.',
          proposedFix: 'Configure a standard test runner (Vitest, Jest, or native node:test) with a runnable script.',
          verification: 'Run npm test in isolated container.',
          status: 'unresolved'
        });
      }

    } catch (e) {
      findings.push({
        id: getNextFindingId(),
        repositoryId: repoId,
        title: 'Malformed package.json syntax',
        category: 'compatibility',
        severity: 'critical',
        confidence: 1.0,
        evidence: [{
          file: 'package.json',
          lineStart: 1,
          snippet: 'Invalid JSON',
          type: 'verified'
        }],
        explanation: 'The package.json file contains syntax errors and cannot be parsed by npm or package managers.',
        proposedFix: 'Correct JSON syntax in package.json.',
        verification: 'Run JSON.parse() on package.json content.',
        status: 'unresolved'
      });
    }
  } else {
    findings.push({
      id: getNextFindingId(),
      repositoryId: repoId,
      title: 'Missing package.json manifest',
      category: 'architecture',
      severity: 'critical',
      confidence: 1.0,
      evidence: [{
        file: '/',
        type: 'verified',
        snippet: 'Directory root lacks package.json'
      }],
      explanation: 'No JavaScript/Node package manifest was detected in the project root.',
      proposedFix: 'Initialize package.json with project dependencies and metadata.',
      verification: 'Ensure package.json exists.',
      status: 'unresolved'
    });
  }

  // 2. Scan source code files for deprecated APIs and broken relative imports
  for (const item of fileInventory) {
    if (['javascript', 'typescript'].includes(item.language)) {
      const fullPath = path.join(repoPath, item.path);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        // Check deprecated node APIs
        for (const apiCheck of DEPRECATED_NODE_APIS) {
          let match;
          const regex = new RegExp(apiCheck.regex);
          while ((match = regex.exec(content)) !== null) {
            const beforeMatch = content.substring(0, match.index);
            const lineNum = beforeMatch.split('\n').length;
            const snippet = lines[lineNum - 1]?.trim() || match[0];

            findings.push({
              id: getNextFindingId(),
              repositoryId: repoId,
              title: `${apiCheck.title} in ${item.path}`,
              category: apiCheck.category,
              severity: apiCheck.severity,
              confidence: 0.95,
              evidence: [{
                file: item.path,
                lineStart: lineNum,
                lineEnd: lineNum,
                snippet,
                type: 'verified'
              }],
              explanation: `${apiCheck.explanation} Found in ${item.path}:${lineNum}.`,
              proposedFix: apiCheck.proposedFix,
              verification: apiCheck.verification,
              status: 'unresolved'
            });
          }
        }

        // Check for broken relative imports
        // Match import ... from './...' or require('./...')
        const importRegex = /(?:import\s+(?:[\w*\s{},]+)\s+from\s+['"](\.[^'"]+)['"]|require\s*\(\s*['"](\.[^'"]+)['"]\s*\))/g;
        let impMatch;
        while ((impMatch = importRegex.exec(content)) !== null) {
          const importPath = impMatch[1] || impMatch[2];
          const dir = path.dirname(fullPath);
          const resolvedBase = path.resolve(dir, importPath);

          // Check possible extensions
          const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '.json', '/index.js', '/index.ts'];
          const exists = extensions.some(ext => fs.existsSync(resolvedBase + ext));

          if (!exists) {
            const beforeMatch = content.substring(0, impMatch.index);
            const lineNum = beforeMatch.split('\n').length;
            const snippet = lines[lineNum - 1]?.trim() || impMatch[0];

            findings.push({
              id: getNextFindingId(),
              repositoryId: repoId,
              title: `Broken local import: "${importPath}" in ${item.path}`,
              category: 'runtime',
              severity: 'critical',
              confidence: 0.99,
              evidence: [{
                file: item.path,
                lineStart: lineNum,
                lineEnd: lineNum,
                snippet,
                type: 'verified'
              }],
              explanation: `File ${item.path} attempts to import "${importPath}", but no matching file exists on disk. This will trigger a Cannot find module error at runtime.`,
              proposedFix: `Restore the missing file or update the import path to reference the correct module.`,
              verification: `Execute node on ${item.path} and confirm module resolution succeeds.`,
              status: 'unresolved'
            });
          }
        }

      } catch (e) {
        // file reading error
      }
    }
  }

  // 3. Synthesize Architecture Summary
  const techStack: string[] = [];
  if (manifest) {
    if (manifest.dependencies?.react || manifest.devDependencies?.react) techStack.push('React');
    if (manifest.dependencies?.express) techStack.push('Express.js');
    if (manifest.dependencies?.next) techStack.push('Next.js');
    if (fileInventory.some(f => f.language === 'typescript')) techStack.push('TypeScript');
    else techStack.push('JavaScript');
  }

  const totalLoc = fileInventory.reduce((acc, f) => acc + f.loc, 0);
  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;
  const healthScore = Math.max(10, Math.min(100, 100 - (criticalCount * 25 + highCount * 12 + findings.length * 3)));

  const architecture: ArchitectureSummary = {
    originalPurpose: manifest?.description || 'Abandoned utility / application library from early JavaScript ecosystem.',
    targetRuntime: manifest?.engines?.node ? `Node.js ${manifest.engines.node}` : 'Node.js 12.x - 14.x (Estimated)',
    modernRuntime: 'Node.js 22.x LTS',
    techStack: techStack.length > 0 ? techStack : ['Node.js', 'JavaScript'],
    reusableComponents: fileInventory.filter(f => f.loc > 20 && !findings.some(find => find.evidence.some(e => e.file === f.path && find.severity === 'critical'))).map(f => f.path),
    revivalStrategy: `1. Modernize package.json dependencies and declare modern Node 22 engines.\n2. Replace deprecated APIs (Buffer, crypto, request) with modern standards.\n3. Resolve broken module imports and align CommonJS/ESM modules.\n4. Execute verification tests in isolated sandbox.`,
    healthScore,
    locCount: totalLoc,
    fileCount: fileInventory.length
  };

  return {
    fileInventory,
    findings,
    architecture,
    manifest
  };
}

function getLanguageFromExt(ext: string): string {
  switch (ext) {
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.ts':
    case '.mts':
    case '.cts':
      return 'typescript';
    case '.jsx':
      return 'jsx';
    case '.tsx':
      return 'tsx';
    case '.json':
      return 'json';
    case '.md':
      return 'markdown';
    case '.html':
      return 'html';
    case '.css':
      return 'css';
    default:
      return 'other';
  }
}
