import { listBranches, isGitRepo } from './git';
import { groupBySession, readHookRecords } from './hook';
import { scanSessions } from './sessions';
import type {
  AppSettings,
  BranchInfo,
  MappedBranch,
  MappedSession,
  SessionSummary,
} from './types';

const NEAR_WINDOW_MS = 60 * 60 * 1000; // 1 hour tolerance for "high" confidence on timestamp matches

function inRange(ts: number, lo: number, hi: number): boolean {
  return ts >= lo && ts <= hi;
}

function matchByTimestamp(
  session: SessionSummary,
  branches: BranchInfo[],
  mode: AppSettings['branchIconMode'],
): MappedBranch[] {
  const hits: MappedBranch[] = [];
  for (const b of branches) {
    if (b.firstCommitTs <= 0) continue;
    const createdInRange = inRange(b.firstCommitTs, session.firstTs, session.lastTs);
    if (!createdInRange) continue;
    if (mode === 'created-with-commits' && b.commitCount === 0) continue;

    const distance = Math.min(
      Math.abs(b.firstCommitTs - session.firstTs),
      Math.abs(b.firstCommitTs - session.lastTs),
    );
    const high = distance <= NEAR_WINDOW_MS;
    hits.push({
      branch: b,
      confidence: high ? 'high' : 'low',
      source: 'timestamp',
    });
  }
  // Multiple low-confidence matches stay 'low'. If multiple were high, drop the weakest to 'low' to flag ambiguity.
  if (hits.filter((h) => h.confidence === 'high').length > 1) {
    return hits.map((h) => ({ ...h, confidence: 'low' as const }));
  }
  return hits;
}

function matchByHook(
  branchNames: string[],
  branches: BranchInfo[],
): MappedBranch[] {
  const byName = new Map(branches.map((b) => [b.name, b]));
  const out: MappedBranch[] = [];
  for (const name of branchNames) {
    const b = byName.get(name);
    if (b) {
      out.push({ branch: b, confidence: 'high', source: 'hook' });
    } else {
      // Hook recorded a branch that no longer exists locally — surface it with a synthetic entry.
      out.push({
        branch: {
          name,
          firstCommitTs: 0,
          lastCommitTs: 0,
          commitCount: 0,
          isCurrent: false,
        },
        confidence: 'high',
        source: 'hook',
      });
    }
  }
  return out;
}

export interface BuildMappingOptions {
  settings: AppSettings;
}

export async function buildMappedSessions(
  options: BuildMappingOptions,
): Promise<MappedSession[]> {
  const { settings } = options;
  const sessions = await scanSessions();
  const hookRecords = await readHookRecords();
  const hookMap = groupBySession(hookRecords);

  const repoCache = new Map<string, { branches: BranchInfo[]; error?: string }>();
  async function getRepo(path: string) {
    if (repoCache.has(path)) return repoCache.get(path)!;
    let entry: { branches: BranchInfo[]; error?: string };
    if (!(await isGitRepo(path))) {
      entry = { branches: [], error: 'not a git repo' };
    } else {
      try {
        entry = { branches: await listBranches(path) };
      } catch (err) {
        entry = { branches: [], error: (err as Error).message };
      }
    }
    repoCache.set(path, entry);
    return entry;
  }

  const result: MappedSession[] = [];
  for (const session of sessions) {
    const repoPath = settings.repoPathOverride ?? session.cwd;
    let branches: MappedBranch[] = [];
    let repoError: string | undefined;

    if (repoPath) {
      const repo = await getRepo(repoPath);
      repoError = repo.error;
      const hookBranches = hookMap.get(session.sessionId);
      if (hookBranches && hookBranches.length > 0) {
        branches = matchByHook(hookBranches, repo.branches);
      } else {
        branches = matchByTimestamp(session, repo.branches, settings.branchIconMode);
      }
    }

    result.push({
      session,
      branches,
      repoPath,
      repoError,
    });
  }
  return result;
}
