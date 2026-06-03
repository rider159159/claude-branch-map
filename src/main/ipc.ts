import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { isGitRepo, listBranches } from '@shared/git';
import { groupBySession, readHookRecords } from '@shared/hook';
import { matchByHook, matchByTimestamp } from '@shared/matcher';
import { readSessionMessages } from '@shared/messages';
import { getProjectsDir } from '@shared/paths';
import { scanProjects } from '@shared/projects';
import { scanSessionsInProject } from '@shared/sessions';
import type {
  AppSettings,
  BranchInfo,
  MessageEvent,
  ProjectInfo,
  SessionBranchResult,
  SessionSummary,
} from '@shared/types';
import { getSettings, setSessionNote, updateSettings } from './settings';
import { copyResumeCommand, openInVscode } from './resume';

interface RepoEntry {
  branches: BranchInfo[];
  error?: string;
}

interface Cache {
  projects: ProjectInfo[] | null;
  hookMap: Map<string, string[]>;
  sessionsByProject: Map<string, SessionSummary[]>;
  sessionsById: Map<string, { session: SessionSummary; project: ProjectInfo }>;
  messagesBySession: Map<string, MessageEvent[]>;
}

let cache: Cache = {
  projects: null,
  hookMap: new Map(),
  sessionsByProject: new Map(),
  sessionsById: new Map(),
  messagesBySession: new Map(),
};
const repoCache = new Map<string, RepoEntry>();
const inflightRepos = new Map<string, Promise<RepoEntry>>();
const inflightProjectSessions = new Map<string, Promise<SessionSummary[]>>();
const inflightMessages = new Map<string, Promise<MessageEvent[]>>();

function resetAllCaches(): void {
  cache = {
    projects: null,
    hookMap: new Map(),
    sessionsByProject: new Map(),
    sessionsById: new Map(),
    messagesBySession: new Map(),
  };
  repoCache.clear();
  inflightRepos.clear();
  inflightProjectSessions.clear();
  inflightMessages.clear();
}

function resetBranchCaches(): void {
  repoCache.clear();
  inflightRepos.clear();
}

function normalizePath(s: string): string {
  return s.replace(/\\/g, '/');
}

function projectMatchesExcludePattern(project: ProjectInfo, patterns: string[]): boolean {
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
      const { excludeCwdPatterns, hiddenProjects, pinnedProjects } = getSettings();
      const patterns = excludeCwdPatterns.map(normalizePath);
      const hiddenSet = new Set(hiddenProjects);
      const pinnedSet = new Set(pinnedProjects);
      // Pin order: settings array order = oldest-first. We want newest-pinned
      // at the very top, so reverse before assigning a sort rank.
      const pinRank = new Map<string, number>();
      [...pinnedProjects].reverse().forEach((id, i) => pinRank.set(id, i));

      const decorated = projects
        .filter((p) => !projectMatchesExcludePattern(p, patterns))
        .map((p) => ({
          ...p,
          hidden: hiddenSet.has(p.encodedDirName),
          pinned: pinnedSet.has(p.encodedDirName),
        }));

      decorated.sort((a, b) => {
        if (a.pinned && b.pinned) {
          return (pinRank.get(a.encodedDirName) ?? 0) - (pinRank.get(b.encodedDirName) ?? 0);
        }
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.lastModified - a.lastModified;
      });
      return decorated;
    },
  );

  ipcMain.handle(
    'sessions:forProject',
    async (_e, encodedDirName: string): Promise<SessionSummary[]> => {
      const projects = await loadProjects();
      const project = projects.find((p) => p.encodedDirName === encodedDirName);
      if (!project) return [];
      const sessions = await loadProjectSessions(project);
      const { pinnedSessions, hiddenSessions, sessionNotes } = getSettings();
      const pinnedSet = new Set(pinnedSessions);
      const hiddenSet = new Set(hiddenSessions);
      const pinRank = new Map<string, number>();
      [...pinnedSessions].reverse().forEach((id, i) => pinRank.set(id, i));

      const decorated = sessions.map((s) => {
        const note = sessionNotes[s.sessionId];
        return {
          ...s,
          pinned: pinnedSet.has(s.sessionId),
          hidden: hiddenSet.has(s.sessionId),
          customTitle: note?.title ?? '',
        };
      });

      decorated.sort((a, b) => {
        if (a.pinned && b.pinned) {
          return (pinRank.get(a.sessionId) ?? 0) - (pinRank.get(b.sessionId) ?? 0);
        }
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.lastTs - a.lastTs;
      });
      // Cache the decorated sessions back so sessionsById lookups (used by
      // branches:forSession / messages:forSession) see consistent flags.
      cache.sessionsByProject.set(encodedDirName, decorated);
      for (const s of decorated) cache.sessionsById.set(s.sessionId, { session: s, project });
      return decorated;
    },
  );

  ipcMain.handle(
    'sessions:hidden',
    async (): Promise<SessionSummary[]> => {
      const { hiddenSessions, sessionNotes } = getSettings();
      if (hiddenSessions.length === 0) return [];
      const set = new Set(hiddenSessions);
      const out: SessionSummary[] = [];
      for (const list of cache.sessionsByProject.values()) {
        for (const s of list) {
          if (set.has(s.sessionId)) {
            const note = sessionNotes[s.sessionId];
            out.push({
              ...s,
              hidden: true,
              customTitle: note?.title ?? '',
            });
          }
        }
      }
      out.sort((a, b) => b.lastTs - a.lastTs);
      return out;
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

  ipcMain.handle(
    'messages:forSession',
    async (_e, sessionId: string): Promise<MessageEvent[]> => {
      const cached = cache.messagesBySession.get(sessionId);
      if (cached) return cached;
      const inflight = inflightMessages.get(sessionId);
      if (inflight) return inflight;

      const entry = cache.sessionsById.get(sessionId);
      if (!entry) return [];

      const promise = (async () => {
        const events = await readSessionMessages(entry.session.filePath);
        cache.messagesBySession.set(sessionId, events);
        inflightMessages.delete(sessionId);
        return events;
      })();
      inflightMessages.set(sessionId, promise);
      return promise;
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

  ipcMain.handle(
    'sessionNotes:set',
    (_e, sessionId: string, patch: { title?: string } | null) => {
      return setSessionNote(sessionId, patch);
    },
  );

  ipcMain.handle('resume:copy', (_e, sessionId: string) => {
    return copyResumeCommand(sessionId);
  });

  ipcMain.handle('resume:openInVscode', async (_e, sessionId: string) => {
    const entry = cache.sessionsById.get(sessionId);
    const settings = getSettings();
    // 與 branches:forSession 相同的 cwd 解析:repo override 優先,其次 session
    // 本身的 cwd,最後退回專案實際路徑。
    const cwd = entry
      ? settings.repoPathOverride ?? entry.session.cwd ?? entry.project.actualPath
      : null;
    return openInVscode({
      sessionId,
      cwd,
      uriTemplate: settings.vscodeResumeUriTemplate,
      openWorkspaceBeforeResume: settings.openWorkspaceBeforeResume,
    });
  });

  ipcMain.handle('repo:pick', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: '選擇 Git 儲存庫',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    return shell.openExternal(url);
  });
}
