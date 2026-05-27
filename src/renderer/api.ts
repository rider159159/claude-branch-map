import type {
  AppSettings,
  MessageEvent,
  ProjectInfo,
  SessionBranchResult,
  SessionSummary,
} from '@shared/types';

export interface RendererApi {
  listProjects: (opts?: { refresh?: boolean }) => Promise<ProjectInfo[]>;
  sessionsForProject: (encodedDirName: string) => Promise<SessionSummary[]>;
  branchesForSession: (sessionId: string) => Promise<SessionBranchResult>;
  messagesForSession: (sessionId: string) => Promise<MessageEvent[]>;
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
