import { normalizeSearchQuery } from './resident-search';

export const SEARCH_HISTORY_LIMIT = 20;
const valid = (value: string) => /[\p{L}\p{N}]/u.test(value);
const identity = (value: string) => value.toLowerCase();

export function cleanHistory(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values.filter((value): value is string => typeof value === 'string')
    .map(normalizeSearchQuery).filter(value => {
      const key = identity(value);
      if (!valid(value) || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, SEARCH_HISTORY_LIMIT);
}

type HistoryStorage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };

/** Serialize reads and edits per account, including edits made before hydration. */
export function createSearchHistoryStore(storage: HistoryStorage) {
  const pending = new Map<string, Promise<unknown>>();
  function run(userId: string, edit?: (history: string[]) => string[]) {
    const key = `resident_search_history_v1:${userId}`;
    const operation = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
      const raw = await storage.getItem(key);
      let parsed: unknown = [];
      try { parsed = raw ? JSON.parse(raw) : []; } catch { /* Discard corrupt history. */ }
      const history = cleanHistory(parsed);
      if (!edit) return history;
      const next = cleanHistory(edit(history));
      await storage.setItem(key, JSON.stringify(next));
      return next;
    });
    pending.set(key, operation);
    const release = () => { if (pending.get(key) === operation) pending.delete(key); };
    void operation.then(release, release);
    return operation;
  }
  return {
    load: (userId: string) => run(userId),
    remember: (userId: string, query: string) => run(userId, history => [query, ...history]),
    remove: (userId: string, query: string) => run(userId, history => history.filter(value => identity(value) !== identity(query))),
    clear: (userId: string) => run(userId, () => []),
  };
}

const STARTERS = ['Barangay clearance', 'Certificate of residency', 'Announcements', 'Medical drives', 'Document requirements', 'Emergency hotlines'];
export function searchSuggestions(query: string, history: string[], titles: string[]) {
  const normalized = identity(normalizeSearchQuery(query));
  const terms = normalized.split(' ').filter(Boolean);
  const seen = new Set<string>();
  return [...history.map(label => ({ label, recent: true })), ...[...titles, ...STARTERS].map(label => ({ label, recent: false }))]
    .map(item => ({ ...item, label: normalizeSearchQuery(item.label) }))
    .filter(item => {
      const key = identity(item.label);
      if (!valid(item.label) || key === normalized || seen.has(key) || !terms.every(term => key.includes(term))) return false;
      seen.add(key);
      return true;
    }).slice(0, 6);
}
