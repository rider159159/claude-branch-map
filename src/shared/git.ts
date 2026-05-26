import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';
import type { BranchInfo } from './types';

export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(join(repoPath, '.git'));
    return stat.isDirectory() || stat.isFile();
  } catch {
    return false;
  }
}

function git(repoPath: string): SimpleGit {
  return simpleGit({ baseDir: repoPath, binary: 'git' });
}

/**
 * Single `git for-each-ref` call to enumerate local branches with tip commit time.
 *
 * Compared to the earlier per-branch `git log` loop this is one subprocess instead of N.
 * Trade-off: we surface the branch's tip commit time as both `firstCommitTs` and
 * `lastCommitTs`, and `commitCount` is set to 1 if the branch exists. That makes
 * mode B's "has commits" filter equivalent to mode A for the fast path; a precise
 * per-branch count can be reintroduced later if it proves necessary.
 */
export async function listBranches(repoPath: string): Promise<BranchInfo[]> {
  if (!(await isGitRepo(repoPath))) return [];
  const g = git(repoPath);
  let raw: string;
  try {
    raw = await g.raw([
      'for-each-ref',
      '--format=%(HEAD)\t%(refname:short)\t%(committerdate:unix)',
      'refs/heads',
    ]);
  } catch {
    return [];
  }
  const infos: BranchInfo[] = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    const [head, name, tsStr] = line.split('\t');
    if (!name) continue;
    const tsSec = parseInt(tsStr ?? '', 10);
    const tipMs = Number.isFinite(tsSec) ? tsSec * 1000 : 0;
    infos.push({
      name,
      firstCommitTs: tipMs,
      lastCommitTs: tipMs,
      commitCount: 1,
      isCurrent: head === '*',
    });
  }
  return infos;
}
