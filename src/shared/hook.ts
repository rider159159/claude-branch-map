import { promises as fs } from 'node:fs';
import { getHookFilePath } from './paths';

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
