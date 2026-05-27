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
}

export function SessionList({
  sessions,
  branchState,
  selectedSessionId,
  onSelect,
  onTogglePinSession,
  onHideSession,
}: Props) {
  return (
    <div className="session-list">
      {sessions
        .filter((s) => !s.hidden)
        .map((s) => (
          <SessionRow
            key={s.sessionId}
            session={s}
            state={branchState.get(s.sessionId) ?? { status: 'loading' }}
            selected={s.sessionId === selectedSessionId}
            onSelect={onSelect}
            onTogglePin={onTogglePinSession}
            onHide={onHideSession}
          />
        ))}
    </div>
  );
}
