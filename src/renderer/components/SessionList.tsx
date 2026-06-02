import { useMemo, useState } from 'react';
import type { SessionBranchResult, SessionSummary } from '@shared/types';
import { SessionRow } from './SessionRow';

export type RowState =
  | { status: 'loading' }
  | { status: 'loaded'; result: SessionBranchResult }
  | { status: 'error'; error: string };

interface Props {
  sessions: SessionSummary[];
  branchState: Map<string, RowState>;
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onTogglePinSession: (sessionId: string) => void;
  onHideSession: (sessionId: string) => void;
  onSaveNote: (
    sessionId: string,
    patch: { title?: string } | null,
  ) => Promise<void> | void;
}

function matchesQuery(session: SessionSummary, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const haystacks = [session.title, session.customTitle, session.cwd, session.sessionId];
  return haystacks.some((h) => h && h.toLowerCase().includes(needle));
}

export function SessionList({
  sessions,
  branchState,
  selectedSessionId,
  onSelect,
  onTogglePinSession,
  onHideSession,
  onSaveNote,
}: Props) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => sessions.filter((s) => !s.hidden), [sessions]);
  const filtered = useMemo(
    () => visible.filter((s) => matchesQuery(s, query.trim())),
    [visible, query],
  );

  return (
    <div className="session-list-wrap">
      <div className="session-search">
        <input
          type="text"
          className="session-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋對話:標題、自訂標題、cwd、sessionId"
          aria-label="搜尋對話"
          spellCheck={false}
        />
        {query && (
          <button className="session-search-clear" onClick={() => setQuery('')} title="清除搜尋">
            ×
          </button>
        )}
      </div>
      {query && visible.length > 0 && (
        <div className="session-search-stats">
          {filtered.length} / {visible.length} 則符合
        </div>
      )}
      <div className="session-list">
        {filtered.map((s) => (
          <SessionRow
            key={s.sessionId}
            session={s}
            state={branchState.get(s.sessionId) ?? { status: 'loading' }}
            selected={s.sessionId === selectedSessionId}
            onSelect={onSelect}
            onTogglePin={onTogglePinSession}
            onHide={onHideSession}
            onSaveNote={onSaveNote}
          />
        ))}
      </div>
    </div>
  );
}
