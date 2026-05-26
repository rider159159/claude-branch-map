import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  ProjectInfo,
  SessionBranchResult,
  SessionSummary,
} from '@shared/types';

const api = {
  listProjects: (opts?: { refresh?: boolean }): Promise<ProjectInfo[]> =>
    ipcRenderer.invoke('projects:list', opts),
  sessionsForProject: (encodedDirName: string): Promise<SessionSummary[]> =>
    ipcRenderer.invoke('sessions:forProject', encodedDirName),
  branchesForSession: (sessionId: string): Promise<SessionBranchResult> =>
    ipcRenderer.invoke('branches:forSession', sessionId),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', patch),
  copyResume: (sessionId: string): Promise<string> =>
    ipcRenderer.invoke('resume:copy', sessionId),
  pickRepo: (): Promise<string | null> => ipcRenderer.invoke('repo:pick'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
