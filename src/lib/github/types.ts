export type ActivityStatus = 'active' | 'cooling' | 'dormant' | 'deep_sleep' | 'archived';
export type TrackingMode = 'auto' | 'pinned' | 'ignored';

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
  /** automation (Dependabot, Renovate, *[bot]) — excluded from "human activity" */
  bot?: boolean;
}

export interface TrackedRepo {
  id: string;
  fullName: string;
  name: string;
  owner: string;
  description: string;
  htmlUrl: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  language: string | null;
  topics: string[];
  license: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  sizeKb: number;
  defaultBranch: string;
  createdAt: string;
  pushedAt: string | null;
  lastCommit: CommitInfo | null;
  recentCommits: CommitInfo[];
  /** pushedAt value for which commits were last fetched; drives incremental sync */
  commitsCheckedFor: string | null;
  /** date of the latest human (non-bot) default-branch commit; falls back to any commit, then pushed_at */
  lastActivityAt: string;
  /** every recently fetched commit is automation, so lastActivityAt may overstate human activity */
  botOnly: boolean;
  status: ActivityStatus;
  idleDays: number;
  resurrectionScore: number;
  scoreBreakdown: ScoreBreakdown | null;
  tracking: TrackingMode;
  missing: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ScoreBreakdown {
  value: number;
  feasibility: number;
  timing: number;
  forkPenalty: number;
  total: number;
  notes: string[];
}

export type EventType =
  | 'baseline'
  | 'repo_added'
  | 'repo_removed'
  | 'commits'
  | 'status_change'
  | 'archived'
  | 'unarchived'
  | 'stars';

export interface TrackerEvent {
  id: string;
  at: string;
  type: EventType;
  repoId: string | null;
  fullName: string | null;
  message: string;
  data?: Record<string, unknown>;
}

export interface Connection {
  login: string;
  name: string | null;
  avatarUrl: string;
  tokenEnc: string;
  tokenHint: string;
  scopes: string[];
  connectedAt: string;
  /** 'invalid' after GitHub answers 401; user must reconnect */
  status: 'ok' | 'invalid';
}

export interface SyncRun {
  id: string;
  trigger: 'manual' | 'scheduled' | 'connect' | 'webhook';
  state: 'running' | 'completed' | 'partial' | 'failed';
  startedAt: string;
  finishedAt?: string;
  phase: 'listing' | 'commits' | 'finalizing' | 'done';
  total: number;
  done: number;
  reposSeen: number;
  newCommits: number;
  eventsCreated: number;
  errors: string[];
  rateLimit?: { remaining: number; resetAt: string };
}

export interface TrackerSettings {
  intervalMinutes: number;
  /** idle-day cut points: <= active, <= cooling, <= dormant, beyond that is deep sleep */
  thresholds: { active: number; cooling: number; dormant: number };
}

export interface DeepScan {
  scannedAt: string;
  pulls: { number: number; title: string; author: string; updatedAt: string; draft: boolean; url: string }[];
  issues: { number: number; title: string; author: string; updatedAt: string; labels: string[]; url: string }[];
  releases: { tag: string; name: string; publishedAt: string | null; url: string }[];
  readme: { text: string; truncated: boolean } | null;
  errors: string[];
}

export interface AnalysisClaim {
  text: string;
  status: 'confirmed' | 'inferred' | 'unknown';
  evidenceIds: string[];
  quote: string;
  quoteVerified: boolean;
  note?: string;
}

export interface AnalysisStep {
  title: string;
  why: string;
  effort: 'S' | 'M' | 'L';
  evidenceIds: string[];
  kind: 'found' | 'suggested';
}

export interface EvidenceItem { id: string; kind: string; label: string; url?: string; text: string }

export interface AiAnalysis {
  status: 'running' | 'completed' | 'failed';
  evidenceHash: string;
  model: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  truncated?: boolean;
  evidence: EvidenceItem[];
  result?: {
    purpose: AnalysisClaim;
    whereItStopped: AnalysisClaim;
    unfinishedWork: AnalysisClaim[];
    revivalPlan: AnalysisStep[];
    verification: { claims: number; confirmed: number; downgraded: number; dropped: number };
  };
}

export interface TrackerDb {
  version: 1;
  connection: Connection | null;
  baselineDoneAt: string | null;
  repos: Record<string, TrackedRepo>;
  events: TrackerEvent[];
  lastSync: SyncRun | null;
  syncHistory: SyncRun[];
  /** ETags by request key, for conditional polling (a 304 does not consume rate limit) */
  etags: Record<string, string>;
  lastFullListAt: string | null;
  deep: Record<string, DeepScan>;
  analyses: Record<string, AiAnalysis>;
  /** recent webhook delivery GUIDs, newest last, for idempotency */
  deliveries: string[];
  settings: TrackerSettings;
}
