import type { AppSettings, MappedSession } from '@shared/types';

export interface RendererApi {
  listSessions: () => Promise<MappedSession[]>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  copyResume: (sessionId: string) => Promise<string>;
  pickRepo: () => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    api: RendererApi;
  }
}

export const api: RendererApi = window.api;
