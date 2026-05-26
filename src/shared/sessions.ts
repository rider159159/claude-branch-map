import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getProjectsDir } from './paths';
import type { SessionSummary } from './types';

const TITLE_MAX = 80;

type AnyRecord = Record<string, unknown>;

function isObject(v: unknown): v is AnyRecord {
  return typeof v === 'object' && v !== null;
}

function parseTimestamp(raw: unknown): number | null {
  if (typeof raw === 'number') return raw < 1e12 ? raw * 1000 : raw;
  if (typeof raw === 'string') {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function extractText(content: unknown): string | null {
  if (typeof content === 'string') return content.trim() || null;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part === 'string' && part.trim()) return part.trim();
      if (isObject(part)) {
        if (typeof part.text === 'string' && part.text.trim()) return part.text.trim();
        if (typeof part.content === 'string' && part.content.trim()) return part.content.trim();
      }
    }
  }
  if (isObject(content)) {
    if (typeof content.text === 'string') return content.text.trim() || null;
  }
  return null;
}

function extractTitleFromEvent(ev: AnyRecord): string | null {
  if (typeof ev.summary === 'string' && ev.summary.trim()) return ev.summary.trim();
  const msg = ev.message;
  if (isObject(msg)) {
    const role = msg.role ?? ev.role;
    if (role === 'user' || role === undefined) {
      const t = extractText(msg.content);
      if (t) return t;
    }
  }
  if (ev.role === 'user' || ev.type === 'user') {
    const t = extractText(ev.content);
    if (t) return t;
  }
  return null;
}

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

    if (!title) {
      const t = extractTitleFromEvent(ev);
      if (t) title = truncateTitle(t);
    }

    if (isObject(ev.message) || ev.type === 'user' || ev.type === 'assistant') {
      messageCount += 1;
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
  };
}

export async function scanSessions(): Promise<SessionSummary[]> {
  const projectsDir = getProjectsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(projectsDir);
  } catch {
    return [];
  }

  const result: SessionSummary[] = [];
  for (const entry of entries) {
    const dirPath = join(projectsDir, entry);
    let stat;
    try {
      stat = await fs.stat(dirPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    const fallbackCwd = decodeProjectDirName(entry);

    let files: string[];
    try {
      files = await fs.readdir(dirPath);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const filePath = join(dirPath, file);
      const summary = await parseSessionFile(filePath, fallbackCwd);
      if (summary) result.push(summary);
    }
  }

  result.sort((a, b) => b.lastTs - a.lastTs);
  return result;
}
