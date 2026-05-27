import type { MessageEvent, ToolBlock } from '@shared/types';
import { absoluteTime, relativeTime } from '../format';
import { MessageMarkdown } from './MessageMarkdown';
import { ToolCallBlock } from './ToolCallBlock';

interface Props {
  msg: MessageEvent;
  resultMap: Map<string, Extract<ToolBlock, { kind: 'tool_result' }>>;
  consumedResultIds: Set<string>;
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(n / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
}

export function MessageItem({ msg, resultMap, consumedResultIds }: Props) {
  const roleClass = msg.role === 'user' ? 'user' : 'assistant';
  const sideClass = msg.isSidechain ? ' sidechain' : '';
  const totalTokens = (msg.usage?.inputTokens ?? 0) + (msg.usage?.outputTokens ?? 0);

  return (
    <article className={`message-row ${roleClass}${sideClass}`}>
      <header className="message-header">
        <span className={`role-pill role-${roleClass}`}>{msg.role}</span>
        {msg.isSidechain && <span className="role-pill role-side">sub-agent</span>}
        {msg.model && <span className="message-model">{msg.model}</span>}
        {totalTokens > 0 && (
          <span className="message-tokens" title={`in ${msg.usage?.inputTokens} · out ${msg.usage?.outputTokens}`}>
            {formatTokens(totalTokens)} tok
          </span>
        )}
        {msg.ts !== null && (
          <span className="message-time" title={absoluteTime(msg.ts)}>
            {relativeTime(msg.ts)}
          </span>
        )}
      </header>
      <div className="message-body">
        {msg.blocks.map((b, i) => {
          if (b.kind === 'text') {
            return <MessageMarkdown key={i} text={b.text} />;
          }
          if (b.kind === 'thinking') {
            return (
              <details key={i} className="thinking-block">
                <summary>thinking</summary>
                <div className="thinking-body">
                  <MessageMarkdown text={b.text} />
                </div>
              </details>
            );
          }
          if (b.kind === 'tool_use') {
            const paired = resultMap.get(b.id);
            if (paired) consumedResultIds.add(b.id);
            return <ToolCallBlock key={i} use={b} result={paired} />;
          }
          if (b.kind === 'tool_result') {
            if (b.toolUseId && consumedResultIds.has(b.toolUseId)) return null;
            return <ToolCallBlock key={i} result={b} />;
          }
          return null;
        })}
      </div>
    </article>
  );
}
