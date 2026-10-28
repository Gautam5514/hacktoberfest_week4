import fs from 'fs';
import path from 'path';
import { 
  Repository, 
  AnalysisJob, 
  AutopsyFinding, 
  ArchitectureSummary, 
  GhostMessage, 
  PatchProposal, 
  VerificationRun, 
  ResurrectionReport,
  AppSettings 
} from './types';
import { scanRepository } from './scanner';
import { generatePatchProposal, runSandboxVerification } from './resurrection';

const DATA_FILE = path.join(process.cwd(), '.lastcommit_data.json');

export interface AppDatabase {
  repositories: Record<string, Repository>;
  jobs: Record<string, AnalysisJob>;
  findings: Record<string, AutopsyFinding[]>;
  architectures: Record<string, ArchitectureSummary>;
  messages: Record<string, GhostMessage[]>;
  patches: Record<string, PatchProposal>;
  verifications: Record<string, VerificationRun>;
  reports: Record<string, ResurrectionReport>;
  settings: AppSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
  ollamaEndpoint: 'http://localhost:11434',
  modelName: 'gemma3:4b',
  temperature: 0.2,
  enableFallback: true,
  autoVerify: true,
  sandboxTimeoutSeconds: 30
};

// Seed initial graveyard specimens
function getSeedData(): AppDatabase {
  const brokenSamplePath = path.join(process.cwd(), 'examples/broken-js-app');

  const seedRepos: Record<string, Repository> = {
    'sample-broken-app': {
      id: 'sample-broken-app',
      name: 'markdown-tomb-parser',
      owner: 'abandoned-lab',
      description: 'A 2016 Markdown metadata extractor and AST compiler that fails under modern Node 20+ due to deprecated Buffer constructors and broken imports.',
      sourceUrl: 'https://github.com/abandoned-lab/markdown-tomb-parser',
      commitSha: 'a1b2c3d9e8f7',
      workspacePath: brokenSamplePath,
      lastCommitDate: '2016-11-04T14:22:00Z',
      stars: 412,
      forks: 38,
      status: 'dormant',
      deathCause: 'Node.js 6 -> 20+ API break (new Buffer & broken relative import)',
      deathYear: 2016,
      language: 'javascript',
      tags: ['Markdown', 'CLI', 'Node.js 6', 'Buffer Deprecation'],
      createdAt: new Date().toISOString()
    },
    'express-vintage-2016': {
      id: 'express-vintage-2016',
      name: 'auth-vault-microservice',
      owner: 'legacy-systems',
      description: 'Early OAuth token broker relying on unmaintained request npm package and obsolete crypto.createCipher() calls.',
      sourceUrl: 'https://github.com/legacy-systems/auth-vault-microservice',
      commitSha: '8f7e6d5c4b3a',
      workspacePath: brokenSamplePath,
      lastCommitDate: '2017-03-12T09:15:00Z',
      stars: 890,
      forks: 145,
      status: 'dormant',
      deathCause: 'Insecure crypto.createCipher() deprecation & request package death',
      deathYear: 2017,
      language: 'javascript',
      tags: ['Express', 'Auth', 'Deprecated Crypto', 'Request'],
      createdAt: new Date().toISOString()
    },
    'angularjs-tombstone': {
      id: 'angularjs-tombstone',
      name: 'dash-metrics-angular',
      owner: 'spectral-corp',
      description: 'AngularJS 1.5 data visualization dashboard frozen in time with Gulp 3 and obsolete Node-Sass native bindings.',
      sourceUrl: 'https://github.com/spectral-corp/dash-metrics-angular',
      commitSha: 'c3d4e5f6a1b2',
      workspacePath: brokenSamplePath,
      lastCommitDate: '2015-08-20T17:40:00Z',
      stars: 230,
      forks: 41,
      status: 'dormant',
      deathCause: 'LibSass / Node-Sass compilation failure on modern V8 engines',
      deathYear: 2015,
      language: 'javascript',
      tags: ['AngularJS 1.x', 'Gulp 3', 'Node-Sass', 'Legacy Frontend'],
      createdAt: new Date().toISOString()
    }
  };

  return {
    repositories: seedRepos,
    jobs: {},
    findings: {},
    architectures: {},
    messages: {},
    patches: {},
    verifications: {},
    reports: {},
    settings: DEFAULT_SETTINGS
  };
}

class Store {
  private db: AppDatabase;

  constructor() {
    this.db = this.load();
  }

  private load(): AppDatabase {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          ...getSeedData(),
          ...parsed,
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) }
        };
      }
    } catch (e) {
      // ignore
    }
    const initial = getSeedData();
    this.saveData(initial);
    return initial;
  }

  private saveData(data: AppDatabase) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      // ignore
    }
  }

  private persist() {
    this.saveData(this.db);
  }

  // Repository Methods
  public getRepositories(): Repository[] {
    return Object.values(this.db.repositories);
  }

  public getRepository(id: string): Repository | null {
    return this.db.repositories[id] || null;
  }

  public saveRepository(repo: Repository): Repository {
    this.db.repositories[repo.id] = repo;
    this.persist();
    return repo;
  }

  // Autopsy & Analysis
  public runAutopsy(repoId: string): { job: AnalysisJob; findings: AutopsyFinding[]; architecture: ArchitectureSummary } {
    const repo = this.getRepository(repoId);
    if (!repo) throw new Error(`Repository not found: ${repoId}`);

    // Create job
    const jobId = `job_${repoId}_${Date.now().toString(36)}`;
    const job: AnalysisJob = {
      id: jobId,
      repositoryId: repoId,
      status: 'SCANNING',
      stage: 'Static Autopsy & Manifest Parsing',
      progress: 35,
      currentStep: 'Parsing package.json, lockfiles, and AST references...',
      events: [
        {
          id: `evt_1`,
          sequence: 1,
          timestamp: new Date().toISOString(),
          stage: 'IMPORTING',
          message: `Workspace initialized at ${repo.workspacePath}`,
          level: 'info'
        },
        {
          id: `evt_2`,
          sequence: 2,
          timestamp: new Date().toISOString(),
          stage: 'SCANNING',
          message: `Scanning files, imports, and deprecated runtime constructs...`,
          level: 'info'
        }
      ],
      startedAt: new Date().toISOString()
    };

    // Scan
    const scanResult = scanRepository(repo.workspacePath, repoId);

    // Update job to completed
    job.status = 'REPORT_READY';
    job.stage = 'Autopsy Complete';
    job.progress = 100;
    job.currentStep = `Identified ${scanResult.findings.length} findings across ${scanResult.fileInventory.length} files.`;
    job.completedAt = new Date().toISOString();
    job.events.push({
      id: `evt_3`,
      sequence: 3,
      timestamp: new Date().toISOString(),
      stage: 'REPORT_READY',
      message: `Autopsy report generated with Health Score ${scanResult.architecture.healthScore}/100.`,
      level: 'success'
    });

    this.db.jobs[jobId] = job;
    this.db.findings[repoId] = scanResult.findings;
    this.db.architectures[repoId] = scanResult.architecture;

    // Pre-populate Ghost greeting
    if (!this.db.messages[repoId] || this.db.messages[repoId].length === 0) {
      this.db.messages[repoId] = [
        {
          id: `msg_init_${Date.now()}`,
          conversationId: repoId,
          role: 'assistant',
          content: `I am **The Ghost**, monitoring the autopsy of **${repo.name}**.\n\n` +
            `I have indexed ${scanResult.fileInventory.length} source files and uncovered **${scanResult.findings.length} points of failure** ` +
            `preventing this code from running on modern Node.js. ` +
            `Feel free to ask me what this project did, why it broke, or request an explanation of any specific finding.`,
          timestamp: new Date().toISOString()
        }
      ];
    }

    this.persist();
    return { job, findings: scanResult.findings, architecture: scanResult.architecture };
  }

  public getFindings(repoId: string): AutopsyFinding[] {
    if (!this.db.findings[repoId]) {
      // Auto-trigger autopsy if not yet scanned
      this.runAutopsy(repoId);
    }
    return this.db.findings[repoId] || [];
  }

  public getArchitecture(repoId: string): ArchitectureSummary {
    if (!this.db.architectures[repoId]) {
      this.runAutopsy(repoId);
    }
    return this.db.architectures[repoId];
  }

  // Ghost Chat
  public getMessages(repoId: string): GhostMessage[] {
    return this.db.messages[repoId] || [];
  }

  public addMessage(repoId: string, message: GhostMessage): GhostMessage {
    if (!this.db.messages[repoId]) this.db.messages[repoId] = [];
    this.db.messages[repoId].push(message);
    this.persist();
    return message;
  }

  // Patches & Verification
  public createPatch(repoId: string): PatchProposal {
    const repo = this.getRepository(repoId);
    if (!repo) throw new Error(`Repository not found: ${repoId}`);
    const findings = this.getFindings(repoId);

    const patch = generatePatchProposal(repoId, repo.workspacePath, findings);
    this.db.patches[repoId] = patch;
    this.persist();
    return patch;
  }

  public getPatch(repoId: string): PatchProposal | null {
    if (!this.db.patches[repoId]) {
      return this.createPatch(repoId);
    }
    return this.db.patches[repoId] || null;
  }

  public async verifyPatch(repoId: string): Promise<VerificationRun> {
    const repo = this.getRepository(repoId);
    if (!repo) throw new Error(`Repository not found: ${repoId}`);
    const patch = this.getPatch(repoId);
    if (!patch) throw new Error(`No patch available for repository: ${repoId}`);

    const result = await runSandboxVerification(repo.workspacePath, patch);
    this.db.verifications[repoId] = result;

    if (result.status === 'passed') {
      patch.status = 'VERIFIED';
      repo.status = 'resurrected';
    } else {
      patch.status = 'APPLIED_TO_SANDBOX';
    }

    this.persist();
    return result;
  }

  public getVerification(repoId: string): VerificationRun | null {
    return this.db.verifications[repoId] || null;
  }

  // Report
  public getReport(repoId: string): ResurrectionReport {
    const repo = this.getRepository(repoId);
    if (!repo) throw new Error(`Repository not found: ${repoId}`);
    const findings = this.getFindings(repoId);
    const architecture = this.getArchitecture(repoId);
    const patch = this.getPatch(repoId);
    const verification = this.getVerification(repoId);

    const report: ResurrectionReport = {
      id: `report_${repoId}`,
      repositoryId: repoId,
      modelName: this.db.settings.modelName,
      createdAt: new Date().toISOString(),
      summary: `Resurrection report for ${repo.name}. Evaluated ${findings.length} findings, generated unified modernizing patch, and executed sandbox verification.`,
      architecture,
      findings,
      patch,
      verification,
      offlineVerified: true
    };

    this.db.reports[repoId] = report;
    this.persist();
    return report;
  }

  // Settings
  public getSettings(): AppSettings {
    return this.db.settings;
  }

  public updateSettings(settings: Partial<AppSettings>): AppSettings {
    this.db.settings = { ...this.db.settings, ...settings };
    this.persist();
    return this.db.settings;
  }
}

export const store = new Store();
