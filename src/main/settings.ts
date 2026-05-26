import Store from 'electron-store';
import { DEFAULT_SETTINGS, type AppSettings, type BranchIconMode } from '@shared/types';

const store = new Store<AppSettings>({
  name: 'settings',
  defaults: DEFAULT_SETTINGS,
});

export function getSettings(): AppSettings {
  return {
    repoPathOverride: store.get('repoPathOverride', null),
    branchIconMode: store.get('branchIconMode', 'created') as BranchIconMode,
  };
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  if ('repoPathOverride' in patch) {
    store.set('repoPathOverride', patch.repoPathOverride ?? null);
  }
  if ('branchIconMode' in patch && patch.branchIconMode) {
    store.set('branchIconMode', patch.branchIconMode);
  }
  return getSettings();
}
