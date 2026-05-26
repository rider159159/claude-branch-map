import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { isGitRepo, listBranches } from '@shared/git';
import { groupBySession, readHookRecords } from '@shared/hook';
import { matchByHook, matchByTimestamp } from '@shared/matcher';
import { getProjectsDir } from '@shared/paths';
import { scanProjects } from '@shared/projects';
import { scanSessionsInProject } from '@shared/sessions';
import type {
  AppSettings,
  BranchInfo,
  ProjectInfo,
  SessionBranchResult,
  SessionSummary,
} from '@shared/types';
import { getSettings, updateSettings } from './settings';
import { copyResumeCommand } from './resume';

interface RepoEntry {
  branches: BranchInfo[];
  error?: string;
}

interface Cache {
  projects: ProjectInfo[] | null;
  hookMap: Map<string, string[]>;
  sessionsByProject: Map<string, SessionSummary[]>;
  sessionsById: Map<string, { session: SessionSummary; project: ProjectInfo }>;
}

let cache: Cache = {
  projects: null,
  hookMap: new Map(),
  sessionsByProject: new Map(),
  sessionsById: new Map(),
};
const repoCache = new Map<string, RepoEntry>();
const inflightRepos = new Map<string, Promise<RepoEntry>>();
const inflightProjectSessions = new Map<string, Promise<SessionSummary[]>>();

function resetAllCaches(): void {
  cache = {
    projects: null,
    hookMap: new Map(),
    sessionsByProject: new Map(),
    sessionsById: new Map(),
  };
  repoCache.clear();
  inflightRepos.clear();
  inflightProjectSessions.clear();
}

function resetBranchCaches(): void {
  repoCache.clear();
  inflightRepos.clear();
}

function normalizePath(s: string): string {
  return s.replace(/\\/g, '/');
}

function projectIsHidden(project: ProjectInfo, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  const cwd = normalizePath(project.actualPath);
  return patterns.some((p) => cwd.includes(p));
}

async function loadProjects(force = false): Promise<ProjectInfo[]> {
  if (cache.projects && !force) return cache.projects;
  const [projects, hookRecords] = await Promise.all([scanProjects(), readHookRecords()]);
  cache.projects = projects;
  cache.hookMap = groupBySession(hookRecords);
  return projects;
}

async function loadProjectSessions(project: ProjectInfo): Promise<SessionSummary[]> {
  const key = project.encodedDirName;
  const cached = cache.sessionsByProject.get(key);
  if (cached) return cached;
  const inflight = inflightProjectSessions.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const dirPath = join(getProjectsDir(), project.encodedDirName);
    const sessions = await scanSessionsInProject(dirPath, project.actualPath);
    cache.sessionsByProject.set(key, sessions);
    for (const s of sessions) cache.sessionsById.set(s.sessionId, { session: s, project });
    inflightProjectSessions.delete(key);
    return sessions;
  })();

  inflightProjectSessions.set(key, promise);
  return promise;
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
    'projects:list',
    async (_e, opts?: { refresh?: boolean }): Promise<ProjectInfo[]> => {
      if (opts?.refresh) resetAllCaches();
      const projects = await loadProjects(opts?.refresh);
      const { excludeCwdPatterns } = getSettings();
      const patterns = excludeCwdPatterns.map(normalizePath);
      return projects.filter((p) => !projectIsHidden(p, patterns));
    },
  );

  ipcMain.handle(
    'sessions:forProject',
    async (_e, encodedDirName: string): Promise<SessionSummary[]> => {
      const projects = await loadProjects();
      const project = projects.find((p) => p.encodedDirName === encodedDirName);
      if (!project) return [];
      return loadProjectSessions(project);
    },
  );

  ipcMain.handle(
    'branches:forSession',
    async (_e, sessionId: string): Promise<SessionBranchResult> => {
      const entry = cache.sessionsById.get(sessionId);
      if (!entry) return { branches: [], repoPath: null };

      const settings = getSettings();
      const repoPath =
        settings.repoPathOverride ?? entry.session.cwd ?? entry.project.actualPath;
      if (!repoPath) return { branches: [], repoPath: null };

      const repo = await getRepoEntry(repoPath);
      const hookBranches = cache.hookMap.get(sessionId);
      const branches =
        hookBranches && hookBranches.length > 0
          ? matchByHook(hookBranches, repo.branches)
          : matchByTimestamp(entry.session, repo.branches, settings.branchIconMode);

      return { branches, repoPath, repoError: repo.error };
    },
  );

  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) => {
    const next = updateSettings(patch);
    // Settings changes affect branches (mode A/B, repo override) and the
    // visible project list (cwd excludes). Drop the branch cache; the
    // project list is filtered fresh on the next projects:list call.
    resetBranchCaches();
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
