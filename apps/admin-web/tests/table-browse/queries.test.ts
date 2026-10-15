import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as Adapter from '../../src/lib/admin-tables/queries/browse';

const output = path.resolve('tests/table-browse/.query-test.mjs');
let adapter: typeof Adapter;
beforeAll(async () => {
  await build({ entryPoints: ['src/lib/admin-tables/queries/browse.ts'], outfile: output,
    bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'server-test', setup(b) {
      b.onResolve({ filter: /^server-only$/ }, () => ({ path: 'boundary', namespace: 'stub' }));
      b.onResolve({ filter: /supabase\/server$/ }, () => ({ path: 'session', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: args.path === 'session'
        ? "export function createSupabaseServerClient(){throw new Error('A test session client is required')}" : '', loader: 'js' }));
    } }] });
  adapter = await import(pathToFileURL(output).href);
});
afterAll(async () => { await fs.rm(output, { force: true }); });

function scripted(replies: { total?: number; ids?: string[]; status?: number; code?: string }[], payloadReply?: { total?: number; ids?: string[]; status?: number; code?: string }) {
  let pageReply: (typeof replies)[number] | undefined;
  const urls: URL[] = [];
  const signals: (AbortSignal | null | undefined)[] = [];
  const db = createClient<Database>('https://fixture.invalid', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, options) => {
      urls.push(new URL(String(url))); signals.push(options?.signal);
      const payload = new URL(String(url)).searchParams.has('id');
      const reply = payload ? (payloadReply ?? { ...pageReply, ids: [...(pageReply?.ids ?? [])].reverse() }) : replies.shift();
      if (!payload) pageReply = reply;
      if (!reply) throw new Error('Unexpected extra request');
      return new Response(JSON.stringify(reply.code ? { code: reply.code, message: 'fixture' }
        : (reply.ids ?? []).map(id => ({ id, row: { id } }))), { status: reply.status ?? 200,
        headers: { 'content-type': 'application/json', 'content-range': `0-9/${reply.total ?? '*'}` } });
    } },
  });
  return { db: db as SupabaseClient<Database>, urls, signals };
}
const state = (values: Record<string, string> = {}) => adapter.parseTableState('requests', new URLSearchParams({ tab: 'all', ...values }));

describe('server query contracts', () => {
  it('uses tenant-scoped archive projections with the same bounded query on every screen', async () => {
    for (const name of ['requests', 'transactions', 'residents', 'incidents', 'health', 'applicants', 'households', 'staff'] as const) {
      const f = scripted([{ total: 1, ids: ['fixture'] }]);
      const s = adapter.parseTableState(name, new URLSearchParams({ tab: 'all' }));
      const result = await adapter.browseTable(name, s, f.db, AbortSignal.timeout(1000), new Date(), true);
      expect(result.status).toBe('success');
      expect(f.urls).toHaveLength(2);
      for (const url of f.urls) {
        expect(url.pathname).toContain(`admin_${name}_records`);
        expect(url.searchParams.get('f_archived')).toBe('eq.true');
      }
    }
  });
  it('validates sort, direction, page sizes, tabs and dynamic IDs without losing literal search', () => {
    const s = state({ sort: 'malicious.sql', dir: 'oops', tab: 'oops', pageSize: '11', doc: 'bad', q: '  _%*  ' });
    expect(s).toMatchObject({ sort: 'reference', dir: 'asc', page: 1, pageSize: 10, q: '  _%*  ', filters: { tab: 'active', doc: '' } });
    const id = '30000000-0000-4000-8000-000000000001';
    expect(state({ doc: id }).filters.doc).toBe(id);
    expect(adapter.parseTableState('incidents', new URLSearchParams({ q: '  x  ' })).q).toBe('x');
  });
  it('uses filters and stable global ordering before a bounded inclusive page', async () => {
    const f = scripted([{ total: 23, ids: ['21', '22', '23'] }]);
    const r = await adapter.browseTable('requests', state({ page: '3', tab: 'processing', q: '%,_"\\*' }), f.db);
    expect(r.status).toBe('success');
    expect(r.status === 'success' && r.value.rows.map(row => row.id)).toEqual(['21', '22', '23']);
    expect(f.urls).toHaveLength(2);
    expect(f.urls[0].searchParams.get('order')).toBe('s_reference.asc.nullslast,id.asc');
    expect(f.urls[0].searchParams.get('f_status')).toBe('eq.in_progress');
    expect(f.urls[0].searchParams.get('offset')).toBe('20');
    expect(f.urls[0].searchParams.get('limit')).toBe('10');
    expect(f.urls[0].searchParams.get('or')).toContain('x0.match.');
  });
  it('corrects a removed last page exactly once and uses the same deadline', async () => {
    const f = scripted([{ status: 416, code: 'PGRST103', total: 23 }, { total: 23 }, { total: 23, ids: ['21', '22', '23'] }]);
    const signal = AbortSignal.timeout(1000);
    const r = await adapter.browseTable('requests', state({ page: '99' }), f.db, signal);
    expect(r.status === 'success' && r.value.state.page).toBe(3);
    expect(f.urls).toHaveLength(4); expect(f.signals).toEqual([signal, signal, signal, signal]);
  });
  it('stops when concurrent deletion invalidates the corrective read', async () => {
    const f = scripted([{ status: 416, code: 'PGRST103', total: 23 }, { total: 23 }, { status: 416, code: 'PGRST103', total: 11 }]);
    const r = await adapter.browseTable('requests', state({ page: '99' }), f.db);
    expect(r).toMatchObject({ status: 'error', code: 'results-changed' }); expect(f.urls).toHaveLength(3);
  });
  it('does not turn missing counts, truncated rows, failed or timed-out queries into empty success', async () => {
    for (const reply of [{ ids: [] }, { total: 23, ids: [] }, { status: 503, code: 'failure' }]) {
      const f = scripted([reply]); const r = await adapter.browseTable('requests', state(), f.db);
      expect(r.status).toBe('error'); expect(f.urls).toHaveLength(1);
    }
    const f = scripted([]); const r = await adapter.browseTable('requests', state(), f.db, AbortSignal.abort());
    expect(r.status).toBe('error');
  });
  it('rejects a changed or failed bounded payload without correcting again', async () => {
    for (const reply of [{ ids: ['21'] }, { status: 503, code: 'failure' }]) {
      const f = scripted([{ total: 23, ids: ['21', '22', '23'] }], reply);
      const result = await adapter.browseTable('requests', state({ page: '3' }), f.db);
      expect(result.status).toBe('error'); expect(f.urls).toHaveLength(2);
      expect(f.urls[1].searchParams.get('id')).toBe('in.(21,22,23)');
      expect(f.urls[1].searchParams.get('select')).toBe('id,row');
    }
  });
  it('renders a real empty result as zero and page one', async () => {
    const f = scripted([{ total: 0, ids: [] }]); const r = await adapter.browseTable('requests', state(), f.db);
    expect(r).toMatchObject({ status: 'success', value: { total: 0, rows: [], state: { page: 1 } } });
  });
  it('bounds a stalled request with the supplied deadline', async () => {
    const db = createClient<Database>('https://fixture.invalid', 'fixture-key', {
      auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (_url, options) => new Promise((_resolve, reject) => {
        const signal = options?.signal;
        if (signal?.aborted) reject(new Error('Aborted'));
        else signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
      }) },
    });
    const result = await adapter.browseTable('requests', state(), db, AbortSignal.timeout(10));
    expect(result).toMatchObject({ status: 'error', code: 'query-failed' });
  });
  it('uses Manila calendar days and preserves independent column search boundaries', () => {
    expect(adapter.manilaDay(new Date('2026-10-10T15:59:59Z'))).toBe('2026-10-10');
    expect(adapter.manilaDay(new Date('2026-10-10T16:00:00Z'))).toBe('2026-10-11');
    expect(adapter.literalPattern('%_*\\"')).toContain('%_');
    expect(adapter.literalPattern('*')).toBe('"\\\\*"');
  });
});
