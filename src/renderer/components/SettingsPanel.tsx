import { useCallback, useEffect, useState } from 'react';
import type { AppSettings, BranchIconMode, ProjectInfo, SessionSummary } from '@shared/types';
import { api } from '../api';
import { shortenPath } from '../format';

interface Props {
  settings: AppSettings;
  hiddenProjects: ProjectInfo[];
  onChange: (patch: Partial<AppSettings>) => void;
  onShowProject: (encodedDirName: string) => void;
  onShowSession: (sessionId: string) => void;
}

export function SettingsPanel({
  settings,
  hiddenProjects,
  onChange,
  onShowProject,
  onShowSession,
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
