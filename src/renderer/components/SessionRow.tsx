import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { SessionSummary } from '@shared/types';
import { absoluteTime, relativeTime, shortenPath } from '../format';
import { BranchBadge } from './BranchBadge';
import { EditIcon, HideIcon, PinIcon } from './icons';
import type { RowState } from './SessionList';

interface Props {
  session: SessionSummary;
  state: RowState;
  selected: boolean;
  onSelect: (sessionId: string) => void;
  onTogglePin: (sessionId: string) => void;
  onHide: (sessionId: string) => void;
  onSaveNote: (
    sessionId: string,
    patch: { title?: string } | null,
  ) => Promise<void> | void;
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

export function SessionRow({
  session,
  state,
  selected,
  onSelect,
  onTogglePin,
  onHide,
  onSaveNote,
}: Props) {
  const totalTokens = session.totalInputTokens + session.totalOutputTokens;
  const cost = formatCost(session.totalCostUSD);
  const displayTitle = session.customTitle || session.title;

  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(session.customTitle);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setTitleDraft(session.customTitle);
    }
  }, [session.customTitle, editing]);

  useEffect(() => {
    if (editing) titleRef.current?.focus();
  }, [editing]);

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (editing) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(session.sessionId);
    }
  };
  const stop = (e: MouseEvent) => e.stopPropagation();

  const commit = async () => {
    const title = titleDraft.trim();
    if (title === session.customTitle) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSaveNote(session.sessionId, { title });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setTitleDraft(session.customTitle);
    setEditing(false);
  };

  const onEditorKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <article
      className={`session-row${selected ? ' selected' : ''}${session.pinned ? ' pinned' : ''}${editing ? ' editing' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!editing) onSelect(session.sessionId);
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="session-actions-mini">
        <button
          className={`session-icon-btn${editing ? ' active' : ''}`}
          onClick={(e) => {
            stop(e);
            setEditing((v) => !v);
          }}
          aria-label={editing ? '結束編輯自訂標題' : '編輯自訂標題'}
          title={editing ? '結束編輯' : '編輯自訂標題'}
        >
          <EditIcon />
        </button>
        <button
          className={`session-icon-btn${session.pinned ? ' active' : ''}`}
          onClick={(e) => {
            stop(e);
            onTogglePin(session.sessionId);
          }}
          aria-label={session.pinned ? '取消釘選對話' : '釘選對話'}
          title={session.pinned ? '取消釘選' : '釘選至頂端'}
        >
          <PinIcon filled={session.pinned} />
        </button>
        <button
          className="session-icon-btn"
          onClick={(e) => {
            stop(e);
            onHide(session.sessionId);
          }}
          aria-label="隱藏對話"
          title="隱藏(可至設定還原)"
        >
          <HideIcon />
        </button>
      </div>
      <div className="session-main">
        <h3 className="session-title" title={displayTitle}>
          {session.customTitle && <span className="session-title-mark" title="自訂標題">✎</span>}
          {displayTitle}
        </h3>
        {session.customTitle && (
          <div className="session-original-title" title={session.title}>
            原始:{session.title}
          </div>
        )}
        {editing && (
          <div className="session-note-editor" onClick={stop} onKeyDown={(e) => e.stopPropagation()}>
            <label className="note-field">
              <span className="note-field-label">自訂標題</span>
              <input
                ref={titleRef}
                type="text"
                className="note-input"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={onEditorKey}
                placeholder="留空則使用原始標題"
                maxLength={120}
                disabled={saving}
              />
            </label>
            <div className="note-actions">
              <button className="ghost" onClick={cancel} disabled={saving}>
                取消
              </button>
              <button className="primary" onClick={commit} disabled={saving}>
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        )}
        <div className="session-meta">
          <span className="meta-item" title={session.cwd}>
            {shortenPath(session.cwd)}
          </span>
          <span className="meta-divider">·</span>
          <span className="meta-item" title={absoluteTime(session.lastTs)}>
            {relativeTime(session.lastTs)}
          </span>
          <span className="meta-divider">·</span>
          <span className="meta-item">{session.messageCount} 則訊息</span>
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
                title={`輸入 ${session.totalInputTokens} · 輸出 ${session.totalOutputTokens}`}
              >
                {formatTokens(totalTokens)} tokens
              </span>
            </>
          )}
          {cost && (
            <>
              <span className="meta-divider">·</span>
              <span className="meta-item" title="總成本(costUSD 加總)">
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
            儲存庫(repo):{shortenPath(state.result.repoPath)}
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
    return <span className="branches-empty">分支查詢失敗:{state.error}</span>;
  }
  const { branches, repoError } = state.result;
  if (branches.length === 0) {
    return (
      <span className="branches-empty">
        {repoError ? `無分支(${repoError})` : '找不到對應分支'}
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
