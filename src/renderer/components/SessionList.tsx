import type { SessionBranchResult, SessionSummary } from '@shared/types';
import { SessionRow } from './SessionRow';

export type RowState =
  | { status: 'loading' }
  | { status: 'loaded'; result: SessionBranchResult }
  | { status: 'error'; error: string };

interface Props {
  sessions: SessionSummary[];
  branchState: Map<string, RowState>;
  onCopy: (sessionId: string) => void;
}

export function SessionList({ sessions, branchState, onCopy }: Props) {
  return (
    <div className="session-list">
      {sessions.map((s) => (
        <SessionRow
          key={s.sessionId}
          session={s}
          state={branchState.get(s.sessionId) ?? { status: 'loading' }}
          onCopy={onCopy}
        />
      ))}
    </div>
  );
}
