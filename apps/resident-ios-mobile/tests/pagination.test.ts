import { afterEach, describe, expect, it, vi } from 'vitest';
import { listPresentation, PagedList, readAll, type PageRead } from '../src/data/pagination';
import { createCoalescer, subscribeToChanges } from '../src/data/realtime';
import { DataError } from '../src/data/outcome';

type Row = { id: string; n: number };
const rows = (count: number): Row[] => Array.from({ length: count }, (_, n) => ({ id: `id-${String(n).padStart(4, '0')}`, n }));
/** A fake server page reader over a fixed ordered table, like `.order(...).range(from, to)`. */
const table = (data: Row[], calls: { from: number; to: number }[] = []): PageRead<Row> => async ({ from, to }) => { calls.push({ from, to }); return data.slice(from, to + 1); };
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

describe('incremental stable pagination (P02-T03, F05)', () => {
  it('shows the first page without loading every page, then appends on demand above the row cap', async () => {
    const calls: { from: number; to: number }[] = [];
    const list = new PagedList<Row>(table(rows(60), calls), 25);
    await list.reload();
    expect(list.getState().items).toHaveLength(25);
    expect(calls).toEqual([{ from: 0, to: 24 }]);
    await list.loadMore();
    await list.loadMore();
    expect(list.getState().items.map((row) => row.n)).toEqual(rows(60).map((row) => row.n));
    expect(list.getState().complete).toBe(true);
    await list.loadMore();
    expect(calls).toHaveLength(3);
  });
  it('de-duplicates a row shifted across a page boundary by a concurrent insert', async () => {
    let data = rows(30);
    const list = new PagedList<Row>(async (range, signal) => table(data)(range, signal), 25);
    await list.reload();
    data = [{ id: 'new', n: -1 }, ...data]; // newest-first insert shifts every row down by one
    await list.loadMore();
    const ids = list.getState().items.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(30);
  });
  it('drops a late reply from a superseded query (search changed / account changed)', async () => {
    const slow = deferred<Row[]>();
    const list = new PagedList<Row>(() => slow.promise, 25);
    const first = list.reload();
    const replaced = list.replace(async () => [{ id: 'b', n: 2 }]);
    slow.resolve([{ id: 'a', n: 1 }]);
    await Promise.all([first, replaced]);
    expect(list.getState().items.map((row) => row.id)).toEqual(['b']);
  });
  it('aborts the superseded read', async () => {
    let seen: AbortSignal | undefined;
    const list = new PagedList<Row>((_, signal) => { seen = signal; return new Promise(() => undefined); }, 25);
    void list.reload();
    list.cancel();
    expect(seen?.aborted).toBe(true);
    expect(list.getState().status).toBe('idle');
  });
  it('keeps confirmed rows visible and marks them stale when a refresh fails, never a false empty list', async () => {
    let fail = false;
    const list = new PagedList<Row>(async (range, signal) => { if (fail) throw new DataError('offline'); return table(rows(3))(range, signal); }, 25);
    await list.reload();
    fail = true;
    await list.reload();
    const state = list.getState();
    expect(state.items).toHaveLength(3);
    expect(state.stale).toBe(true);
    expect(listPresentation(state, false)).toBe('items');
    fail = false;
    await list.retry();
    expect(list.getState()).toMatchObject({ stale: false, status: 'ready' });
  });
  it('does not loop on a failed next page; only an explicit retry repeats it', async () => {
    const calls: { from: number; to: number }[] = [];
    let failMore = true;
    const list = new PagedList<Row>(async (range, signal) => { if (range.from > 0 && failMore) { calls.push(range); throw new DataError('offline'); } return table(rows(40))(range, signal); }, 25);
    await list.reload();
    await list.loadMore();
    await list.loadMore();
    expect(calls).toHaveLength(1);
    expect(list.getState()).toMatchObject({ status: 'error', stale: false });
    failMore = false;
    await list.retry();
    expect(list.getState().items).toHaveLength(40);
  });
  it('distinguishes true empty, filtered empty, loading and error presentations', async () => {
    const list = new PagedList<Row>(async () => [], 25);
    expect(listPresentation(list.getState(), false)).toBe('loading');
    await list.reload();
    expect(listPresentation(list.getState(), false)).toBe('empty');
    expect(listPresentation(list.getState(), true)).toBe('no-results');
    await list.replace(async () => { throw new DataError('offline'); });
    expect(listPresentation(list.getState(), false)).toBe('error');
  });
  it('rejects a page larger than requested instead of trusting it', async () => {
    const list = new PagedList<Row>(async () => rows(30), 25);
    await list.reload();
    expect(list.getState().error).toMatchObject({ kind: 'schema' });
  });
  it('reads a bounded public set completely and refuses to truncate it', async () => {
    const signal = new AbortController().signal;
    expect(await readAll(table(rows(250)), signal, 1000, 100)).toHaveLength(250);
    await expect(readAll(table(rows(250)), signal, 200, 100)).rejects.toMatchObject({ kind: 'schema' });
  });
});

describe('realtime refresh signals (P02-T03, B24)', () => {
  afterEach(() => vi.useRealTimers());
  it('coalesces a burst into one refresh and fires nothing after cancel', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const coalescer = createCoalescer(run, 300);
    coalescer.signal(); coalescer.signal(); coalescer.signal();
    vi.advanceTimersByTime(300);
    expect(run).toHaveBeenCalledTimes(1);
    coalescer.signal();
    coalescer.cancel();
    vi.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('uses a unique channel per subscription and removes it on cleanup', () => {
    vi.useFakeTimers();
    const handlers: (() => void)[] = [];
    const channels: { name: string; filters: unknown[] }[] = [];
    const removed: unknown[] = [];
    const client = {
      channel(name: string) {
        const channel = { name, filters: [] as unknown[], on(_: string, filter: unknown, handler: () => void) { channel.filters.push(filter); handlers.push(handler); return channel; }, subscribe() { return channel; } };
        channels.push(channel);
        return channel;
      },
      removeChannel: async (channel: unknown) => { removed.push(channel); return 'ok' as const; },
    };
    const onChange = vi.fn();
    const stopA = subscribeToChanges(client as never, 'requests', [{ table: 'service_requests', filter: 'resident_id=eq.u1' }], onChange);
    const stopB = subscribeToChanges(client as never, 'requests', [{ table: 'service_requests', filter: 'resident_id=eq.u1' }], onChange);
    expect(channels[0].name).not.toBe(channels[1].name);
    expect(channels[0].filters[0]).toMatchObject({ event: '*', schema: 'public', table: 'service_requests', filter: 'resident_id=eq.u1' });
    handlers[0](); handlers[0]();
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledTimes(1);
    stopA();
    handlers[0]();
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(removed).toEqual([channels[0]]);
    stopB();
    expect(removed).toHaveLength(2);
  });
});
