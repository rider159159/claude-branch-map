import { useCallback, useEffect, useState } from 'react';
import type { AppSettings, MappedSession } from '@shared/types';
import { api } from './api';
import { SessionList } from './components/SessionList';
import { SettingsPanel } from './components/SettingsPanel';
import { Toast } from './components/Toast';

export function App() {
  const [sessions, setSessions] = useState<MappedSession[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, list] = await Promise.all([api.getSettings(), api.listSessions()]);
      setSettings(s);
      setSessions(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const onSettingsChange = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = await api.setSettings(patch);
      setSettings(next);
      const list = await api.listSessions();
      setSessions(list);
    },
    [],
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
          <button className="ghost" onClick={reload} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
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
        {!error && !loading && sessions.length === 0 && (
          <div className="empty">
            No Claude Code sessions found under <code>~/.claude/projects/</code>.
          </div>
        )}
        <SessionList sessions={sessions} onCopy={onCopy} />
      </main>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
