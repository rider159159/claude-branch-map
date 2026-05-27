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
    pinnedProjects: readStringArray('pinnedProjects', []),
    pinnedSessions: readStringArray('pinnedSessions', []),
    hiddenSessions: readStringArray('hiddenSessions', []),
  };
}

function uniqStrings(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  // Preserve first-seen order so pin order is meaningful (most recently pinned
  // ends up at array tail; the IPC layer reverses for "newest pin on top").
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of list) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
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
    store.set('hiddenProjects', uniqStrings(patch.hiddenProjects));
  }
  if ('pinnedProjects' in patch && Array.isArray(patch.pinnedProjects)) {
    store.set('pinnedProjects', uniqStrings(patch.pinnedProjects));
  }
  if ('pinnedSessions' in patch && Array.isArray(patch.pinnedSessions)) {
    store.set('pinnedSessions', uniqStrings(patch.pinnedSessions));
  }
  if ('hiddenSessions' in patch && Array.isArray(patch.hiddenSessions)) {
    store.set('hiddenSessions', uniqStrings(patch.hiddenSessions));
  }
  return getSettings();
}
