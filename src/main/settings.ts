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

export function getSettings(): AppSettings {
  const raw = store.get('excludeCwdPatterns', DEFAULT_EXCLUDE_CWD_PATTERNS);
  const excludeCwdPatterns = Array.isArray(raw)
    ? raw.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : DEFAULT_EXCLUDE_CWD_PATTERNS;
  return {
    repoPathOverride: store.get('repoPathOverride', null),
    branchIconMode: store.get('branchIconMode', 'created') as BranchIconMode,
    excludeCwdPatterns,
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
  return getSettings();
}
