import { promises as fs } from 'node:fs';
import { basename, join } from 'node:path';
import { getProjectsDir } from './paths';
import type { ProjectInfo } from './types';

const MAX_DECODE_DEPTH = 20;

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readOriginalPathFromIndex(dirPath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(join(dirPath, 'sessions-index.json'), 'utf8');
    const json = JSON.parse(raw);
    if (json && typeof json.originalPath === 'string' && json.originalPath.length > 0) {
      return json.originalPath;
    }
  } catch {
    // missing or malformed — fine, fall through
  }
  return null;
}

async function readCwdFromAnyJsonl(dirPath: string): Promise<string | null> {
  let files: string[];
  try {
    files = await fs.readdir(dirPath);
  } catch {
    return null;
  }
  for (const f of files) {
    if (!f.endsWith('.jsonl')) continue;
    let raw: string;
    try {
      raw = await fs.readFile(join(dirPath, f), 'utf8');
    } catch {
      continue;
    }
    const lines = raw.split('\n');
    const head = lines.slice(0, Math.min(lines.length, 20));
    for (const line of head) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const ev = JSON.parse(trimmed);
        if (ev && typeof ev.cwd === 'string' && ev.cwd.length > 0) return ev.cwd;
      } catch {
        // skip malformed line
      }
    }
  }
  return null;
}

/**
 * Walks the encoded folder name left-to-right, testing each `-` boundary as a
 * potential `/` separator against the actual filesystem. This disambiguates
 * `my-app` (a folder literally named `my-app`) from `my/app` (two folders).
 *
 * Modeled on the reference project's `decode_with_filesystem_check` —
 * particularly important on POSIX systems where folder names often contain
 * hyphens; on Windows the `~/.claude/projects/` encoding still uses `-` so the
 * same logic applies once the drive root is found.
 */
async function decodeWithFilesystemCheck(encodedName: string): Promise<string | null> {
  const stripped = encodedName.replace(/^-/, '');

  const tryFromRoot = async (root: string): Promise<string | null> => {
    return recurse(root, stripped, 0);
  };

  async function recurse(prefix: string, remaining: string, depth: number): Promise<string | null> {
    if (depth > MAX_DECODE_DEPTH) return null;
    if (!remaining) return prefix || null;

    // Greedy: longest matching segment first.
    for (let len = remaining.length; len >= 0; len--) {
      const segment = remaining.slice(0, len);
      const rest = len === remaining.length ? '' : remaining.slice(len + 1);
      // Skip splits that would land mid-word — boundary must be `-` or end-of-string.
      if (len < remaining.length && remaining[len] !== '-') continue;
      const candidate = segment ? `${prefix}/${segment}` : prefix;
      if (!segment) continue;
      if (!(await pathExists(candidate))) continue;
      if (!rest) return candidate;
      const next = await recurse(candidate, rest, depth + 1);
      if (next) return next;
    }
    return null;
  }

  // POSIX-style: try from /
  const posix = await tryFromRoot('');
  if (posix) return posix;

  // Windows drives: try C:, D: … as roots when the platform has them.
  if (process.platform === 'win32') {
    for (const letter of 'CDEFGH') {
      const root = `${letter}:`;
      if (await pathExists(`${root}/`)) {
        const win = await tryFromRoot(root);
        if (win) return win;
      }
    }
  }
  return null;
}

function naiveDecode(encodedName: string): string {
  return encodedName.replace(/^-/, '/').replace(/-/g, '/');
}

export async function decodeProjectPath(encodedDirPath: string): Promise<string> {
  const encodedName = basename(encodedDirPath);

  const fromIndex = await readOriginalPathFromIndex(encodedDirPath);
  if (fromIndex) return fromIndex;

  const fromCwd = await readCwdFromAnyJsonl(encodedDirPath);
  if (fromCwd) return fromCwd;

  const fromFs = await decodeWithFilesystemCheck(encodedName);
  if (fromFs) return fromFs;

  return naiveDecode(encodedName);
}

export async function scanProjects(): Promise<ProjectInfo[]> {
  const projectsDir = getProjectsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(projectsDir);
  } catch {
    return [];
  }

  const results = await Promise.all(
    entries.map(async (entry): Promise<ProjectInfo | null> => {
      const dirPath = join(projectsDir, entry);
      try {
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) return null;
      } catch {
        return null;
      }

      let files: string[];
      try {
        files = await fs.readdir(dirPath);
      } catch {
        return null;
      }
      const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));
      if (jsonlFiles.length === 0) return null;

      let lastModified = 0;
      await Promise.all(
        jsonlFiles.map(async (f) => {
          try {
            const s = await fs.stat(join(dirPath, f));
            if (s.mtimeMs > lastModified) lastModified = s.mtimeMs;
          } catch {
            // ignore
          }
        }),
      );

      const actualPath = await decodeProjectPath(dirPath);
      const trimmed = actualPath.replace(/[\\/]+$/, '');
      const displayName = basename(trimmed) || trimmed || entry;

      return {
        encodedDirName: entry,
        actualPath,
        displayName,
        sessionCount: jsonlFiles.length,
        lastModified,
      };
    }),
  );

  return results
    .filter((p): p is ProjectInfo => p !== null)
    .sort((a, b) => b.lastModified - a.lastModified);
}
