import type { MappedSession } from '@shared/types';
import { absoluteTime, relativeTime, shortenPath } from '../format';
import { BranchBadge } from './BranchBadge';

interface Props {
  mapped: MappedSession;
  onCopy: (sessionId: string) => void;
}

export function SessionRow({ mapped, onCopy }: Props) {
  const { session, branches, repoPath, repoError } = mapped;

  return (
    <article className="session-row">
      <div className="session-main">
        <h3 className="session-title" title={session.title}>
          {session.title}
        </h3>
        <div className="session-meta">
          <span className="meta-item" title={session.cwd}>
            {shortenPath(session.cwd)}
          </span>
          <span className="meta-divider">·</span>
          <span className="meta-item" title={absoluteTime(session.lastTs)}>
            {relativeTime(session.lastTs)}
          </span>
          <span className="meta-divider">·</span>
          <span className="meta-item">{session.messageCount} msgs</span>
        </div>
        <div className="session-branches">
          {branches.length === 0 && (
            <span className="branches-empty">
              {repoError ? `no branches (${repoError})` : 'no matching branch'}
            </span>
          )}
          {branches.map((b, i) => (
            <BranchBadge key={`${b.branch.name}-${i}`} mapped={b} />
          ))}
        </div>
        {repoPath && (
          <div className="session-repo" title={repoPath}>
            repo: {shortenPath(repoPath)}
          </div>
        )}
      </div>
      <div className="session-actions">
        <button className="primary" onClick={() => onCopy(session.sessionId)}>
          Copy resume
        </button>
        <code className="session-id" title={session.sessionId}>
          {session.sessionId.slice(0, 8)}
        </code>
      </div>
    </article>
  );
}
