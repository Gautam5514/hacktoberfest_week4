export type RepositoryStatus = 'dormant' | 'analyzing' | 'resurrected' | 'failed';

export interface Repository {
  id: string;
  name: string;
  owner?: string;
  description: string;
  sourceUrl: string;
  commitSha: string;
  workspacePath: string;
  lastCommitDate: string;
  stars?: number;
  forks?: number;
  status: RepositoryStatus;
  deathCause: string;
  deathYear: number;
  language: string;
  tags: string[];
  createdAt: string;
}

export type JobStage = 
  | 'QUEUED' 
  | 'IMPORTING' 
  | 'SCANNING' 
  | 'REASONING' 
  | 'REPORT_READY' 
  | 'PATCH_PROPOSED' 
  | 'VERIFYING' 
  | 'COMPLETED' 
  | 'FAILED';

export interface JobEvent {
  id: string;
  sequence: number;
  timestamp: string;
  stage: JobStage;
  message: string;
  level: 'info' | 'warn' | 'success' | 'error';
  payload?: Record<string, any>;
}

export interface AnalysisJob {
  id: string;
  repositoryId: string;
  status: JobStage;
  stage: string;
  progress: number; // 0 - 100
  currentStep: string;
  events: JobEvent[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export type FindingCategory = 
  | 'compatibility' 
  | 'dependencies' 
  | 'runtime' 
  | 'security' 
  | 'architecture' 
  | 'tests';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface FindingEvidence {
  file: string;
  lineStart?: number;
  lineEnd?: number;
  snippet?: string;
  type: 'verified' | 'observed' | 'inferred' | 'unverified';
}

export interface AutopsyFinding {
  id: string;
  repositoryId: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: number; // 0.0 - 1.0
  evidence: FindingEvidence[];
  explanation: string;
  proposedFix: string;
  verification: string;
  status: 'unresolved' | 'patched' | 'verified';
}

export interface ArchitectureSummary {
  originalPurpose: string;
  targetRuntime: string;
  modernRuntime: string;
  techStack: string[];
  reusableComponents: string[];
  revivalStrategy: string;
  healthScore: number; // 0 - 100
  locCount?: number;
  fileCount?: number;
}

export interface Citation {
  file: string;
  lineStart?: number;
  lineEnd?: number;
  quote?: string;
}

export interface GhostMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  timestamp: string;
}

export interface PatchFile {
  path: string;
  originalContent: string;
  patchedContent: string;
  diff: string;
}

export interface PatchProposal {
  id: string;
  repositoryId: string;
  title: string;
  summary: string;
  status: 'PROPOSED' | 'APPLIED_TO_SANDBOX' | 'TESTS_PASSED' | 'VERIFIED' | 'REJECTED';
  files: PatchFile[];
  verificationCommand: string;
  createdAt: string;
}

export interface VerificationRun {
  id: string;
  patchId: string;
  repositoryId: string;
  status: 'passed' | 'failed' | 'timeout';
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timestamp: string;
  beforeOutcome: {
    exitCode: number;
    summary: string;
    logs: string;
  };
  afterOutcome: {
    exitCode: number;
    summary: string;
    logs: string;
  };
}

export interface ResurrectionReport {
  id: string;
  repositoryId: string;
  modelName: string;
  createdAt: string;
  summary: string;
  architecture: ArchitectureSummary;
  findings: AutopsyFinding[];
  patch: PatchProposal | null;
  verification: VerificationRun | null;
  offlineVerified: boolean;
}

export interface AppSettings {
  ollamaEndpoint: string;
  modelName: string;
  temperature: number;
  enableFallback: boolean;
  autoVerify: boolean;
  sandboxTimeoutSeconds: number;
}
