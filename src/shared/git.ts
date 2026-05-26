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

export async function listBranches(repoPath: string): Promise<BranchInfo[]> {
  if (!(await isGitRepo(repoPath))) return [];
  const g = git(repoPath);
  const branchSummary = await g.branchLocal();
  const branchNames = branchSummary.all;
  const current = branchSummary.current;

  const infos: BranchInfo[] = [];
  for (const name of branchNames) {
    const exclusions = branchNames.filter((b) => b !== name).map((b) => `^${b}`);
    let firstCommitTs = 0;
    let lastCommitTs = 0;
    let commitCount = 0;
    try {
      const args = ['log', name, ...exclusions, '--pretty=format:%at', '--no-merges'];
      const raw = await g.raw(args);
      const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        const tss = lines.map((l) => parseInt(l, 10) * 1000).filter(Number.isFinite);
        if (tss.length > 0) {
          firstCommitTs = Math.min(...tss);
          lastCommitTs = Math.max(...tss);
          commitCount = tss.length;
        }
      }
      if (commitCount === 0) {
        // Branch has no unique commits; fall back to tip commit timestamp so it still has a timeline anchor.
        const tipRaw = await g.raw(['log', '-1', name, '--pretty=format:%at']);
        const tip = parseInt(tipRaw.trim(), 10);
        if (Number.isFinite(tip)) {
          firstCommitTs = tip * 1000;
          lastCommitTs = tip * 1000;
        }
      }
    } catch {
      // Skip branches that fail to log (e.g. invalid refs).
    }
    infos.push({
      name,
      firstCommitTs,
      lastCommitTs,
      commitCount,
      isCurrent: name === current,
    });
  }
  return infos;
}
