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
  onOpenInVscode: (sessionId: string) => void;
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; events: MessageEvent[] }
  | { status: 'error'; error: string };

export function MessageView({ session, branchState, onCopy, onOpenInVscode }: Props) {
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
    const base = showSidechain
      ? state.events
      : state.events.filter((e) => !e.isSidechain);

    // 過濾掉「實際渲染後會是空白」的訊息:
    // - 沒有任何 text(含 thinking)且沒有 tool_use 的訊息
    // - 唯一內容是 tool_result,且該 toolUseId 會被前面的 tool_use 吃掉(MessageItem 會回 null)
    const consumed = new Set<string>();
    for (const ev of base) {
      for (const b of ev.blocks) {
        if (b.kind === 'tool_use') consumed.add(b.id);
      }
    }

    return base.filter((ev) => {
      return ev.blocks.some((b) => {
        if (b.kind === 'text') return b.text.trim().length > 0;
        if (b.kind === 'thinking') return b.text.trim().length > 0;
        if (b.kind === 'tool_use') return true;
        if (b.kind === 'tool_result') {
          // 若有 toolUseId 且已被 assistant tool_use 配對,渲染時會被消化 → 視為不可見
          return !(b.toolUseId && consumed.has(b.toolUseId));
        }
        return false;
      });
    });
  }, [state, showSidechain]);

  const hasSidechain = useMemo(() => {
    if (state.status !== 'loaded') return false;
    return state.events.some((e) => e.isSidechain);
  }, [state]);

  if (!session) {
    return (
      <section className="message-pane">
        <div className="empty">請從左側選擇對話。</div>
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
                title="切換子代理(sub-agent / sidechain)訊息顯示"
              >
                {showSidechain ? '隱藏子代理(sub-agent)' : '顯示子代理(sub-agent)'}
              </button>
            )}
            <button
              className="ghost"
              onClick={() => onOpenInVscode(session.sessionId)}
              title="在 VS Code 的 Claude Code 擴充套件(extension)中繼續此對話。需先安裝該擴充套件,會自動開啟此對話的工作資料夾。"
            >
              在 VS Code 繼續對話
            </button>
            <button className="primary" onClick={() => onCopy(session.sessionId)}>
              複製 resume 指令
            </button>
          </div>
        </div>
        <div className="message-pane-meta">
          <span title={session.cwd}>{shortenPath(session.cwd)}</span>
          <span className="meta-divider">·</span>
          <span title={absoluteTime(session.lastTs)}>{relativeTime(session.lastTs)}</span>
          <span className="meta-divider">·</span>
          <span>{session.messageCount} 則訊息</span>
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
          <div className="error">訊息載入失敗:{state.error}</div>
        )}
        {state.status === 'loaded' && visibleEvents.length === 0 && (
          <div className="empty">此對話沒有可顯示的訊息。</div>
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
