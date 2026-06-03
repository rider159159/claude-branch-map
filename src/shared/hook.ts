import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getClaudeHome, getHookFilePath } from './paths';

export interface HookRecord {
  sessionId: string;
  branch: string;
  ts: number;
  cwd?: string;
}

export async function readHookRecords(): Promise<HookRecord[]> {
  const path = getHookFilePath();
  let raw: string;
  try {
    raw = await fs.readFile(path, 'utf8');
  } catch {
    return [];
  }
  const records: HookRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (
        obj &&
        typeof obj.sessionId === 'string' &&
        typeof obj.branch === 'string' &&
        obj.branch.length > 0
      ) {
        const ts = typeof obj.ts === 'number' ? obj.ts : Date.parse(String(obj.ts));
        records.push({
          sessionId: obj.sessionId,
          branch: obj.branch,
          ts: Number.isFinite(ts) ? ts : 0,
          cwd: typeof obj.cwd === 'string' ? obj.cwd : undefined,
        });
      }
    } catch {
      // skip malformed lines
    }
  }
  return records;
}

export function groupBySession(records: HookRecord[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const r of records) {
    if (!map.has(r.sessionId)) map.set(r.sessionId, new Set());
    map.get(r.sessionId)!.add(r.branch);
  }
  const out = new Map<string, string[]>();
  for (const [k, v] of map) out.set(k, [...v]);
  return out;
}

export interface HookHealth {
  scriptInstalled: boolean;        // ~/.claude/hooks/branch-hook.{ps1,sh} 是否存在
  settingsRegistered: boolean;     // ~/.claude/settings.json PostToolUse 是否含 branch-hook 指令
  jsonlExists: boolean;            // ~/.claude/branch-hook.jsonl 是否存在
  jsonlRecordCount: number;        // jsonl 內可解析的有效紀錄數
  platform: 'win32' | 'darwin' | 'linux' | 'other';
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function isSettingsRegistered(): Promise<boolean> {
  const settingsPath = join(getClaudeHome(), 'settings.json');
  let raw: string;
  try {
    raw = await fs.readFile(settingsPath, 'utf8');
  } catch {
    return false;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== 'object') return false;
  const hooks = (parsed as Record<string, unknown>).hooks;
  if (!hooks || typeof hooks !== 'object') return false;
  const postToolUse = (hooks as Record<string, unknown>).PostToolUse;
  if (!Array.isArray(postToolUse)) return false;
  for (const entry of postToolUse) {
    if (!entry || typeof entry !== 'object') continue;
    const inner = (entry as Record<string, unknown>).hooks;
    if (!Array.isArray(inner)) continue;
    for (const h of inner) {
      if (!h || typeof h !== 'object') continue;
      const cmd = (h as Record<string, unknown>).command;
      if (typeof cmd === 'string' && cmd.includes('branch-hook')) return true;
    }
  }
  return false;
}

export async function getHookHealth(): Promise<HookHealth> {
  const home = getClaudeHome();
  const platform: HookHealth['platform'] =
    process.platform === 'win32' || process.platform === 'darwin' || process.platform === 'linux'
      ? process.platform
      : 'other';
  const scriptName = platform === 'win32' ? 'branch-hook.ps1' : 'branch-hook.sh';
  const scriptPath = join(home, 'hooks', scriptName);

  const [scriptInstalled, settingsRegistered, records] = await Promise.all([
    pathExists(scriptPath),
    isSettingsRegistered(),
    readHookRecords(),
  ]);
  const jsonlPath = getHookFilePath();
  const jsonlExists = await pathExists(jsonlPath);

  return {
    scriptInstalled,
    settingsRegistered,
    jsonlExists,
    jsonlRecordCount: records.length,
    platform,
  };
}
