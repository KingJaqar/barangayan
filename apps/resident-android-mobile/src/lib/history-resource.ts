import { RefreshResource } from './refresh-resource';

export const HISTORY_PAGE_SIZE = 25;
export interface HistoryPage<T> { rows: T[]; total: number | null; }
interface HistoryWindow<T> { rows: T[]; total: number; hasMore: boolean; }
export type LoadHistoryPage<T> = (signal: AbortSignal, after: T | undefined, count: boolean) => Promise<HistoryPage<T>>;

/** Descending timestamp/UUID cursor. Validate before interpolating PostgREST syntax;
 * retain sub-millisecond timestamp precision rather than rounding through Date. */
export function historyBefore(column: 'created_at' | 'updated_at', timestamp: string, id: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)
    || !Number.isFinite(Date.parse(timestamp))
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Invalid history cursor');
  }
  return `${column}.lt.${timestamp},and(${column}.eq.${timestamp},id.lt.${id})`;
}

/** Reuses the existing cancellation/deadline/invalidations owner. Refresh replaces
 * the loaded prefix atomically; loading older rows appends one bounded page. */
export class HistoryResource<T extends { id: string }> {
  private resource: RefreshResource<HistoryWindow<T>>;
  private append = false;

  constructor(key: string, load: LoadHistoryPage<T>, message: string) {
    this.resource = new RefreshResource(key, async signal => {
      const previous = this.resource.getSnapshot().data;
      const append = this.append && previous !== undefined;
      const target = append ? previous.rows.length + HISTORY_PAGE_SIZE : Math.max(previous?.rows.length ?? 0, HISTORY_PAGE_SIZE);
      const rows = append ? [...previous.rows] : [];
      const seen = new Set(rows.map(row => row.id));
      let total = previous?.total ?? 0;
      let hasMore = true;
      do {
        if (signal.aborted) throw new Error(message);
        const page = await load(signal, rows.at(-1), !append && rows.length === 0);
        if (page.total !== null) {
          if (!Number.isSafeInteger(page.total) || page.total < 0) throw new Error(message);
          total = page.total;
        } else if (!append && rows.length === 0) throw new Error(message);
        for (const row of page.rows) {
          // A repeated cursor/row is an invalid page, not a reason to spin or silently lose rows.
          if (seen.has(row.id)) throw new Error(message);
          seen.add(row.id);
          rows.push(row);
        }
        hasMore = page.rows.length === HISTORY_PAGE_SIZE;
      } while (rows.length < target && hasMore);
      return { rows, total, hasMore };
    }, message);
  }

  getSnapshot = () => this.resource.getSnapshot();
  subscribe = (listener: () => void) => this.resource.subscribe(listener);
  activate = () => this.resource.activate();
  cancel = () => this.resource.cancel();
  refresh = () => {
    const wasAppending = this.append;
    this.append = false;
    return wasAppending && this.resource.getSnapshot().fetching ? this.resource.invalidate() : this.resource.refresh();
  };
  invalidate = () => { this.append = false; return this.resource.invalidate(); };
  loadMore = () => {
    const snapshot = this.resource.getSnapshot();
    if (snapshot.fetching || !snapshot.data?.hasMore) return Promise.resolve();
    this.append = true;
    return this.resource.refresh();
  };
}
