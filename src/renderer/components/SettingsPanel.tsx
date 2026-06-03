import { useCallback, useEffect, useState } from 'react';
import type { HookHealth } from '@shared/hook';
import type { AppSettings, BranchIconMode, ProjectInfo, SessionSummary } from '@shared/types';
import { api } from '../api';
import { shortenPath } from '../format';

interface Props {
  settings: AppSettings;
  hiddenProjects: ProjectInfo[];
  hookHealth: HookHealth | null;
  hookHealthError: string | null;
  onChange: (patch: Partial<AppSettings>) => void;
  onShowProject: (encodedDirName: string) => void;
  onShowSession: (sessionId: string) => void;
  onRefreshHookHealth: () => Promise<void>;
}

export function SettingsPanel({
  settings,
  hiddenProjects,
  hookHealth,
  hookHealthError,
  onChange,
  onShowProject,
  onShowSession,
  onRefreshHookHealth,
}: Props) {
  const [hiddenSessions, setHiddenSessions] = useState<SessionSummary[]>([]);
  useEffect(() => {
    let alive = true;
    api.hiddenSessions().then((list) => {
      if (alive) setHiddenSessions(list);
    });
    return () => {
      alive = false;
    };
  }, [settings.hiddenSessions]);

  const [refreshingHook, setRefreshingHook] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  // 平台未知前不顯示指令,避免 Windows 使用者看到 bash 指令(反之亦然)。
  const installCommand: string | null = hookHealth
    ? hookHealth.platform === 'win32'
      ? 'powershell -ExecutionPolicy Bypass -File scripts\\install-hook.ps1'
      : 'bash scripts/install-hook.sh'
    : null;

  const onCopyInstallCmd = useCallback(async () => {
    if (!installCommand) return;
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopyHint('已複製。請在 claude-branch-map 專案根目錄的終端執行。');
    } catch {
      setCopyHint('複製失敗,請手動選取指令。');
    }
    window.setTimeout(() => setCopyHint(null), 3000);
  }, [installCommand]);

  const onRecheckHook = useCallback(async () => {
    setRefreshingHook(true);
    try {
      await onRefreshHookHealth();
    } finally {
      setRefreshingHook(false);
    }
  }, [onRefreshHookHealth]);

  const [excludeText, setExcludeText] = useState(() =>
    settings.excludeCwdPatterns.join('\n'),
  );

  useEffect(() => {
    setExcludeText(settings.excludeCwdPatterns.join('\n'));
  }, [settings.excludeCwdPatterns]);

  const [uriTemplate, setUriTemplate] = useState(settings.vscodeResumeUriTemplate);
  useEffect(() => {
    setUriTemplate(settings.vscodeResumeUriTemplate);
  }, [settings.vscodeResumeUriTemplate]);

  const commitUriTemplate = useCallback(() => {
    const next = uriTemplate.trim();
    if (next && next !== settings.vscodeResumeUriTemplate) {
      onChange({ vscodeResumeUriTemplate: next });
    }
  }, [uriTemplate, settings.vscodeResumeUriTemplate, onChange]);

  const pickRepo = useCallback(async () => {
    const path = await api.pickRepo();
    if (path) onChange({ repoPathOverride: path });
  }, [onChange]);

  const clearRepo = useCallback(() => {
    onChange({ repoPathOverride: null });
  }, [onChange]);

  const commitExcludes = useCallback(() => {
    const patterns = excludeText
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const same =
      patterns.length === settings.excludeCwdPatterns.length &&
      patterns.every((p, i) => p === settings.excludeCwdPatterns[i]);
    if (!same) onChange({ excludeCwdPatterns: patterns });
  }, [excludeText, settings.excludeCwdPatterns, onChange]);

  return (
    <section className="settings">
      <div className="settings-row">
        <label className="settings-label">儲存庫(repo)路徑</label>
        <div className="settings-control">
          <span className="settings-value" title={settings.repoPathOverride ?? undefined}>
            {settings.repoPathOverride
              ? shortenPath(settings.repoPathOverride, 4)
              : '使用各對話的 cwd'}
          </span>
          <button className="ghost" onClick={pickRepo}>
            選擇資料夾…
          </button>
          {settings.repoPathOverride && (
            <button className="ghost" onClick={clearRepo}>
              重設
            </button>
          )}
        </div>
      </div>
      <div className="settings-row">
        <label className="settings-label" htmlFor="branch-mode-select">
          分支圖示模式
        </label>
        <div className="settings-control">
          <select
            id="branch-mode-select"
            value={settings.branchIconMode}
            onChange={(e) =>
              onChange({ branchIconMode: e.target.value as BranchIconMode })
            }
          >
            <option value="created">A · 對話期間建立的分支</option>
            <option value="created-with-commits">
              B · 建立且至少有一次 commit
            </option>
          </select>
        </div>
      </div>
      <div className="settings-row settings-row-top">
        <label className="settings-label" htmlFor="exclude-cwd-text">
          隱藏 cwd 包含
        </label>
        <div className="settings-control settings-control-col">
          <textarea
            id="exclude-cwd-text"
            className="settings-textarea"
            value={excludeText}
            onChange={(e) => setExcludeText(e.target.value)}
            onBlur={commitExcludes}
            rows={3}
            placeholder=".claude-mem/observer-sessions"
            spellCheck={false}
          />
          <span className="settings-hint">
            每行一個子字串。cwd 包含任一行的對話將被隱藏。點擊外部以套用。
          </span>
        </div>
      </div>
      <div className="settings-row settings-row-top">
        <label className="settings-label" htmlFor="vscode-uri-template">
          VS Code 繼續對話
        </label>
        <div className="settings-control settings-control-col">
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.openWorkspaceBeforeResume}
              onChange={(e) =>
                onChange({ openWorkspaceBeforeResume: e.target.checked })
              }
            />
            繼續對話前先用 code 開啟工作資料夾
          </label>
          <input
            id="vscode-uri-template"
            className="settings-input"
            type="text"
            value={uriTemplate}
            onChange={(e) => setUriTemplate(e.target.value)}
            onBlur={commitUriTemplate}
            placeholder="vscode://anthropic.claude-code/open?session={sessionId}"
            spellCheck={false}
          />
          <span className="settings-hint">
            URI 樣板的 {'{sessionId}'} 會被代換成對話 ID。deep link 與開啟工作資料夾會同時觸發(IDE 自行排隊),失敗時自動改為複製 resume 指令。
          </span>
        </div>
      </div>
      <div className="settings-row settings-row-top">
        <label className="settings-label">已隱藏的專案</label>
        <div className="settings-control settings-control-col">
          {hiddenProjects.length === 0 ? (
            <span className="settings-hint">
              沒有已隱藏的專案。點擊專案上的眼睛圖示即可隱藏。
            </span>
          ) : (
            <ul className="hidden-projects">
              {hiddenProjects.map((p) => (
                <li key={p.encodedDirName} className="hidden-project-item">
                  <div className="hidden-project-info">
                    <span className="hidden-project-name">{p.displayName}</span>
                    <span className="hidden-project-path" title={p.actualPath}>
                      {shortenPath(p.actualPath, 4)}
                    </span>
                  </div>
                  <button
                    className="ghost"
                    onClick={() => onShowProject(p.encodedDirName)}
                  >
                    顯示
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className="settings-hint">
            隱藏僅影響此介面 — 磁碟上的 jsonl 檔案不會更動。
          </span>
        </div>
      </div>
      <div className="settings-row settings-row-top" id="settings-hook-section">
        <label className="settings-label">Claude hook 整合</label>
        <div className="settings-control settings-control-col">
          {hookHealthError ? (
            <span className="settings-hint">
              無法檢查 hook 狀態:{hookHealthError}
            </span>
          ) : hookHealth ? (
            <ul className="hook-status">
              <li className={hookHealth.scriptInstalled ? 'ok' : 'missing'}>
                <span className="hook-status-mark" aria-hidden>
                  {hookHealth.scriptInstalled ? '✓' : '×'}
                </span>
                hook 腳本(~/.claude/hooks/branch-hook.
                {hookHealth.platform === 'win32' ? 'ps1' : 'sh'})
              </li>
              <li className={hookHealth.settingsRegistered ? 'ok' : 'missing'}>
                <span className="hook-status-mark" aria-hidden>
                  {hookHealth.settingsRegistered ? '✓' : '×'}
                </span>
                Claude 設定已註冊 PostToolUse
              </li>
              <li className={hookHealth.jsonlExists ? 'ok' : 'missing'}>
                <span className="hook-status-mark" aria-hidden>
                  {hookHealth.jsonlExists ? '✓' : '×'}
                </span>
                branch-hook.jsonl 已建立({hookHealth.jsonlRecordCount} 筆紀錄)
              </li>
            </ul>
          ) : (
            <span className="settings-hint">正在檢查 hook 狀態…</span>
          )}
          <div className="settings-control">
            <button className="ghost" onClick={onRecheckHook} disabled={refreshingHook}>
              {refreshingHook ? '檢查中…' : '重新檢查'}
            </button>
            {installCommand && (
              <button className="ghost" onClick={onCopyInstallCmd}>
                複製安裝指令
              </button>
            )}
          </div>
          {installCommand && (
            <code className="settings-code" title={installCommand}>
              {installCommand}
            </code>
          )}
          {copyHint && <span className="settings-hint">{copyHint}</span>}
          <span className="settings-hint">
            hook 安裝後,新建對話的分支匹配信心度會從「時間窗推測」升級為「實際 checkout 記錄」。請在 claude-branch-map 專案根目錄的終端執行上述指令(只需做一次)。
          </span>
        </div>
      </div>
      <div className="settings-row settings-row-top">
        <label className="settings-label">已隱藏的對話</label>
        <div className="settings-control settings-control-col">
          {settings.hiddenSessions.length === 0 ? (
            <span className="settings-hint">
              沒有已隱藏的對話。點擊對話上的眼睛圖示即可隱藏。
            </span>
          ) : hiddenSessions.length === 0 ? (
            <span className="settings-hint">
              共 {settings.hiddenSessions.length} 則已隱藏對話。請先開啟對應專案一次,系統才能在此列出以便還原。
            </span>
          ) : (
            <ul className="hidden-projects">
              {hiddenSessions.map((s) => (
                <li key={s.sessionId} className="hidden-project-item">
                  <div className="hidden-project-info">
                    <span className="hidden-project-name">{s.title}</span>
                    <span className="hidden-project-path" title={s.cwd}>
                      {shortenPath(s.cwd, 4)} · {s.sessionId.slice(0, 8)}
                    </span>
                  </div>
                  <button className="ghost" onClick={() => onShowSession(s.sessionId)}>
                    顯示
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className="settings-hint">
            隱藏僅影響此介面 — 磁碟上的 jsonl 檔案不會更動。
          </span>
        </div>
      </div>
    </section>
  );
}
