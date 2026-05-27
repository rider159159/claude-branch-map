import type { KeyboardEvent } from 'react';
import type { SessionSummary } from '@shared/types';
import { absoluteTime, relativeTime, shortenPath } from '../format';
import { BranchBadge } from './BranchBadge';
import type { RowState } from './SessionList';

interface Props {
  session: SessionSummary;
  state: RowState;
  selected: boolean;
  onSelect: (sessionId: string) => void;
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(n / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
}

function formatCost(c: number): string {
  if (c <= 0) return '';
  if (c < 0.01) return '<$0.01';
  if (c < 1) return `$${c.toFixed(2)}`;
  return `$${c.toFixed(2)}`;
}

export function SessionRow({ session, state, selected, onSelect }: Props) {
  const totalTokens = session.totalInputTokens + session.totalOutputTokens;
  const cost = formatCost(session.totalCostUSD);

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(session.sessionId);
    }
  };

  return (
    <article
      className={`session-row${selected ? ' selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(session.sessionId)}
      onKeyDown={handleKeyDown}
    >
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
          {session.model && (
            <>
              <span className="meta-divider">·</span>
              <span className="meta-item meta-model" title={session.model}>
                {session.model}
              </span>
            </>
          )}
          {totalTokens > 0 && (
            <>
              <span className="meta-divider">·</span>
              <span
                className="meta-item"
                title={`input ${session.totalInputTokens} · output ${session.totalOutputTokens}`}
              >
                {formatTokens(totalTokens)} tok
              </span>
            </>
          )}
          {cost && (
            <>
              <span className="meta-divider">·</span>
              <span className="meta-item" title="Total cost (sum of costUSD)">
                {cost}
              </span>
            </>
          )}
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
      <code className="session-id" title={session.sessionId}>
        {session.sessionId.slice(0, 8)}
      </code>
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
