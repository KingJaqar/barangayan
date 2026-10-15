import { DataError, isCancelled } from './outcome';

const PAGE_SIZE = 25;

export type PageRead<T> = (range: { from: number; to: number }, signal: AbortSignal) => Promise<T[]>;

export type PagedState<T> = {
  items: T[];
  /** `loading`: first page with nothing shown; `refreshing`: reloading while items stay visible. */
  status: 'idle' | 'loading' | 'refreshing' | 'loading-more' | 'ready' | 'error';
  /** The last failure; items from an earlier successful read stay visible and are marked stale. */
  error: unknown;
  stale: boolean;
  complete: boolean;
  /** When the first page was last confirmed by the server. */
  fetchedAt: number | null;
};

function initialState<T>(): PagedState<T> {
  return { items: [], status: 'idle', error: null, stale: false, complete: false, fetchedAt: null };
}

/**
 * Incremental, stable pagination for one list (plan §3, P02-T03). Every read is tagged
 * with a generation; a response from a superseded query, refresh or owner is dropped.
 * Rows are de-duplicated by id so a row shifted across a page boundary by a concurrent
 * insert is shown once; a refresh (realtime signal, foreground, pull) restarts from the
 * first page instead of patching rows in place, so changed or deleted rows reconcile.
 * Callers must order by a unique tie-breaker (for example `created_at desc, id`).
 */
export class PagedList<T extends { id: string }> {
  private state: PagedState<T> = initialState<T>();
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private controller: AbortController | null = null;
  private failedFrom = 0;

  constructor(private read: PageRead<T>, private readonly pageSize = PAGE_SIZE, private readonly now: () => number = Date.now) {}

  getState = (): PagedState<T> => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Replaces the query (new search/filter/owner). Earlier results are discarded immediately. */
  replace(read: PageRead<T>): Promise<void> {
    this.read = read;
    this.set(initialState<T>());
    return this.reload();
  }

  /** Reloads from the first page; visible items stay until the replacement arrives. */
  reload(): Promise<void> {
    return this.fetch(0, this.state.items.length ? 'refreshing' : 'loading');
  }

  /** Appends the next page. Ignored while another read runs or when the list is complete. */
  loadMore(): Promise<void> {
    const { status, complete, items, error } = this.state;
    if (complete || error || status === 'loading' || status === 'refreshing' || status === 'loading-more') return Promise.resolve();
    return this.fetch(items.length, 'loading-more');
  }

  /** Explicit retry after a failure: repeats the read that failed (first page or next page). */
  retry(): Promise<void> {
    if (this.state.status !== 'error') return Promise.resolve();
    return this.failedFrom === 0 ? this.reload() : this.fetch(this.failedFrom, 'loading-more');
  }

  /** Aborts the read in flight and ignores its reply (screen left, account changed). */
  cancel(): void {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
    const { status, items } = this.state;
    if (status === 'loading' || status === 'refreshing' || status === 'loading-more') this.set({ status: items.length ? 'ready' : 'idle' });
  }

  private async fetch(from: number, status: PagedState<T>['status']): Promise<void> {
    const generation = ++this.generation;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.set({ status, error: null });
    try {
      const page = await this.read({ from, to: from + this.pageSize - 1 }, controller.signal);
      if (generation !== this.generation) return;
      if (page.length > this.pageSize) throw new DataError('schema', 'The server returned more rows than requested.');
      const base = from === 0 ? [] : this.state.items;
      const seen = new Set(base.map((item) => item.id));
      const items = base.concat(page.filter((item) => !seen.has(item.id) && seen.add(item.id)));
      this.set({
        items,
        status: 'ready',
        error: null,
        stale: false,
        complete: page.length < this.pageSize,
        fetchedAt: from === 0 ? this.now() : this.state.fetchedAt,
      });
    } catch (error) {
      if (generation !== this.generation || isCancelled(error)) return;
      this.failedFrom = from;
      // Keep confirmed rows visible but labelled stale; never replace them with a false empty list.
      this.set({ status: 'error', error, stale: from === 0 && this.state.items.length > 0 });
    }
  }

  private set(patch: Partial<PagedState<T>>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}

/**
 * Reads every page of a small, bounded public set that must be complete to be cached
 * (emergency content, centers). Exceeding `maxRows` is a contract failure, never a
 * silently truncated list.
 */
export async function readAll<T>(read: PageRead<T>, signal: AbortSignal, maxRows = 1000, pageSize = 100): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    if (signal.aborted) throw new DataError('cancelled');
    const page = await read({ from, to: from + pageSize - 1 }, signal);
    rows.push(...page);
    if (rows.length > maxRows) throw new DataError('schema', 'The server returned more records than this screen supports.');
    if (page.length < pageSize) return rows;
  }
}

/** Distinguishes a true empty list from a filtered/no-results list and from failure states. */
export function listPresentation(state: Pick<PagedState<unknown>, 'items' | 'status' | 'stale' | 'complete'>, filtered: boolean):
  'loading' | 'error' | 'empty' | 'no-results' | 'items' {
  if (state.items.length) return 'items';
  if (state.status === 'idle' || state.status === 'loading' || state.status === 'refreshing') return 'loading';
  if (state.status === 'error') return 'error';
  return filtered ? 'no-results' : 'empty';
}
