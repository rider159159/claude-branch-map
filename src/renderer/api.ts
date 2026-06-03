import type { HookHealth } from '@shared/hook';
import type {
  AppSettings,
  MessageEvent,
  OpenInVscodeResult,
  ProjectInfo,
  SessionBranchResult,
  SessionSummary,
} from '@shared/types';

export interface RendererApi {
  listProjects: (opts?: { refresh?: boolean }) => Promise<ProjectInfo[]>;
  sessionsForProject: (encodedDirName: string) => Promise<SessionSummary[]>;
  branchesForSession: (sessionId: string) => Promise<SessionBranchResult>;
  messagesForSession: (sessionId: string) => Promise<MessageEvent[]>;
  hiddenSessions: () => Promise<SessionSummary[]>;
  setSessionNote: (
    sessionId: string,
    patch: { title?: string } | null,
  ) => Promise<AppSettings>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  copyResume: (sessionId: string) => Promise<string>;
  openInVscode: (sessionId: string) => Promise<OpenInVscodeResult>;
  pickRepo: () => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
  hookHealth: () => Promise<HookHealth>;
}

declare global {
  interface Window {
    api: RendererApi;
  }
}

export const api: RendererApi = window.api;
