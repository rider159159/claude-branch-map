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
}

export function SessionList({ sessions, branchState, selectedSessionId, onSelect }: Props) {
  return (
    <div className="session-list">
      {sessions.map((s) => (
        <SessionRow
          key={s.sessionId}
          session={s}
          state={branchState.get(s.sessionId) ?? { status: 'loading' }}
          selected={s.sessionId === selectedSessionId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
