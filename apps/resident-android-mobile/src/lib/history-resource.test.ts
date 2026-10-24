import { describe, expect, it, vi } from 'vitest';
import { HISTORY_PAGE_SIZE, HistoryResource, historyBefore, type HistoryPage } from './history-resource';

type Row = { id: string; created_at: string; status: string };
const row = (n: number): Row => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, created_at: '2026-10-23T00:00:00.123456+00:00', status: 'open' });
function deferred<T>() {
  let resolve: (value: T) => void = () => { throw Error('Not initialized'); };
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

describe('resident history windows', () => {
  it('loads every row beyond the default API cap with deterministic timestamp ties and complete totals', async () => {
    const data = Array.from({ length: 1003 }, (_, i) => row(1003 - i));
    const load = vi.fn(async (_: AbortSignal, after: Row | undefined, count: boolean) => {
      const remaining = data.filter(item => !after || item.id < after.id);
      return { rows: remaining.slice(0, HISTORY_PAGE_SIZE), total: count ? data.length : null };
    });
    const resource = new HistoryResource('A/all', load, 'Retry');
    await resource.refresh();
    expect(resource.getSnapshot().data?.rows).toHaveLength(25);
    expect(resource.getSnapshot().data?.total).toBe(1003);
    while (resource.getSnapshot().data?.hasMore) await resource.loadMore();
    expect(resource.getSnapshot().data?.rows).toEqual(data);
    expect(load).toHaveBeenCalledTimes(41);
    expect(load.mock.calls.filter(call => call[2])).toHaveLength(1);
  });

  it('refreshes the full loaded prefix after inserts/deletes/status changes without dropping scroll data while pending', async () => {
    let data = Array.from({ length: 61 }, (_, i) => row(61 - i));
    const load = async (_: AbortSignal, after: Row | undefined, count: boolean) => {
      const matching = data.filter(item => item.status === 'open');
      return { rows: matching.filter(item => !after || item.id < after.id).slice(0, 25), total: count ? matching.length : null };
    };
    const resource = new HistoryResource('A/open', load, 'Retry');
    await resource.refresh(); await resource.loadMore();
    const previous = resource.getSnapshot().data;
    data = [row(62), ...data.filter(item => item.id !== row(37).id)];
    data[5] = { ...data[5], status: 'resolved' };
    const pending = resource.invalidate();
    expect(resource.getSnapshot().data).toBe(previous);
    await pending;
    expect(resource.getSnapshot().data?.rows).toEqual(data.filter(item => item.status === 'open').slice(0, 50));
    expect(resource.getSnapshot().data?.total).toBe(60);
    await resource.loadMore();
    expect(resource.getSnapshot().data?.rows).toEqual(data.filter(item => item.status === 'open'));
  });

  it('joins repeated initial reads, prevents duplicate page starts and retains rows on page failure/retry', async () => {
    const data = Array.from({ length: 27 }, (_, i) => row(27 - i));
    let fail = false;
    const load = vi.fn(async (_: AbortSignal, after: Row | undefined, count: boolean) => {
      if (fail) throw Error('offline');
      return { rows: data.filter(item => !after || item.id < after.id).slice(0, 25), total: count ? data.length : null };
    });
    const resource = new HistoryResource('A', load, 'Reconnect');
    const first = resource.refresh(); expect(resource.refresh()).toBe(first); await first;
    fail = true;
    const more = resource.loadMore(); void resource.loadMore(); await more;
    expect(load).toHaveBeenCalledTimes(2);
    expect(resource.getSnapshot().data?.rows).toHaveLength(25);
    expect(resource.getSnapshot().error).toBe('Reconnect');
    fail = false; await resource.loadMore();
    expect(resource.getSnapshot().data?.rows).toEqual(data);
    expect(resource.getSnapshot().error).toBeNull();
  });

  it('replaces an in-flight old page on invalidation and rejects late account/filter results', async () => {
    const page = deferred<HistoryPage<Row>>();
    let signal: AbortSignal | undefined;
    const data = Array.from({ length: 26 }, (_, i) => row(26 - i));
    const load = vi.fn(async (abort: AbortSignal, after: Row | undefined) => {
      signal = abort;
      if (after) return page.promise;
      return { rows: data.slice(0, 25), total: 26 };
    });
    const a = new HistoryResource('A', load, 'Retry');
    await a.refresh();
    const more = a.loadMore(); await Promise.resolve();
    const invalidated = a.invalidate();
    expect(signal?.aborted).toBe(true);
    page.resolve({ rows: [row(1)], total: null });
    await more; await invalidated;
    expect(a.getSnapshot().data?.rows).toHaveLength(25);
    expect(load).toHaveBeenCalledTimes(3);
    const late = deferred<HistoryPage<Row>>();
    const old = new HistoryResource<Row>('A/filter', () => late.promise, 'Old failure');
    const read = old.refresh(); await Promise.resolve(); old.cancel();
    const b = new HistoryResource<Row>('B/filter', async () => ({ rows: [], total: 0 }), 'Retry');
    await b.refresh(); late.resolve({ rows: [row(999)], total: 1 }); await read;
    expect(old.getSnapshot().data).toBeUndefined();
    expect(b.getSnapshot().data).toEqual({ rows: [], total: 0, hasMore: false });
  });

  it('fails visibly for missing counts and repeated cursors instead of truncating or looping', async () => {
    const missing = new HistoryResource<Row>('A', async () => ({ rows: [], total: null }), 'Retry');
    await missing.refresh(); expect(missing.getSnapshot().error).toBe('Retry');
    const rows = Array.from({ length: 25 }, (_, i) => row(25 - i));
    const duplicate = new HistoryResource<Row>('A', async () => ({ rows, total: 50 }), 'Retry');
    await duplicate.refresh(); await duplicate.loadMore();
    expect(duplicate.getSnapshot().error).toBe('Retry');
    expect(duplicate.getSnapshot().data?.rows).toEqual(rows);
  });

  it('validates cursor syntax and preserves timestamp precision', () => {
    const cursor = row(1);
    expect(historyBefore('created_at', cursor.created_at, cursor.id)).toContain('.123456+00:00');
    expect(() => historyBefore('updated_at', 'bad),id.gt.0', cursor.id)).toThrow('Invalid history cursor');
    expect(() => historyBefore('created_at', cursor.created_at, 'bad),id.gt.0')).toThrow('Invalid history cursor');
  });
});
