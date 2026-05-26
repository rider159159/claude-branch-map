export type MatchConfidence = 'high' | 'low' | 'none';

export type MatchSource = 'timestamp' | 'hook';

export type BranchIconMode = 'created' | 'created-with-commits';

export interface SessionSummary {
  sessionId: string;
  cwd: string;
  title: string;
  firstTs: number;
  lastTs: number;
  messageCount: number;
  filePath: string;
}

export interface ProjectInfo {
  encodedDirName: string;   // raw folder name under ~/.claude/projects/
  actualPath: string;       // decoded real cwd
  displayName: string;      // last segment for the sidebar label
  sessionCount: number;
  lastModified: number;     // ms epoch — newest jsonl mtime
}

export interface BranchInfo {
  name: string;
  firstCommitTs: number;
  lastCommitTs: number;
  commitCount: number;
  isCurrent: boolean;
}

export interface MappedBranch {
  branch: BranchInfo;
  confidence: MatchConfidence;
  source: MatchSource;
}

export interface MappedSession {
  session: SessionSummary;
  branches: MappedBranch[];
  repoPath: string | null;
  repoError?: string;
}

export interface SessionBranchResult {
  branches: MappedBranch[];
  repoPath: string | null;
  repoError?: string;
}

export interface AppSettings {
  repoPathOverride: string | null;
  branchIconMode: BranchIconMode;
  excludeCwdPatterns: string[];
}

export const DEFAULT_EXCLUDE_CWD_PATTERNS = [
  '.claude-mem/observer-sessions',
];

export const DEFAULT_SETTINGS: AppSettings = {
  repoPathOverride: null,
  branchIconMode: 'created',
  excludeCwdPatterns: DEFAULT_EXCLUDE_CWD_PATTERNS,
};
