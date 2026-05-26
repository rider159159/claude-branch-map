import { useCallback, useEffect, useState } from 'react';
import type { AppSettings, BranchIconMode } from '@shared/types';
import { api } from '../api';
import { shortenPath } from '../format';

interface Props {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}

export function SettingsPanel({ settings, onChange }: Props) {
  const [excludeText, setExcludeText] = useState(() =>
    settings.excludeCwdPatterns.join('\n'),
  );

  useEffect(() => {
    setExcludeText(settings.excludeCwdPatterns.join('\n'));
  }, [settings.excludeCwdPatterns]);

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
        <label className="settings-label">Repo path</label>
        <div className="settings-control">
          <span className="settings-value" title={settings.repoPathOverride ?? undefined}>
            {settings.repoPathOverride
              ? shortenPath(settings.repoPathOverride, 4)
              : 'Use each session’s cwd'}
          </span>
          <button className="ghost" onClick={pickRepo}>
            Choose folder…
          </button>
          {settings.repoPathOverride && (
            <button className="ghost" onClick={clearRepo}>
              Reset
            </button>
          )}
        </div>
      </div>
      <div className="settings-row">
        <label className="settings-label" htmlFor="branch-mode-select">
          Branch icon mode
        </label>
        <div className="settings-control">
          <select
            id="branch-mode-select"
            value={settings.branchIconMode}
            onChange={(e) =>
              onChange({ branchIconMode: e.target.value as BranchIconMode })
            }
          >
            <option value="created">A · Branches created during the session</option>
            <option value="created-with-commits">
              B · Created and with at least one commit
            </option>
          </select>
        </div>
      </div>
      <div className="settings-row settings-row-top">
        <label className="settings-label" htmlFor="exclude-cwd-text">
          Hide cwd containing
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
            One substring per line. Sessions whose cwd includes any line are hidden. Click outside to apply.
          </span>
        </div>
      </div>
    </section>
  );
}
