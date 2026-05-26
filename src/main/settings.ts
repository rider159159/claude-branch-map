import Store from 'electron-store';
import {
  DEFAULT_EXCLUDE_CWD_PATTERNS,
  DEFAULT_SETTINGS,
  type AppSettings,
  type BranchIconMode,
} from '@shared/types';

const store = new Store<AppSettings>({
  name: 'settings',
  defaults: DEFAULT_SETTINGS,
});

function readStringArray(key: keyof AppSettings, fallback: string[]): string[] {
  const raw = store.get(key, fallback);
  if (!Array.isArray(raw)) return fallback;
  return raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

export function getSettings(): AppSettings {
  return {
    repoPathOverride: store.get('repoPathOverride', null),
    branchIconMode: store.get('branchIconMode', 'created') as BranchIconMode,
    excludeCwdPatterns: readStringArray('excludeCwdPatterns', DEFAULT_EXCLUDE_CWD_PATTERNS),
    hiddenProjects: readStringArray('hiddenProjects', []),
  };
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  if ('repoPathOverride' in patch) {
    store.set('repoPathOverride', patch.repoPathOverride ?? null);
  }
  if ('branchIconMode' in patch && patch.branchIconMode) {
    store.set('branchIconMode', patch.branchIconMode);
  }
  if ('excludeCwdPatterns' in patch && Array.isArray(patch.excludeCwdPatterns)) {
    store.set(
      'excludeCwdPatterns',
      patch.excludeCwdPatterns
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    );
  }
  if ('hiddenProjects' in patch && Array.isArray(patch.hiddenProjects)) {
    // De-dupe + drop empties so repeated hides don't bloat the list.
    const uniq = Array.from(
      new Set(
        patch.hiddenProjects
          .map((p) => (typeof p === 'string' ? p.trim() : ''))
          .filter((p) => p.length > 0),
      ),
    );
    store.set('hiddenProjects', uniq);
  }
  return getSettings();
}
