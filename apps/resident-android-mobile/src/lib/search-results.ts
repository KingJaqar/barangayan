import { isSearchableQuery, normalizeSearchQuery, SEARCH_DEADLINE_MS, SearchError, type SearchCategory, type SearchFailure, type SearchPage, type SearchResult } from './resident-search';

type CategoryResults = { category: SearchCategory; results: SearchResult[]; pages: number; more: boolean; loading: boolean; failure: SearchFailure | null };
export type SearchResultsState = { query: string; status: 'idle' | 'loading' | 'ready' | 'partial' | 'failed'; categories: CategoryResults[] };
type FetchSearchPage = (category: SearchCategory, offset: number, signal: AbortSignal) => Promise<SearchPage>;

function summarize(query: string, categories: CategoryResults[]): SearchResultsState {
  const failed = categories.filter(entry => entry.failure);
  const status = !categories.length ? 'idle'
    : categories.some(entry => entry.loading) ? 'loading'
    : failed.length ? (failed.length === categories.length && categories.every(entry => !entry.results.length) ? 'failed' : 'partial')
    : categories.some(entry => !entry.pages) ? 'idle' : 'ready';
  return { query, status, categories };
}

/**
 * Result state for one submitted query in one account scope; a new query or scope needs a new
 * instance. One in-flight page per category, a deadline per request, no automatic retries, rows
 * deduplicated by ID, and nothing published after dispose. Pages are offset ranges, so rows
 * inserted or deleted between pages can shift them: deduplication prevents repeats, not gaps.
 */
export function createSearchResults(input: string, categories: readonly SearchCategory[], fetchPage: FetchSearchPage, deadlineMs = SEARCH_DEADLINE_MS) {
  const query = normalizeSearchQuery(input);
  const listeners = new Set<() => void>();
  const inflight = new Map<SearchCategory, { controller: AbortController; timer: ReturnType<typeof setTimeout> }>();
  const offsets = new Map<SearchCategory, number>();
  let disposed = false;
  let state = summarize(query, isSearchableQuery(query)
    ? categories.map(category => ({ category, results: [], pages: 0, more: true, loading: false, failure: null }))
    : []);

  const entry = (category: SearchCategory) => state.categories.find(item => item.category === category);
  const update = (category: SearchCategory, change: Partial<CategoryResults>) => {
    state = summarize(query, state.categories.map(item => item.category === category ? { ...item, ...change } : item));
    for (const listener of listeners) listener();
  };

  /** Starts at most one request; returns whether it did. */
  const request = (category: SearchCategory, retry: boolean) => {
    const current = entry(category);
    if (disposed || !current || current.loading || !current.more || (current.failure && !retry)) return false;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, deadlineMs);
    const owned = () => !disposed && inflight.get(category)?.controller === controller;
    const finish = () => { clearTimeout(timer); inflight.delete(category); };
    inflight.set(category, { controller, timer });
    update(category, { loading: true, failure: null });
    const offset = offsets.get(category) ?? 0;
    fetchPage(category, offset, controller.signal).then(page => {
      if (!owned()) return;
      finish();
      offsets.set(category, offset + page.results.length);
      const before = entry(category);
      if (!before) return;
      const seen = new Set(before.results.map(result => result.id));
      const added: SearchResult[] = [];
      for (const result of page.results) if (!seen.has(result.id)) { seen.add(result.id); added.push(result); }
      update(category, { loading: false, pages: before.pages + 1, more: page.more, results: [...before.results, ...added] });
    }, (error: unknown) => {
      if (!owned()) return;
      finish();
      update(category, { loading: false, failure: timedOut ? 'timeout' : error instanceof SearchError ? error.failure : 'unavailable' });
    });
    return true;
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** First page of every category not yet loaded. */
    start: () => { for (const item of state.categories) if (!item.pages) request(item.category, false); },
    loadMore: (category: SearchCategory) => request(category, false),
    /** Explicit retry of failed work: one category, or every failed one. */
    retry: (category?: SearchCategory) => {
      for (const item of state.categories) if (item.failure && (!category || item.category === category)) request(item.category, true);
    },
    dispose() {
      disposed = true;
      for (const { controller, timer } of inflight.values()) { clearTimeout(timer); controller.abort(); }
      inflight.clear();
      listeners.clear();
    },
  };
}
