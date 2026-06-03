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

// 舊版本(2026-06-02 前)settings.json 的 sessionNotes entry 含 tags 欄位。
// 砍掉 tag 系統後讀進來直接丟,只保留 title;title 為空的 entry 整個略過。
function readSessionNotes(): SessionNotesMap {
  const raw = store.get('sessionNotes', {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SessionNotesMap = {};
  for (const [sid, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof sid !== 'string' || sid.length === 0) continue;
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const title = typeof v.title === 'string' ? v.title : '';
    if (!title) continue;
    out[sid] = { title };
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
      if (!title) continue;
      cleaned[sid] = { title };
    }
    store.set('sessionNotes', cleaned);
  }
  if ('vscodeResumeUriTemplate' in patch && typeof patch.vscodeResumeUriTemplate === 'string') {
    store.set('vscodeResumeUriTemplate', patch.vscodeResumeUriTemplate.trim());
  }
  if ('openWorkspaceBeforeResume' in patch && typeof patch.openWorkspaceBeforeResume === 'boolean') {
    store.set('openWorkspaceBeforeResume', patch.openWorkspaceBeforeResume);
  }
  // 一次性清除舊鍵:2026-06-03 移除 vscodeOpenDelayMs(改用 URI + spawn 並發)。
  // 留著 delete 是讓 settings.json 不再殘留死欄位,可在數版後拿掉。
  // electron-store 的 has/delete 接受任意 key,以 unknown 繞過已從型別移除的鍵。
  const legacy = store as unknown as { has(k: string): boolean; delete(k: string): void };
  if (legacy.has('vscodeOpenDelayMs')) {
    legacy.delete('vscodeOpenDelayMs');
  }
  return getSettings();
}

export function setSessionNote(
  sessionId: string,
  patch: { title?: string } | null,
): AppSettings {
  const id = sessionId.trim();
  if (!id) return getSettings();
  const current = readSessionNotes();
  if (patch === null) {
    delete current[id];
  } else {
    const existing = current[id] ?? { title: '' };
    const nextTitle = typeof patch.title === 'string' ? patch.title.trim() : existing.title;
    if (!nextTitle) {
      delete current[id];
    } else {
      current[id] = { title: nextTitle };
    }
  }
  store.set('sessionNotes', current);
  return getSettings();
}
