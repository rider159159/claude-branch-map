import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AppSettings,
  ProjectInfo,
  SessionBranchResult,
  SessionSummary,
} from '@shared/types';
import { api } from './api';
import { MessageView } from './components/MessageView';
import { ProjectSidebar } from './components/ProjectSidebar';
import { SessionList, type RowState } from './components/SessionList';
import { SettingsPanel } from './components/SettingsPanel';
import { Toast } from './components/Toast';

const BRANCH_CONCURRENCY = 6;

export function App() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
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
      setSelectedSessionId(null);
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
        // if it still exists, else fall back to the most recent VISIBLE project
        // — we never auto-jump into something the user explicitly hid.
        const visible = list.filter((p) => !p.hidden);
        const candidates = [opts?.preferDir, selectedDir, visible[0]?.encodedDirName ?? null];
        const next = candidates.find(
          (c): c is string => !!c && visible.some((p) => p.encodedDirName === c),
        );
        if (next) {
          setSelectedDir(next);
          loadSessionsForProject(next);
        } else {
          setSelectedDir(null);
          setSessions([]);
          setBranchState(new Map());
          setSelectedSessionId(null);
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

  // Splits depend on `projects` (which carries the persisted `hidden` flag
  // from the main process) so a refresh restores the same partition.
  const visibleProjects = projects.filter((p) => !p.hidden);
  const hiddenProjectsList = projects.filter((p) => p.hidden);

  const updateHiddenSet = useCallback(
    async (nextHidden: string[]) => {
      const next = await api.setSettings({ hiddenProjects: nextHidden });
      setSettings(next);
      // Re-tag the in-memory project list so the UI flips immediately without
      // re-scanning ~/.claude/projects/ from disk.
      setProjects((prev) => {
        const set = new Set(next.hiddenProjects);
        return prev.map((p) =>
          p.hidden === set.has(p.encodedDirName) ? p : { ...p, hidden: set.has(p.encodedDirName) },
        );
      });
      return next;
    },
    [],
  );

  const onHideProject = useCallback(
    async (encodedDir: string) => {
      const current = new Set(settings?.hiddenProjects ?? []);
      if (current.has(encodedDir)) return;
      current.add(encodedDir);
      await updateHiddenSet(Array.from(current));

      // If we just hid the selected project, jump to the next still-visible
      // one so the right pane never sits on stale sessions.
      if (encodedDir === selectedDir) {
        const nextVisible = projects.find(
          (p) => p.encodedDirName !== encodedDir && !current.has(p.encodedDirName),
        );
        if (nextVisible) {
          setSelectedDir(nextVisible.encodedDirName);
          loadSessionsForProject(nextVisible.encodedDirName);
        } else {
          setSelectedDir(null);
          setSessions([]);
          setBranchState(new Map());
          setSelectedSessionId(null);
        }
      }
    },
    [settings, selectedDir, projects, updateHiddenSet, loadSessionsForProject],
  );

  const onShowProject = useCallback(
    async (encodedDir: string) => {
      const current = new Set(settings?.hiddenProjects ?? []);
      if (!current.has(encodedDir)) return;
      current.delete(encodedDir);
      await updateHiddenSet(Array.from(current));
    },
    [settings, updateHiddenSet],
  );

  const sortProjects = useCallback((list: ProjectInfo[]): ProjectInfo[] => {
    return [...list].sort((a, b) => {
      if (a.hidden !== b.hidden) return a.hidden ? 1 : -1;
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.lastModified - a.lastModified;
    });
  }, []);

  const onTogglePinProject = useCallback(
    async (encodedDir: string) => {
      const current = settings?.pinnedProjects ?? [];
      const isPinned = current.includes(encodedDir);
      const nextPinned = isPinned
        ? current.filter((p) => p !== encodedDir)
        : [...current, encodedDir];
      const next = await api.setSettings({ pinnedProjects: nextPinned });
      setSettings(next);
      setProjects((prev) => {
        const pinSet = new Set(next.pinnedProjects);
        return sortProjects(prev.map((p) => ({ ...p, pinned: pinSet.has(p.encodedDirName) })));
      });
    },
    [settings, sortProjects],
  );

  const sortSessions = useCallback((list: SessionSummary[]): SessionSummary[] => {
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.lastTs - a.lastTs;
    });
  }, []);

  const onTogglePinSession = useCallback(
    async (sessionId: string) => {
      const current = settings?.pinnedSessions ?? [];
      const isPinned = current.includes(sessionId);
      const nextPinned = isPinned
        ? current.filter((p) => p !== sessionId)
        : [...current, sessionId];
      const next = await api.setSettings({ pinnedSessions: nextPinned });
      setSettings(next);
      setSessions((prev) => {
        const pinSet = new Set(next.pinnedSessions);
        return sortSessions(prev.map((s) => ({ ...s, pinned: pinSet.has(s.sessionId) })));
      });
    },
    [settings, sortSessions],
  );

  const onHideSession = useCallback(
    async (sessionId: string) => {
      const current = settings?.hiddenSessions ?? [];
      if (current.includes(sessionId)) return;
      const next = await api.setSettings({ hiddenSessions: [...current, sessionId] });
      setSettings(next);
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === sessionId ? { ...s, hidden: true } : s)),
      );
      if (selectedSessionId === sessionId) setSelectedSessionId(null);
    },
    [settings, selectedSessionId],
  );

  const onShowSession = useCallback(
    async (sessionId: string) => {
      const current = settings?.hiddenSessions ?? [];
      if (!current.includes(sessionId)) return;
      const next = await api.setSettings({
        hiddenSessions: current.filter((s) => s !== sessionId),
      });
      setSettings(next);
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === sessionId ? { ...s, hidden: false } : s)),
      );
    },
    [settings],
  );

  const onSettingsChange = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = await api.setSettings(patch);
      setSettings(next);
      // pin/hide toggles are handled by their own helpers above; for everything
      // else we re-pull because the change may affect which projects pass the
      // cwd filter or which branches get returned.
      const skipReload =
        'hiddenProjects' in patch ||
        'pinnedProjects' in patch ||
        'pinnedSessions' in patch ||
        'hiddenSessions' in patch ||
        'sessionNotes' in patch ||
        'vscodeResumeUriTemplate' in patch ||
        'openWorkspaceBeforeResume' in patch ||
        'vscodeOpenDelayMs' in patch;
      if (!skipReload) {
        await loadProjects({ preferDir: selectedDir });
      }
    },
    [loadProjects, selectedDir],
  );

  const onSaveSessionNote = useCallback(
    async (
      sessionId: string,
      patch: { title?: string } | null,
    ) => {
      const next = await api.setSessionNote(sessionId, patch);
      setSettings(next);
      const note = next.sessionNotes[sessionId];
      setSessions((prev) =>
        prev.map((s) =>
          s.sessionId === sessionId
            ? { ...s, customTitle: note?.title ?? '' }
            : s,
        ),
      );
    },
    [],
  );

  const onCopy = useCallback(async (sessionId: string) => {
    const cmd = await api.copyResume(sessionId);
    setToast(`已複製:${cmd}`);
  }, []);

  const onOpenInVscode = useCallback(async (sessionId: string) => {
    const result = await api.openInVscode(sessionId);
    if (result.ok) {
      setToast('已在 VS Code 開啟對話,請稍候 VS Code 載入。');
    } else {
      const cmd = await api.copyResume(sessionId);
      setToast(`VS Code 開啟失敗,已改為複製 resume 指令:${cmd}`);
    }
  }, []);

  const selectedProject = visibleProjects.find((p) => p.encodedDirName === selectedDir) ?? null;
  const selectedSession =
    selectedSessionId ? sessions.find((s) => s.sessionId === selectedSessionId) ?? null : null;
  const selectedBranchState = selectedSessionId ? branchState.get(selectedSessionId) : undefined;

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
            {loadingProjects ? '載入中…' : '重新整理'}
          </button>
          <button className="ghost" onClick={() => setShowSettings((v) => !v)}>
            {showSettings ? '關閉設定' : '設定'}
          </button>
        </div>
      </header>

      {showSettings && settings && (
        <SettingsPanel
          settings={settings}
          hiddenProjects={hiddenProjectsList}
          onChange={onSettingsChange}
          onShowProject={onShowProject}
          onShowSession={onShowSession}
        />
      )}

      <div className="body">
        <ProjectSidebar
          projects={visibleProjects}
          selectedEncodedDir={selectedDir}
          onSelect={onSelectProject}
          onHide={onHideProject}
          onTogglePin={onTogglePinProject}
          loading={loadingProjects}
        />
        <aside className="session-pane">
          {error && <div className="error">載入失敗:{error}</div>}
          {selectedProject && (
            <header className="content-header">
              <h2 className="content-title">{selectedProject.displayName}</h2>
              <div className="content-subtitle" title={selectedProject.actualPath}>
                {selectedProject.actualPath}
              </div>
            </header>
          )}
          {!error && !sessionsLoading && selectedProject && sessions.length === 0 && (
            <div className="empty">此專案沒有對話。</div>
          )}
          {!error && !selectedProject && !loadingProjects && (
            <div className="empty">請從左側選擇專案。</div>
          )}
          <div className="session-pane-scroll">
            <SessionList
              sessions={sessions}
              branchState={branchState}
              selectedSessionId={selectedSessionId}
              onSelect={setSelectedSessionId}
              onTogglePinSession={onTogglePinSession}
              onHideSession={onHideSession}
              onSaveNote={onSaveSessionNote}
            />
          </div>
        </aside>
        <main className="content">
          <MessageView
            session={selectedSession}
            branchState={selectedBranchState}
            onCopy={onCopy}
            onOpenInVscode={onOpenInVscode}
          />
        </main>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
