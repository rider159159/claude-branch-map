import type { MappedSession } from '@shared/types';
import { SessionRow } from './SessionRow';

interface Props {
  sessions: MappedSession[];
  onCopy: (sessionId: string) => void;
}

export function SessionList({ sessions, onCopy }: Props) {
  return (
    <div className="session-list">
      {sessions.map((m) => (
        <SessionRow key={m.session.sessionId} mapped={m} onCopy={onCopy} />
      ))}
    </div>
  );
}
