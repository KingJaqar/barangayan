import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { queryResidentSearchPage, SEARCH_DEADLINE_MS, searchCategories, SearchError, type SearchCategory, type SearchScope } from './resident-search';
import { createSearchResults } from './search-results';

type Reply = { data?: unknown[] | null; error?: { code?: string; message: string } | null; status?: number } | 'hang' | 'reject';
type Call = { table: string; operations: [string, ...unknown[]][]; signal?: AbortSignal };

/** Fixed ordered dataset behind a PostgREST-shaped builder; `range` selects rows like the real API (inclusive). */
function backend(rows: () => Record<string, unknown>[], reply: (call: Call, index: number) => Reply | Promise<Reply | undefined> | undefined = () => undefined) {
  const calls: Call[] = [];
  const client = { from(table: string) {
    const call: Call = { table, operations: [] }; const index = calls.push(call) - 1;
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'is', 'or', 'filter', 'eq', 'order', 'range', 'retry', 'abortSignal']) builder[method] = (...args: unknown[]) => {
      call.operations.push([method, ...args]); if (method === 'abortSignal') call.signal = args[0] as AbortSignal; return builder;
    };
    builder.then = (resolve: (value: unknown) => void, reject: (reason: Error) => void) => Promise.resolve(reply(call, index)).then(answer => {
      const [, from, to] = call.operations.find(operation => operation[0] === 'range') as [string, number, number];
      // postgrest-js resolves an aborted fetch as a status-0 error rather than rejecting.
      if (answer === 'hang') return new Promise(done => {
        const aborted = () => done({ data: null, error: { message: 'AbortError: aborted', code: '' }, status: 0 });
        if (call.signal?.aborted) aborted(); else call.signal?.addEventListener('abort', aborted);
      });
      if (answer === 'reject') throw new Error('offline');
      return { data: answer?.data !== undefined ? answer.data : rows().slice(from, to + 1), error: answer?.error ?? null, status: answer?.status ?? 200 };
    }).then(resolve, reject);
    return builder;
  } } as unknown as SupabaseClient<Database>;
  return { client, calls };
}
const documents = (count: number, prefix = 'doc') => Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${String(index).padStart(2, '0')}`, name: `Clearance ${index}`, description: 'body' }));
const ids = (count: number) => documents(count).map(row => row.id);
const resident: SearchScope = { userId: 'resident-a', barangayId: 'barangay-a' };
const settle = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
function deferred() { let release = () => {}; const promise = new Promise<undefined>(done => { release = () => done(undefined); }); return { promise, release }; }
function browse(client: SupabaseClient<Database>, options: { input?: string; categories?: SearchCategory[]; scope?: SearchScope; deadline?: number } = {}) {
  const { input = 'clearance', categories = ['documents'], scope = resident, deadline } = options;
  return createSearchResults(input, categories, (category, offset, signal) => queryResidentSearchPage(client, scope, category, input, offset, signal), deadline);
}
const first = (results: ReturnType<typeof browse>) => results.getState().categories[0];

describe('Gate 3A: category pages over a fixed dataset', () => {
  it.each([0, 1, 20, 21, 45])('reaches every ordered ID exactly once for %i matches, then stops', async count => {
    const { client, calls } = backend(() => documents(count));
    const results = browse(client);
    results.start(); await settle();
    for (let step = 0; step < 10 && first(results).more; step++) { expect(results.loadMore('documents')).toBe(true); await settle(); }
    expect(first(results).results.map(result => result.id)).toEqual(ids(count));
    expect(first(results)).toMatchObject({ more: false, loading: false, failure: null, pages: Math.max(1, Math.ceil(count / 20)) });
    expect(results.getState().status).toBe('ready');
    expect(calls).toHaveLength(Math.max(1, Math.ceil(count / 20)));
    calls.forEach((call, page) => {
      expect(call.operations).toContainEqual(['range', page * 20, page * 20 + 20]);
      expect(call.operations).toContainEqual(['retry', false]);
      expect(call.operations).toContainEqual(['order', 'id']);
    });
    expect(results.loadMore('documents')).toBe(false); results.start(); results.retry();
    expect(calls).toHaveLength(Math.max(1, Math.ceil(count / 20)));
  });

  it('runs one in-flight page per category however often Load more is pressed', async () => {
    const hold = deferred();
    const { client, calls } = backend(() => documents(45), (_, index) => index === 1 ? hold.promise : undefined);
    const results = browse(client);
    results.start(); results.start(); await settle();
    expect(calls).toHaveLength(1);
    expect([results.loadMore('documents'), results.loadMore('documents'), results.loadMore('documents')]).toEqual([true, false, false]);
    results.start(); results.retry();
    expect(calls).toHaveLength(2); expect(first(results).loading).toBe(true);
    hold.release(); await settle();
    expect(first(results).results.map(result => result.id)).toEqual(ids(40));
  });

  it('keeps earlier rows when a page fails and continues only on explicit retry', async () => {
    const { client, calls } = backend(() => documents(45), (_, index) => index === 1 ? { error: { message: 'boom' }, status: 500 } : undefined);
    const results = browse(client);
    results.start(); await settle(); results.loadMore('documents'); await settle(); await settle(50);
    expect(first(results)).toMatchObject({ failure: 'unavailable', more: true, loading: false, pages: 1 });
    expect(first(results).results.map(result => result.id)).toEqual(ids(20));
    expect(results.getState().status).toBe('partial');
    expect(calls).toHaveLength(2);
    expect(results.loadMore('documents')).toBe(false);
    results.retry('documents'); expect(calls).toHaveLength(3); await settle();
    expect(calls[2].operations).toContainEqual(['range', 20, 40]);
    results.loadMore('documents'); await settle();
    expect(first(results).results.map(result => result.id)).toEqual(ids(45));
    expect(results.getState().status).toBe('ready');
  });

  it('never repeats an ID when rows shift between pages', async () => {
    let rows = documents(25);
    const { client } = backend(() => rows);
    const results = browse(client);
    results.start(); await settle();
    rows = [{ id: 'doc-new', name: 'Clearance new', description: 'body' }, ...rows];
    results.loadMore('documents'); await settle();
    const shown = first(results).results.map(result => result.id);
    expect(new Set(shown).size).toBe(shown.length);
    expect(shown).toEqual(ids(25));
  });
});

describe('Gate 3B: lifecycle and failures', () => {
  it.each(['', '   ', '?!', ' .,- '])('makes zero requests for unsearchable input %j', async input => {
    const { client, calls } = backend(() => documents(5));
    const results = browse(client, { input, categories: ['documents', 'help'] });
    results.start(); results.loadMore('documents'); results.retry(); await settle();
    expect(results.getState()).toEqual({ query: input.trim(), status: 'idle', categories: [] });
    expect(await queryResidentSearchPage(client, resident, 'documents', input, 0, new AbortController().signal)).toEqual({ results: [], more: false });
    expect(calls).toHaveLength(0);
  });

  it('rejects invalid offsets, ineligible guest sources and tenantless residents before any request', async () => {
    const { client, calls } = backend(() => documents(5));
    const signal = new AbortController().signal;
    await expect(queryResidentSearchPage(client, resident, 'documents', 'clearance', -1, signal)).rejects.toThrow(RangeError);
    await expect(queryResidentSearchPage(client, resident, 'documents', 'clearance', 1.5, signal)).rejects.toThrow(RangeError);
    const guest = { userId: null, barangayId: null };
    expect(searchCategories(guest)).toEqual(['documents', 'announcements', 'health', 'help']);
    expect(searchCategories(resident)).toHaveLength(6);
    await expect(queryResidentSearchPage(client, guest, 'requests', 'clearance', 0, signal)).rejects.toMatchObject({ failure: 'denied' });
    await expect(queryResidentSearchPage(client, { userId: 'resident-a', barangayId: null }, 'documents', 'clearance', 0, signal)).rejects.toThrow('profile');
    const results = browse(client, { scope: { userId: 'resident-a', barangayId: null } });
    results.start(); await settle();
    expect(first(results).failure).toBe('unavailable');
    expect(calls).toHaveLength(0);
  });

  it('ignores replies after dispose and keeps a newer query isolated from a stale one', async () => {
    const hold = deferred();
    const { client, calls } = backend(() => documents(5), (_, index) => index === 0 ? hold.promise : undefined);
    const stale = browse(client);
    let notified = 0;
    stale.subscribe(() => { notified++; });
    stale.start(); const before = stale.getState(); const afterStart = notified;
    stale.dispose();
    expect(calls[0].signal?.aborted).toBe(true);
    const fresh = browse(client, { input: 'permit' });
    fresh.start(); await settle();
    hold.release(); await settle(); await settle(30);
    expect(stale.getState()).toBe(before); expect(notified).toBe(afterStart);
    expect(fresh.getState()).toMatchObject({ query: 'permit', status: 'ready' });
    expect(first(fresh).results).toHaveLength(5);
    expect(calls).toHaveLength(2);
  });

  it('treats cancellation as cancellation, not as an offline failure', async () => {
    const { client } = backend(() => documents(5), () => 'hang');
    const controller = new AbortController();
    const page = queryResidentSearchPage(client, resident, 'documents', 'clearance', 0, controller.signal);
    controller.abort();
    await expect(page).rejects.toThrow('cancelled');
    await expect(page).rejects.not.toBeInstanceOf(SearchError);
  });

  it.each([
    ['denied', { error: { code: '42501', message: 'permission denied' }, status: 403 }],
    ['denied', { error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 }],
    ['offline', { error: { code: '', message: 'TypeError: Network request failed' }, status: 0 }],
    ['unavailable', { error: { code: 'XX000', message: 'internal' }, status: 500 }],
    ['unavailable', 'reject'],
  ] as const)('reports %s without retrying on its own', async (failure, reply) => {
    const { client, calls } = backend(() => documents(5), () => reply);
    const results = browse(client);
    results.start(); await settle(); await settle(50);
    expect(first(results)).toMatchObject({ failure, loading: false, results: [] });
    expect(results.getState().status).toBe('failed');
    expect(calls).toHaveLength(1);
    expect(calls[0].operations).toContainEqual(['retry', false]);
  });

  it('aborts a request at its deadline and reports a timeout once', async () => {
    const { client, calls } = backend(() => documents(5), () => 'hang');
    const results = browse(client, { deadline: 20 });
    results.start(); await settle(60);
    expect(calls[0].signal?.aborted).toBe(true);
    expect(first(results)).toMatchObject({ failure: 'timeout', loading: false });
    expect(calls).toHaveLength(1);
    expect(SEARCH_DEADLINE_MS).toBe(12000);
  });

  it('keeps successful sources on partial failure and retries only the failed ones', async () => {
    let helpUp = false;
    const { client, calls } = backend(() => documents(3).map(row => ({ ...row, question: row.name, answer: 'body' })), call => call.table === 'faq_articles' && !helpUp ? { error: { message: 'down' }, status: 503 } : undefined);
    const results = browse(client, { categories: ['documents', 'help'] });
    results.start(); await settle();
    expect(results.getState().status).toBe('partial');
    expect(results.getState().categories.map(entry => [entry.category, entry.results.length, entry.failure])).toEqual([['documents', 3, null], ['help', 0, 'unavailable']]);
    helpUp = true; results.retry(); expect(calls.map(call => call.table)).toEqual(['document_types', 'faq_articles', 'faq_articles']);
    await settle();
    expect(results.getState().status).toBe('ready');
    expect(results.getState().categories[1].results).toHaveLength(3);
  });

  it('publishes a new immutable snapshot only when state changes', async () => {
    const { client } = backend(() => documents(2));
    const results = browse(client);
    const initial = results.getState();
    expect(results.getState()).toBe(initial);
    let notified = 0; const stop = results.subscribe(() => { notified++; });
    results.start(); await settle();
    expect(notified).toBe(2); expect(initial.categories[0].results).toEqual([]);
    stop(); results.dispose();
  });
});
