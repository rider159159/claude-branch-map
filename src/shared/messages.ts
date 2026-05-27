import { promises as fs } from 'node:fs';
import type { MessageEvent, ToolBlock } from './types';

type AnyRecord = Record<string, unknown>;

const HIDDEN_TYPES = new Set([
  'summary',
  'system',
  'file-history-snapshot',
  'progress',
  'queue-operation',
]);

export function isObject(v: unknown): v is AnyRecord {
  return typeof v === 'object' && v !== null;
}

export function parseTimestamp(raw: unknown): number | null {
  if (typeof raw === 'number') return raw < 1e12 ? raw * 1000 : raw;
  if (typeof raw === 'string') {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

// Drop events that should never reach the UI: meta entries, summary/system/etc.
// Sidechain events are NOT dropped here — they are kept so the renderer can
// toggle them on demand.
export function isVisibleEvent(ev: AnyRecord): boolean {
  if (ev.isMeta === true) return false;
  if (typeof ev.type === 'string' && HIDDEN_TYPES.has(ev.type)) return false;
  const role = pickRole(ev);
  if (role !== 'user' && role !== 'assistant') return false;
  const blocks = extractBlocks(ev);
  if (blocks.length === 0) return false;
  // An assistant turn that only contains tool_use/thinking with no visible text
  // is invisible from a "human reading the chat" perspective — we still surface
  // it in the message stream (so tool calls render) but exclude it from counts.
  return blocks.some((b) => b.kind === 'text' && b.text.trim().length > 0)
    || blocks.some((b) => b.kind === 'tool_use' || b.kind === 'tool_result' || b.kind === 'thinking');
}

// Stricter: only count entries that show real human-readable text, used for
// session messageCount.
export function isCountableEvent(ev: AnyRecord): boolean {
  if (!isVisibleEvent(ev)) return false;
  if (ev.isSidechain === true) return false;
  const blocks = extractBlocks(ev);
  return blocks.some((b) => b.kind === 'text' && b.text.trim().length > 0);
}

export function pickRole(ev: AnyRecord): 'user' | 'assistant' | null {
  const msg = isObject(ev.message) ? (ev.message as AnyRecord) : null;
  const r = (msg?.role ?? ev.role ?? ev.type) as unknown;
  if (r === 'user' || r === 'assistant') return r;
  return null;
}

export function extractBlocks(ev: AnyRecord): ToolBlock[] {
  const msg = isObject(ev.message) ? (ev.message as AnyRecord) : null;
  const content = msg?.content ?? ev.content;
  const blocks: ToolBlock[] = [];

  if (typeof content === 'string') {
    if (content.trim()) blocks.push({ kind: 'text', text: content });
    // user events may carry tool_result on the wrapper (toolUseResult)
    const tu = isObject(ev.toolUseResult) ? (ev.toolUseResult as AnyRecord) : null;
    if (tu) {
      blocks.push({
        kind: 'tool_result',
        toolUseId: typeof tu.tool_use_id === 'string' ? tu.tool_use_id : '',
        content: tu.content ?? tu,
        isError: tu.is_error === true,
      });
    }
    return blocks;
  }

  if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part === 'string') {
        if (part.trim()) blocks.push({ kind: 'text', text: part });
        continue;
      }
      if (!isObject(part)) continue;
      const t = part.type;
      if (t === 'text' && typeof part.text === 'string') {
        if (part.text.trim()) blocks.push({ kind: 'text', text: part.text });
      } else if (t === 'thinking' && typeof part.thinking === 'string') {
        if (part.thinking.trim()) blocks.push({ kind: 'thinking', text: part.thinking });
      } else if (t === 'tool_use') {
        blocks.push({
          kind: 'tool_use',
          id: typeof part.id === 'string' ? part.id : '',
          name: typeof part.name === 'string' ? part.name : '(tool)',
          input: part.input ?? null,
        });
      } else if (t === 'tool_result') {
        blocks.push({
          kind: 'tool_result',
          toolUseId: typeof part.tool_use_id === 'string' ? part.tool_use_id : '',
          content: part.content ?? '',
          isError: part.is_error === true,
        });
      }
    }
  }

  return blocks;
}

export function extractFirstText(blocks: ToolBlock[]): string | null {
  for (const b of blocks) {
    if (b.kind === 'text' && b.text.trim()) return b.text.trim();
  }
  return null;
}

interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export function coerceUsage(raw: unknown): Usage | null {
  if (!isObject(raw)) return null;
  const num = (k: string): number => {
    const v = raw[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  };
  const usage: Usage = {
    inputTokens: num('input_tokens'),
    outputTokens: num('output_tokens'),
    cacheReadTokens: num('cache_read_input_tokens'),
    cacheCreationTokens: num('cache_creation_input_tokens'),
  };
  if (
    usage.inputTokens === 0 &&
    usage.outputTokens === 0 &&
    usage.cacheReadTokens === 0 &&
    usage.cacheCreationTokens === 0
  ) {
    return null;
  }
  return usage;
}

function buildMessageEvent(ev: AnyRecord): MessageEvent | null {
  const role = pickRole(ev);
  if (role !== 'user' && role !== 'assistant') return null;
  const blocks = extractBlocks(ev);
  if (blocks.length === 0) return null;

  const msg = isObject(ev.message) ? (ev.message as AnyRecord) : null;
  const usage = coerceUsage(msg?.usage);
  const model = typeof msg?.model === 'string' && msg.model.trim() ? msg.model : null;
  const cost = typeof ev.costUSD === 'number' ? ev.costUSD : null;
  const duration = typeof ev.durationMs === 'number' ? ev.durationMs : null;

  return {
    uuid: typeof ev.uuid === 'string' ? ev.uuid : '',
    parentUuid: typeof ev.parentUuid === 'string' ? ev.parentUuid : null,
    ts: parseTimestamp(ev.timestamp ?? ev.ts ?? ev.time),
    role,
    isSidechain: ev.isSidechain === true,
    blocks,
    model,
    usage,
    costUSD: cost,
    durationMs: duration,
  };
}

export async function readSessionMessages(filePath: string): Promise<MessageEvent[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return [];
  }
  const out: MessageEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let ev: AnyRecord;
    try {
      ev = JSON.parse(trimmed) as AnyRecord;
    } catch {
      continue;
    }
    if (!isVisibleEvent(ev)) continue;
    const msg = buildMessageEvent(ev);
    if (msg) out.push(msg);
  }
  // Stable sort by ts; events with no ts keep their relative file order.
  out.sort((a, b) => {
    if (a.ts === null && b.ts === null) return 0;
    if (a.ts === null) return 1;
    if (b.ts === null) return -1;
    return a.ts - b.ts;
  });
  return out;
}
