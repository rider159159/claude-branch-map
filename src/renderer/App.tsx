import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AppSettings,
  ProjectInfo,
  SessionBranchResult,
  SessionSummary,
} from '@shared/types';
import { api } from './api';
import { ProjectSidebar } from './components/ProjectSidebar';
import { SessionList, type RowState } from './components/SessionList';
import { SettingsPanel } from './components/SettingsPanel';
import { Toast } from './components/Toast';

const BRANCH_CONCURRENCY = 6;

export function App() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [branchState, setBranchState] = useState<Map<string, RowState>>(new Map());
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const fetchToken = useRef(0);
  const sessionsToken = useRef(0);

  const fetchBranchesFor = useCallback(
    async (list: SessionSummary[], token: number) => {
      let cursor = 0;
      const workers = Array.from({ length: BRANCH_CONCURRENCY }, async () => {
        while (cursor < list.length) {
          if (sessionsToken.current !== token) return;
          const idx = cursor++;
          const session = list[idx];
          try {
            const result: SessionBranchResult = await api.branchesForSession(session.sessionId);
            if (sessionsToken.current !== token) return;
            setBranchState((prev) => {
              const next = new Map(prev);
              next.set(session.sessionId, { status: 'loaded', result });
              return next;
            });
          } catch (e) {
            if (sessionsToken.current !== token) return;
            setBranchState((prev) => {
              const next = new Map(prev);
              next.set(session.sessionId, { status: 'error', error: (e as Error).message });
              return next;
            });
          }
        }
      });
      await Promise.all(workers);
    },
    [],
  );

  const loadSessionsForProject = useCallback(
    async (encodedDir: string) => {
      const token = ++sessionsToken.current;
      setSessionsLoading(true);
      setSessions([]);
      setBranchState(new Map());
      try {
        const list = await api.sessionsForProject(encodedDir);
        if (sessionsToken.current !== token) return;
        setSessions(list);
        setBranchState(
          new Map(list.map((sess) => [sess.sessionId, { status: 'loading' as const }])),
        );
        setSessionsLoading(false);
        fetchBranchesFor(list, token);
      } catch (e) {
        if (sessionsToken.current !== token) return;
        setError((e as Error).message);
        setSessionsLoading(false);
      }
    },
    [fetchBranchesFor],
  );

  const loadProjects = useCallback(
    async (opts?: { refresh?: boolean; preferDir?: string | null }) => {
      const token = ++fetchToken.current;
      setLoadingProjects(true);
      setError(null);
      try {
        const [s, list] = await Promise.all([
          api.getSettings(),
          api.listProjects(opts),
        ]);
        if (fetchToken.current !== token) return;
        setSettings(s);
        setProjects(list);
        setLoadingProjects(false);

        // Pick selection: prefer the requested dir, then keep the current one
        // if it still exists, else fall back to the most recent project.
        const candidates = [opts?.preferDir, selectedDir, list[0]?.encodedDirName ?? null];
        const next = candidates.find(
          (c): c is string => !!c && list.some((p) => p.encodedDirName === c),
        );
        if (next) {
          setSelectedDir(next);
          loadSessionsForProject(next);
        } else {
          setSelectedDir(null);
          setSessions([]);
          setBranchState(new Map());
        }
      } catch (e) {
        if (fetchToken.current !== token) return;
        setError((e as Error).message);
        setLoadingProjects(false);
      }
    },
    // selectedDir is intentionally not in deps — we read its latest value at call time
    // but never want the closure to drive re-fetching by itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadSessionsForProject],
  );

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelectProject = useCallback(
    (encodedDir: string) => {
      if (encodedDir === selectedDir) return;
      setSelectedDir(encodedDir);
      loadSessionsForProject(encodedDir);
    },
    [selectedDir, loadSessionsForProject],
  );

  const onSettingsChange = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = await api.setSettings(patch);
      setSettings(next);
      // Re-pull project list (filter changes) and re-resolve branches for the
      // currently visible project (mode A/B or repo override changed).
      await loadProjects({ preferDir: selectedDir });
    },
    [loadProjects, selectedDir],
  );

  const onCopy = useCallback(async (sessionId: string) => {
    const cmd = await api.copyResume(sessionId);
    setToast(`Copied: ${cmd}`);
  }, []);

  const selectedProject = projects.find((p) => p.encodedDirName === selectedDir) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-title">
          <span className="logo-dot" />
          <h1>Claude Branch Map</h1>
        </div>
        <div className="topbar-actions">
          <button
            className="ghost"
            onClick={() => loadProjects({ refresh: true, preferDir: selectedDir })}
            disabled={loadingProjects}
          >
            {loadingProjects ? 'Loading…' : 'Refresh'}
          </button>
          <button className="ghost" onClick={() => setShowSettings((v) => !v)}>
            {showSettings ? 'Close settings' : 'Settings'}
          </button>
        </div>
      </header>

      {showSettings && settings && (
        <SettingsPanel settings={settings} onChange={onSettingsChange} />
      )}

      <div className="body">
        <ProjectSidebar
          projects={projects}
          selectedEncodedDir={selectedDir}
          onSelect={onSelectProject}
          loading={loadingProjects}
        />
        <main className="content">
          {error && <div className="error">Failed to load: {error}</div>}
          {selectedProject && (
            <header className="content-header">
              <h2 className="content-title">{selectedProject.displayName}</h2>
              <div className="content-subtitle" title={selectedProject.actualPath}>
                {selectedProject.actualPath}
              </div>
            </header>
          )}
          {!error && !sessionsLoading && selectedProject && sessions.length === 0 && (
            <div className="empty">No sessions in this project.</div>
          )}
          {!error && !selectedProject && !loadingProjects && (
            <div className="empty">Select a project on the left.</div>
          )}
          <SessionList sessions={sessions} branchState={branchState} onCopy={onCopy} />
        </main>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
