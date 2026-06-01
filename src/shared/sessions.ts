import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getProjectsDir } from './paths';
import {
  coerceUsage,
  extractBlocks,
  extractFirstText,
  isCountableEvent,
  isObject,
  isVisibleEvent,
  parseTimestamp,
  pickRole,
} from './messages';
import type { SessionSummary } from './types';

const TITLE_MAX = 80;

type AnyRecord = Record<string, unknown>;

function truncateTitle(s: string): string {
  const oneLine = s.replace(/\s+/g, ' ').trim();
  return oneLine.length > TITLE_MAX ? oneLine.slice(0, TITLE_MAX - 1) + '…' : oneLine;
}

function decodeProjectDirName(name: string): string {
  // Claude Code encodes project paths by replacing path separators with `-`.
  // We can't perfectly reverse it, so return as-is as a fallback.
  return name.replace(/^-/, '/').replace(/-/g, '/');
}

async function parseSessionFile(filePath: string, fallbackCwd: string): Promise<SessionSummary | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
  const lines = raw.split('\n');
  let title: string | null = null;
  let cwd: string | null = null;
  let firstTs: number | null = null;
  let lastTs: number | null = null;
  let messageCount = 0;
  let sessionId: string | null = null;
  let model: string | null = null;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUSD = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let ev: AnyRecord;
    try {
      ev = JSON.parse(trimmed) as AnyRecord;
    } catch {
      continue;
    }
    if (typeof ev.sessionId === 'string' && !sessionId) sessionId = ev.sessionId;
    if (typeof ev.session_id === 'string' && !sessionId) sessionId = ev.session_id;
    if (typeof ev.cwd === 'string' && !cwd) cwd = ev.cwd;

    const ts = parseTimestamp(ev.timestamp ?? ev.ts ?? ev.time);
    if (ts !== null) {
      if (firstTs === null || ts < firstTs) firstTs = ts;
      if (lastTs === null || ts > lastTs) lastTs = ts;
    }

    // Title: first non-sidechain, non-meta user text. Falls back to a top-level
    // `summary` field on the raw event if no user text is found later.
    if (!title) {
      if (ev.isSidechain !== true && isVisibleEvent(ev) && pickRole(ev) === 'user') {
        const t = extractFirstText(extractBlocks(ev));
        if (t) title = truncateTitle(t);
      } else if (typeof ev.summary === 'string' && ev.summary.trim()) {
        title = truncateTitle(ev.summary);
      }
    }

    if (isCountableEvent(ev)) {
      messageCount += 1;
    }

    // Aggregate model + tokens + cost across assistant turns.
    if (pickRole(ev) === 'assistant' && ev.isSidechain !== true) {
      const msg = isObject(ev.message) ? (ev.message as AnyRecord) : null;
      const m = typeof msg?.model === 'string' && msg.model.trim() ? msg.model : null;
      if (m) model = m;
      const usage = coerceUsage(msg?.usage);
      if (usage) {
        totalInputTokens += usage.inputTokens;
        totalOutputTokens += usage.outputTokens;
      }
      if (typeof ev.costUSD === 'number' && Number.isFinite(ev.costUSD)) {
        totalCostUSD += ev.costUSD;
      }
    }
  }

  if (!sessionId) {
    const base = filePath.split(/[\\/]/).pop() ?? '';
    sessionId = base.replace(/\.jsonl$/, '');
  }

  if (firstTs === null || lastTs === null) {
    try {
      const stat = await fs.stat(filePath);
      const mt = stat.mtimeMs;
      firstTs = firstTs ?? mt;
      lastTs = lastTs ?? mt;
    } catch {
      firstTs = firstTs ?? 0;
      lastTs = lastTs ?? 0;
    }
  }

  return {
    sessionId,
    cwd: cwd ?? fallbackCwd,
    title: title ?? '(no title)',
    firstTs,
    lastTs,
    messageCount,
    filePath,
    model,
    totalInputTokens,
    totalOutputTokens,
    totalCostUSD,
    pinned: false,
    hidden: false,
    customTitle: '',
    tags: [],
  };
}

async function collectJsonlPaths(): Promise<Array<{ filePath: string; fallbackCwd: string }>> {
  const projectsDir = getProjectsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(projectsDir);
  } catch {
    return [];
  }

  const dirResults = await Promise.all(
    entries.map(async (entry) => {
      const dirPath = join(projectsDir, entry);
      try {
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) return [];
      } catch {
        return [];
      }
      const fallbackCwd = decodeProjectDirName(entry);
      let files: string[];
      try {
        files = await fs.readdir(dirPath);
      } catch {
        return [];
      }
      return files
        .filter((f) => f.endsWith('.jsonl'))
        .map((file) => ({ filePath: join(dirPath, file), fallbackCwd }));
    }),
  );
  return dirResults.flat();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function scanSessions(): Promise<SessionSummary[]> {
  const paths = await collectJsonlPaths();
  // Parallel file reads with a bounded concurrency keep big projects (hundreds of
  // jsonl files) from blocking the event loop sequentially while avoiding
  // "too many open files" on platforms with low ulimit defaults.
  const parsed = await mapWithConcurrency(paths, 16, ({ filePath, fallbackCwd }) =>
    parseSessionFile(filePath, fallbackCwd),
  );
  const result = parsed.filter((s): s is SessionSummary => s !== null);
  result.sort((a, b) => b.lastTs - a.lastTs);
  return result;
}

export async function scanSessionsInProject(
  encodedDirPath: string,
  fallbackCwd: string,
): Promise<SessionSummary[]> {
  let files: string[];
  try {
    files = await fs.readdir(encodedDirPath);
  } catch {
    return [];
  }
  const jsonlPaths = files
    .filter((f) => f.endsWith('.jsonl'))
    .map((file) => ({ filePath: join(encodedDirPath, file), fallbackCwd }));
  const parsed = await mapWithConcurrency(jsonlPaths, 16, ({ filePath, fallbackCwd: cwd }) =>
    parseSessionFile(filePath, cwd),
  );
  const result = parsed.filter((s): s is SessionSummary => s !== null);
  result.sort((a, b) => b.lastTs - a.lastTs);
  return result;
}
