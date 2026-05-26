import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { isGitRepo, listBranches } from '@shared/git';
import { groupBySession, readHookRecords } from '@shared/hook';
import { matchByHook, matchByTimestamp } from '@shared/matcher';
import { scanSessions } from '@shared/sessions';
import type {
  AppSettings,
  BranchInfo,
  SessionBranchResult,
  SessionSummary,
} from '@shared/types';
import { getSettings, updateSettings } from './settings';
import { copyResumeCommand } from './resume';

interface SessionCache {
  sessions: SessionSummary[];
  sessionsById: Map<string, SessionSummary>;
  hookMap: Map<string, string[]>;
}

interface RepoEntry {
  branches: BranchInfo[];
  error?: string;
}

let sessionCache: SessionCache | null = null;
const repoCache = new Map<string, RepoEntry>();
const inflightRepos = new Map<string, Promise<RepoEntry>>();

async function loadSessions(force = false): Promise<SessionCache> {
  if (sessionCache && !force) return sessionCache;
  const [sessions, hookRecords] = await Promise.all([scanSessions(), readHookRecords()]);
  sessionCache = {
    sessions,
    sessionsById: new Map(sessions.map((s) => [s.sessionId, s])),
    hookMap: groupBySession(hookRecords),
  };
  return sessionCache;
}

function invalidateRepoCache(): void {
  repoCache.clear();
  inflightRepos.clear();
}

async function getRepoEntry(repoPath: string): Promise<RepoEntry> {
  const cached = repoCache.get(repoPath);
  if (cached) return cached;
  const inflight = inflightRepos.get(repoPath);
  if (inflight) return inflight;

  const promise = (async (): Promise<RepoEntry> => {
    let entry: RepoEntry;
    try {
      if (!(await isGitRepo(repoPath))) {
        entry = { branches: [], error: 'not a git repo' };
      } else {
        entry = { branches: await listBranches(repoPath) };
      }
    } catch (err) {
      entry = { branches: [], error: (err as Error).message };
    }
    repoCache.set(repoPath, entry);
    inflightRepos.delete(repoPath);
    return entry;
  })();

  inflightRepos.set(repoPath, promise);
  return promise;
}

export function registerIpcHandlers(): void {
  ipcMain.handle(
    'sessions:list',
    async (_e, opts?: { refresh?: boolean }): Promise<SessionSummary[]> => {
      if (opts?.refresh) invalidateRepoCache();
      const cache = await loadSessions(opts?.refresh);
      const { excludeCwdPatterns } = getSettings();
      if (!excludeCwdPatterns.length) return cache.sessions;
      return cache.sessions.filter(
        (s) => !excludeCwdPatterns.some((p) => s.cwd.includes(p)),
      );
    },
  );

  ipcMain.handle(
    'branches:forSession',
    async (_e, sessionId: string): Promise<SessionBranchResult> => {
      const cache = await loadSessions();
      const session = cache.sessionsById.get(sessionId);
      if (!session) return { branches: [], repoPath: null };

      const settings = getSettings();
      const repoPath = settings.repoPathOverride ?? session.cwd ?? null;
      if (!repoPath) return { branches: [], repoPath: null };

      const repo = await getRepoEntry(repoPath);
      const hookBranches = cache.hookMap.get(sessionId);
      const branches =
        hookBranches && hookBranches.length > 0
          ? matchByHook(hookBranches, repo.branches)
          : matchByTimestamp(session, repo.branches, settings.branchIconMode);

      return { branches, repoPath, repoError: repo.error };
    },
  );

  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) => {
    const next = updateSettings(patch);
    // Branch results depend on settings (repo override + branch icon mode),
    // so drop the per-repo cache when settings change.
    invalidateRepoCache();
    return next;
  });

  ipcMain.handle('resume:copy', (_e, sessionId: string) => {
    return copyResumeCommand(sessionId);
  });

  ipcMain.handle('repo:pick', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Choose Git repository',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    return shell.openExternal(url);
  });
}
