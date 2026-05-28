import { clipboard, shell } from 'electron';
import { execFile } from 'node:child_process';
import type { OpenInVscodeResult } from '@shared/types';

export function buildResumeCommand(sessionId: string): string {
  return `claude --resume ${sessionId}`;
}

export function copyResumeCommand(sessionId: string): string {
  const cmd = buildResumeCommand(sessionId);
  clipboard.writeText(cmd);
  return cmd;
}

export function buildResumeUri(template: string, sessionId: string): string {
  return template.replaceAll('{sessionId}', encodeURIComponent(sessionId));
}

// execFile 以 argv 陣列傳 cwd,不經 shell、不字串拼接,因此即使 cwd 含
// 空白或 shell 元字元也無命令注入風險。Windows 的 code 啟動器是 code.cmd,
// execFile 不會自動補副檔名,於 ENOENT 時改試 code.cmd,避免使用 shell: true。
function openWorkspaceFolder(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('code', [cwd], { windowsHide: true }, (err) => {
      if (!err) return resolve();
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' && process.platform === 'win32') {
        execFile('code.cmd', [cwd], { windowsHide: true }, (err2) =>
          err2 ? reject(err2) : resolve(),
        );
        return;
      }
      reject(err);
    });
  });
}

export async function openInVscode(opts: {
  sessionId: string;
  cwd: string | null;
  uriTemplate: string;
  openWorkspaceBeforeResume: boolean;
  delayMs: number;
}): Promise<OpenInVscodeResult> {
  const { sessionId, cwd, uriTemplate, openWorkspaceBeforeResume, delayMs } = opts;
  try {
    if (openWorkspaceBeforeResume) {
      if (!cwd || cwd.trim().length === 0) {
        return { ok: false, error: '找不到此對話的工作目錄(cwd)' };
      }
      await openWorkspaceFolder(cwd);
      await new Promise((r) => setTimeout(r, Math.max(0, delayMs)));
    }
    await shell.openExternal(buildResumeUri(uriTemplate, sessionId));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
