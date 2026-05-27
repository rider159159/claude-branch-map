import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MessageEvent, SessionSummary, ToolBlock } from '@shared/types';
import { api } from '../api';
import { absoluteTime, relativeTime, shortenPath } from '../format';
import { BranchBadge } from './BranchBadge';
import { MessageItem } from './MessageItem';
import type { RowState } from './SessionList';

interface Props {
  session: SessionSummary | null;
  branchState: RowState | undefined;
  onCopy: (sessionId: string) => void;
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; events: MessageEvent[] }
  | { status: 'error'; error: string };

export function MessageView({ session, branchState, onCopy }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const [showSidechain, setShowSidechain] = useState(false);
  const fetchToken = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setShowSidechain(false);
    if (!session) {
      setState({ status: 'idle' });
      return;
    }
    const token = ++fetchToken.current;
    setState({ status: 'loading' });
    api
      .messagesForSession(session.sessionId)
      .then((events) => {
        if (fetchToken.current !== token) return;
        setState({ status: 'loaded', events });
      })
      .catch((e: unknown) => {
        if (fetchToken.current !== token) return;
        setState({ status: 'error', error: (e as Error).message });
      });
  }, [session?.sessionId]);

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [session?.sessionId]);

  const resultMap = useMemo(() => {
    const map = new Map<string, Extract<ToolBlock, { kind: 'tool_result' }>>();
    if (state.status !== 'loaded') return map;
    for (const ev of state.events) {
      for (const b of ev.blocks) {
        if (b.kind === 'tool_result' && b.toolUseId) {
          if (!map.has(b.toolUseId)) map.set(b.toolUseId, b);
        }
      }
    }
    return map;
  }, [state]);

  const visibleEvents = useMemo(() => {
    if (state.status !== 'loaded') return [];
    return showSidechain ? state.events : state.events.filter((e) => !e.isSidechain);
  }, [state, showSidechain]);

  const hasSidechain = useMemo(() => {
    if (state.status !== 'loaded') return false;
    return state.events.some((e) => e.isSidechain);
  }, [state]);

  if (!session) {
    return (
      <section className="message-pane">
        <div className="empty">Select a session on the left.</div>
      </section>
    );
  }

  const branches = branchState?.status === 'loaded' ? branchState.result.branches : [];
  const consumedResultIds = new Set<string>();

  return (
    <section className="message-pane">
      <header className="message-pane-header">
        <div className="message-pane-title-row">
          <h2 className="message-pane-title" title={session.title}>
            {session.title}
          </h2>
          <div className="message-pane-actions">
            {hasSidechain && (
              <button
                className="ghost"
                onClick={() => setShowSidechain((v) => !v)}
                title="Toggle sub-agent (sidechain) messages"
              >
                {showSidechain ? 'Hide sub-agent' : 'Show sub-agent'}
              </button>
            )}
            <button className="primary" onClick={() => onCopy(session.sessionId)}>
              Copy resume
            </button>
          </div>
        </div>
        <div className="message-pane-meta">
          <span title={session.cwd}>{shortenPath(session.cwd)}</span>
          <span className="meta-divider">·</span>
          <span title={absoluteTime(session.lastTs)}>{relativeTime(session.lastTs)}</span>
          <span className="meta-divider">·</span>
          <span>{session.messageCount} msgs</span>
          <code className="session-id" title={session.sessionId}>
            {session.sessionId.slice(0, 8)}
          </code>
        </div>
        {branches.length > 0 && (
          <div className="message-pane-branches">
            {branches.map((b, i) => (
              <BranchBadge key={`${b.branch.name}-${i}`} mapped={b} />
            ))}
          </div>
        )}
      </header>

      <div className="message-list" ref={scrollRef}>
        {state.status === 'loading' && (
          <div className="message-skeleton-list">
            <div className="message-skeleton skeleton-shimmer" />
            <div className="message-skeleton skeleton-shimmer narrow" />
            <div className="message-skeleton skeleton-shimmer" />
            <div className="message-skeleton skeleton-shimmer narrow" />
          </div>
        )}
        {state.status === 'error' && (
          <div className="error">Failed to load messages: {state.error}</div>
        )}
        {state.status === 'loaded' && visibleEvents.length === 0 && (
          <div className="empty">No visible messages in this session.</div>
        )}
        {state.status === 'loaded' &&
          visibleEvents.map((msg) => (
            <MessageItem
              key={msg.uuid || `${msg.ts}-${msg.role}`}
              msg={msg}
              resultMap={resultMap}
              consumedResultIds={consumedResultIds}
            />
          ))}
      </div>
    </section>
  );
}
