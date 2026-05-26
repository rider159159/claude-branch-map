import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, MappedSession } from '@shared/types';

const api = {
  listSessions: (): Promise<MappedSession[]> => ipcRenderer.invoke('sessions:list'),
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
