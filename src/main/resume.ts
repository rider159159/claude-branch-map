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
}): Promise<OpenInVscodeResult> {
  const { sessionId, cwd, uriTemplate, openWorkspaceBeforeResume } = opts;
  // 先做前置條件檢查,避免 URI 已送出後才發現 cwd 缺失,
  // 造成「VS Code 被開了一次 + UI fallback 覆寫剪貼簿」的雙重副作用。
  if (openWorkspaceBeforeResume && (!cwd || cwd.trim().length === 0)) {
    return { ok: false, error: '找不到此對話的工作目錄(cwd)' };
  }
  // URI 與 workspace 並發:URI handler 若先到、IDE 還沒開 workspace,
  // 後到的 `code <cwd>` 會讓 IDE 載入 workspace 後再排隊處理 URI。
  // 任一邊失敗都不影響另一邊,整體比舊版「串列 + 1.5s sleep」快約 1.5 秒。
  if (openWorkspaceBeforeResume && cwd) {
    openWorkspaceFolder(cwd).catch((err) => {
      console.error('[openInVscode] spawn code 失敗:', err);
    });
  }
  try {
    await shell.openExternal(buildResumeUri(uriTemplate, sessionId));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
