import type {
  AppSettings,
  SessionBranchResult,
  SessionSummary,
} from '@shared/types';

export interface RendererApi {
  listSessions: (opts?: { refresh?: boolean }) => Promise<SessionSummary[]>;
  branchesForSession: (sessionId: string) => Promise<SessionBranchResult>;
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
