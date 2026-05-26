import { homedir } from 'node:os';
import { join } from 'node:path';

export function getClaudeHome(): string {
  return process.env.CLAUDE_HOME || join(homedir(), '.claude');
}

export function getProjectsDir(): string {
  return join(getClaudeHome(), 'projects');
}

export function getHookFilePath(): string {
  return join(getClaudeHome(), 'branch-hook.jsonl');
}

export function getHistoryFilePath(): string {
  return join(getClaudeHome(), 'history.jsonl');
}

export function shortenPath(p: string, segments = 3): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  if (parts.length <= segments) return p;
  return '.../' + parts.slice(-segments).join('/');
}
