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
  model: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
}

export type ToolBlock =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool_use'; id: string; name: string; input: unknown }
  | { kind: 'tool_result'; toolUseId: string; content: unknown; isError: boolean };

export interface MessageEvent {
  uuid: string;
  parentUuid: string | null;
  ts: number | null;
  role: 'user' | 'assistant';
  isSidechain: boolean;
  blocks: ToolBlock[];
  model: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  } | null;
  costUSD: number | null;
  durationMs: number | null;
}

export interface ProjectInfo {
  encodedDirName: string;   // raw folder name under ~/.claude/projects/
  actualPath: string;       // decoded real cwd
  displayName: string;      // last segment for the sidebar label
  sessionCount: number;
  lastModified: number;     // ms epoch — newest jsonl mtime
  hidden: boolean;          // user toggled hide on this project (persists)
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
  hiddenProjects: string[];   // encodedDirName values that the user manually hid
}

export const DEFAULT_EXCLUDE_CWD_PATTERNS = [
  '.claude-mem/observer-sessions',
];

export const DEFAULT_SETTINGS: AppSettings = {
  repoPathOverride: null,
  branchIconMode: 'created',
  excludeCwdPatterns: DEFAULT_EXCLUDE_CWD_PATTERNS,
  hiddenProjects: [],
};
