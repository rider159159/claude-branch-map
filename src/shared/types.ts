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
  pinned: boolean;
  hidden: boolean;
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
  pinned: boolean;          // user pinned this project to the top (persists)
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

export interface OpenInVscodeResult {
  ok: boolean;
  error?: string;
}

export interface AppSettings {
  repoPathOverride: string | null;
  branchIconMode: BranchIconMode;
  excludeCwdPatterns: string[];
  hiddenProjects: string[];   // encodedDirName values that the user manually hid
  pinnedProjects: string[];   // encodedDirName values, order = pin order
  pinnedSessions: string[];   // sessionId values, order = pin order
  hiddenSessions: string[];   // sessionId values
  vscodeResumeUriTemplate: string;     // {sessionId} 佔位,best-effort 的 VS Code deep link
  openWorkspaceBeforeResume: boolean;  // 觸發 URI 前先 `code <cwd>` 開啟工作資料夾
  vscodeOpenDelayMs: number;           // 開資料夾與觸發 URI 之間的延遲(ms)
}

export const DEFAULT_EXCLUDE_CWD_PATTERNS = [
  '.claude-mem/observer-sessions',
];

export const DEFAULT_SETTINGS: AppSettings = {
  repoPathOverride: null,
  branchIconMode: 'created',
  excludeCwdPatterns: DEFAULT_EXCLUDE_CWD_PATTERNS,
  hiddenProjects: [],
  pinnedProjects: [],
  pinnedSessions: [],
  hiddenSessions: [],
  vscodeResumeUriTemplate: 'vscode://anthropic.claude-code/open?session={sessionId}',
  openWorkspaceBeforeResume: true,
  vscodeOpenDelayMs: 1500,
};
