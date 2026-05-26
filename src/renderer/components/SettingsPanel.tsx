import { useCallback } from 'react';
import type { AppSettings, BranchIconMode } from '@shared/types';
import { api } from '../api';
import { shortenPath } from '../format';

interface Props {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}

export function SettingsPanel({ settings, onChange }: Props) {
  const pickRepo = useCallback(async () => {
    const path = await api.pickRepo();
    if (path) onChange({ repoPathOverride: path });
  }, [onChange]);

  const clearRepo = useCallback(() => {
    onChange({ repoPathOverride: null });
  }, [onChange]);

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
    </section>
  );
}
