import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AppSettings,
  SessionBranchResult,
  SessionSummary,
} from '@shared/types';
import { api } from './api';
import { SessionList, type RowState } from './components/SessionList';
import { SettingsPanel } from './components/SettingsPanel';
import { Toast } from './components/Toast';

const BRANCH_CONCURRENCY = 6;

export function App() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [branchState, setBranchState] = useState<Map<string, RowState>>(new Map());
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const fetchToken = useRef(0);

  const fetchBranchesFor = useCallback(
    async (list: SessionSummary[], token: number) => {
      let cursor = 0;
      const workers = Array.from({ length: BRANCH_CONCURRENCY }, async () => {
        while (cursor < list.length) {
          if (fetchToken.current !== token) return;
          const idx = cursor++;
          const session = list[idx];
          try {
            const result: SessionBranchResult = await api.branchesForSession(session.sessionId);
            if (fetchToken.current !== token) return;
            setBranchState((prev) => {
              const next = new Map(prev);
              next.set(session.sessionId, { status: 'loaded', result });
              return next;
            });
          } catch (e) {
            if (fetchToken.current !== token) return;
            setBranchState((prev) => {
              const next = new Map(prev);
              next.set(session.sessionId, {
                status: 'error',
                error: (e as Error).message,
              });
              return next;
            });
          }
        }
      });
      await Promise.all(workers);
    },
    [],
  );

  const reload = useCallback(
    async (opts?: { refresh?: boolean }) => {
      const token = ++fetchToken.current;
      setLoadingSessions(true);
      setError(null);
      try {
        const [s, list] = await Promise.all([
          api.getSettings(),
          api.listSessions(opts),
        ]);
        if (fetchToken.current !== token) return;
        setSettings(s);
        setSessions(list);
        setBranchState(
          new Map(list.map((sess) => [sess.sessionId, { status: 'loading' }])),
        );
        setLoadingSessions(false);
        fetchBranchesFor(list, token);
      } catch (e) {
        if (fetchToken.current !== token) return;
        setError((e as Error).message);
        setLoadingSessions(false);
      }
    },
    [fetchBranchesFor],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const onSettingsChange = useCallback(
    async (patch: Partial<AppSettings>) => {
      const token = ++fetchToken.current;
      const next = await api.setSettings(patch);
      if (fetchToken.current !== token) return;
      setSettings(next);
      // settings affect branch results only; sessions list stays the same.
      setBranchState(
        new Map(sessions.map((sess) => [sess.sessionId, { status: 'loading' }])),
      );
      fetchBranchesFor(sessions, token);
    },
    [sessions, fetchBranchesFor],
  );

  const onCopy = useCallback(async (sessionId: string) => {
    const cmd = await api.copyResume(sessionId);
    setToast(`Copied: ${cmd}`);
  }, []);

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
            onClick={() => reload({ refresh: true })}
            disabled={loadingSessions}
          >
            {loadingSessions ? 'Loading…' : 'Refresh'}
          </button>
          <button className="ghost" onClick={() => setShowSettings((v) => !v)}>
            {showSettings ? 'Close settings' : 'Settings'}
          </button>
        </div>
      </header>

      {showSettings && settings && (
        <SettingsPanel settings={settings} onChange={onSettingsChange} />
      )}

      <main className="main">
        {error && <div className="error">Failed to load: {error}</div>}
        {!error && !loadingSessions && sessions.length === 0 && (
          <div className="empty">
            No Claude Code sessions found under <code>~/.claude/projects/</code>.
          </div>
        )}
        <SessionList sessions={sessions} branchState={branchState} onCopy={onCopy} />
      </main>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
