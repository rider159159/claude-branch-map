import type { ToolBlock } from '@shared/types';

type ToolUse = Extract<ToolBlock, { kind: 'tool_use' }>;
type ToolResult = Extract<ToolBlock, { kind: 'tool_result' }>;

interface Props {
  use?: ToolUse;
  result?: ToolResult;
}

function preview(input: unknown, max = 80): string {
  if (input == null) return '';
  let s: string;
  try {
    s = typeof input === 'string' ? input : JSON.stringify(input);
  } catch {
    s = String(input);
  }
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function formatPayload(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function ToolCallBlock({ use, result }: Props) {
  const name = use?.name ?? 'tool_result';
  const isError = result?.isError ?? false;
  const summary = use ? preview(use.input) : preview(result?.content);

  return (
    <details className={`tool-call${isError ? ' tool-error' : ''}`}>
      <summary>
        <span className="tool-name">{name}</span>
        {summary && <span className="tool-preview">{summary}</span>}
        {isError && <span className="tool-error-flag">error</span>}
      </summary>
      <div className="tool-body">
        {use && (
          <div className="tool-section">
            <div className="tool-section-label">input</div>
            <pre className="tool-payload">
              <code>{formatPayload(use.input)}</code>
            </pre>
          </div>
        )}
        {result && (
          <div className="tool-section">
            <div className="tool-section-label">{isError ? 'error' : 'result'}</div>
            <pre className="tool-payload">
              <code>{formatPayload(result.content)}</code>
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}
