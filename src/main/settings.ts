import Store from 'electron-store';
import {
  DEFAULT_EXCLUDE_CWD_PATTERNS,
  DEFAULT_SETTINGS,
  type AppSettings,
  type BranchIconMode,
  type SessionNotesMap,
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

function readSessionNotes(): SessionNotesMap {
  const raw = store.get('sessionNotes', {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SessionNotesMap = {};
  for (const [sid, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof sid !== 'string' || sid.length === 0) continue;
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const title = typeof v.title === 'string' ? v.title : '';
    const tags = Array.isArray(v.tags)
      ? v.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim())
      : [];
    if (!title && tags.length === 0) continue;
    out[sid] = { title, tags };
  }
  return out;
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
    sessionNotes: readSessionNotes(),
    vscodeResumeUriTemplate: store.get(
      'vscodeResumeUriTemplate',
      DEFAULT_SETTINGS.vscodeResumeUriTemplate,
    ),
    openWorkspaceBeforeResume: store.get(
      'openWorkspaceBeforeResume',
      DEFAULT_SETTINGS.openWorkspaceBeforeResume,
    ),
    vscodeOpenDelayMs: store.get('vscodeOpenDelayMs', DEFAULT_SETTINGS.vscodeOpenDelayMs),
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
  if ('sessionNotes' in patch && patch.sessionNotes && typeof patch.sessionNotes === 'object') {
    const cleaned: SessionNotesMap = {};
    for (const [sid, value] of Object.entries(patch.sessionNotes)) {
      if (!value) continue;
      const title = typeof value.title === 'string' ? value.title.trim() : '';
      const tags = Array.isArray(value.tags)
        ? Array.from(
            new Set(
              value.tags
                .filter((t): t is string => typeof t === 'string')
                .map((t) => t.trim())
                .filter((t) => t.length > 0),
            ),
          )
        : [];
      if (!title && tags.length === 0) continue;
      cleaned[sid] = { title, tags };
    }
    store.set('sessionNotes', cleaned);
  }
  if ('vscodeResumeUriTemplate' in patch && typeof patch.vscodeResumeUriTemplate === 'string') {
    store.set('vscodeResumeUriTemplate', patch.vscodeResumeUriTemplate.trim());
  }
  if ('openWorkspaceBeforeResume' in patch && typeof patch.openWorkspaceBeforeResume === 'boolean') {
    store.set('openWorkspaceBeforeResume', patch.openWorkspaceBeforeResume);
  }
  if ('vscodeOpenDelayMs' in patch && typeof patch.vscodeOpenDelayMs === 'number') {
    store.set('vscodeOpenDelayMs', Math.max(0, Math.floor(patch.vscodeOpenDelayMs)));
  }
  return getSettings();
}

export function setSessionNote(
  sessionId: string,
  patch: { title?: string; tags?: string[] } | null,
): AppSettings {
  const id = sessionId.trim();
  if (!id) return getSettings();
  const current = readSessionNotes();
  if (patch === null) {
    delete current[id];
  } else {
    const existing = current[id] ?? { title: '', tags: [] };
    const nextTitle = typeof patch.title === 'string' ? patch.title.trim() : existing.title;
    const nextTags = Array.isArray(patch.tags)
      ? Array.from(
          new Set(
            patch.tags
              .filter((t): t is string => typeof t === 'string')
              .map((t) => t.trim())
              .filter((t) => t.length > 0),
          ),
        )
      : existing.tags;
    if (!nextTitle && nextTags.length === 0) {
      delete current[id];
    } else {
      current[id] = { title: nextTitle, tags: nextTags };
    }
  }
  store.set('sessionNotes', current);
  return getSettings();
}
