import type { SessionSummary } from '@shared/types';
import { absoluteTime, relativeTime, shortenPath } from '../format';
import { BranchBadge } from './BranchBadge';
import type { RowState } from './SessionList';

interface Props {
  session: SessionSummary;
  state: RowState;
  onCopy: (sessionId: string) => void;
}

export function SessionRow({ session, state, onCopy }: Props) {
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
          <BranchArea state={state} />
        </div>
        {state.status === 'loaded' && state.result.repoPath && (
          <div className="session-repo" title={state.result.repoPath}>
            repo: {shortenPath(state.result.repoPath)}
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

function BranchArea({ state }: { state: RowState }) {
  if (state.status === 'loading') {
    return (
      <>
        <span className="branch-skeleton" />
        <span className="branch-skeleton branch-skeleton-narrow" />
      </>
    );
  }
  if (state.status === 'error') {
    return <span className="branches-empty">branch lookup failed: {state.error}</span>;
  }
  const { branches, repoError } = state.result;
  if (branches.length === 0) {
    return (
      <span className="branches-empty">
        {repoError ? `no branches (${repoError})` : 'no matching branch'}
      </span>
    );
  }
  return (
    <>
      {branches.map((b, i) => (
        <BranchBadge key={`${b.branch.name}-${i}`} mapped={b} />
      ))}
    </>
  );
}
