import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isSearchResponse, literalSearchPattern, makeHit, normalizeQuery, plainPreview, rankedSuggestions, searchFilter, searchPage, searchUrl, valueAt } from '../../src/lib/search/model';
import type * as Search from '../../src/lib/search/server';

const output = path.resolve('tests/search/.server-test.mjs');
let search: typeof Search;
let warningSpy: ReturnType<typeof vi.spyOn>;
beforeAll(async () => {
  warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await build({ entryPoints: ['src/lib/search/server.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external',
    plugins: [{ name: 'server-boundary', setup(builder) {
      builder.onResolve({ filter: /^server-only$/ }, () => ({ path: 'boundary', namespace: 'stub' }));
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: '', loader: 'js' }));
    } }] });
  search = await import(pathToFileURL(output).href);
});
afterAll(async () => { warningSpy.mockRestore(); await fs.rm(output, { force: true }); });

function fixture({ failed = [] as string[], count = 1, missingPayload = false } = {}) {
  const calls: { url: URL; method: string }[] = [];
  const db = createClient<Database>('https://fixture.invalid', 'public-fixture-key', { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      const url = new URL(String(input));
      const table = url.pathname.split('/').pop()!;
      calls.push({ url, method: options?.method ?? 'GET' });
      if (failed.includes(table)) return Response.json({ code: 'XX000', message: 'Internal details must not reach the UI' }, { status: 500 });
      const payload = url.searchParams.has('id');
      const rows = missingPayload && payload ? [] : table === 'profiles' ? [{ role: 'admin', barangay_id: 'tenant-a', deleted_at: null }]
        : [{ id: 'record-a', row: { id: 'record-a', full_name: 'Search Alice', email: 'alice@example.test', id_photo_urls: ['private-url'] },
          title: 'Search title', body: 'Useful text' }];
      return new Response(options?.method === 'HEAD' ? null : JSON.stringify(rows), { headers: { 'content-type': 'application/json', 'content-range': `0-0/${count}` } });
    } } });
  return { db: db as SupabaseClient<Database>, calls };
}
describe('admin search contracts', () => {
  it('normalizes queries and validates untrusted category/page URLs', () => {
    expect(normalizeQuery('  Alice \n Santos  ')).toBe('Alice Santos');
    expect(normalizeQuery('x'.repeat(200))).toHaveLength(120);
    expect(searchFilter('profiles')).toBe('all'); expect(searchPage('-3')).toBe(1);
    expect(searchPage('Infinity')).toBe(1); expect(searchPage('99999')).toBe(1000);
    expect(new URL(searchUrl('A&B', 'residents', 2), 'http://test').searchParams.get('q')).toBe('A&B');
  });
  it('rejects anonymous, resident, and archived admin sessions before searching', async () => {
    const fixtureData = fixture();
    const auth = vi.spyOn(fixtureData.db.auth, 'getUser');
    auth.mockResolvedValue({ data: { user: null }, error: null } as never);
    await expect(search.authorizeSearch(fixtureData.db)).rejects.toMatchObject({ status: 401 });
    expect(fixtureData.calls).toHaveLength(0);
    for (const actor of [{ role: 'resident', deleted_at: null }, { role: 'admin', deleted_at: '2026-10-13' }]) {
      const f = fixture();
      vi.spyOn(f.db.auth, 'getUser').mockResolvedValue({ data: { user: { id: 'actor' } }, error: null } as never);
      const actorRead = { eq: () => actorRead, retry: () => actorRead, abortSignal: () => actorRead,
        maybeSingle: async () => ({ data: { ...actor, barangay_id: 'tenant-a' }, error: null }) };
      vi.spyOn(f.db, 'from').mockReturnValue({ select: () => actorRead } as never);
      await expect(search.authorizeSearch(f.db)).rejects.toMatchObject({ status: 403 });
    }
  });
  it('does no database work for empty or short queries', async () => {
    const f = fixture();
    expect((await search.runSearch(f.db, 'tenant-a', '', 'all', 1)).groups).toEqual([]);
    expect((await search.runSearch(f.db, 'tenant-a', 'a', 'all', 1)).total).toBe(0);
    expect(f.calls).toHaveLength(0);
  });
  it('treats auth network failures as retryable errors instead of expired sessions', async () => {
    const f = fixture();
    vi.spyOn(f.db.auth, 'getUser').mockResolvedValue({ data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 0 } } as never);
    await expect(search.authorizeSearch(f.db)).rejects.toThrow('Could not verify the session');
    expect(f.calls).toHaveLength(0);
  });
  it('fetches suggestions without exact counts and prefers title prefixes with deterministic ordering', async () => {
    const f = fixture();
    const result = await search.runSearch(f.db, 'tenant-a', 'Search', 'all', 1, true);
    expect(result.countsExact).toBe(false);
    for (const { url, method } of f.calls) {
      expect(method).toBe('GET'); expect(url.searchParams.has('id')).toBe(false);
      expect(url.searchParams.get('select')).not.toBe('id');
      expect(['1', '2']).toContain(url.searchParams.get('limit'));
      expect(url.searchParams.get('order')).toContain('id.asc');
    }
    expect(f.calls.some(call => call.url.searchParams.getAll('or').includes('(x0.match."^search")'))).toBe(true);
    expect(literalSearchPattern('A.*', 'prefix')).toBe('"^a\\\\.\\\\*"');
  });
  it('ranks exact and prefix titles ahead of matches in previews', () => {
    const hits = ['A keyword mentioned in body', 'Alice Santos', 'Alice'].map((title, index) => ({ ...makeHit('residents', { id: String(index), full_name: title }), preview: 'Alice' }));
    const result = rankedSuggestions([{ category: 'residents', total: 3, hits, page: 1, unavailable: false }], 'Alice');
    expect(result.map(hit => hit.title)).toEqual(['Alice', 'Alice Santos', 'A keyword mentioned in body']);
  });
  it('rejects malformed transport responses without attempting to render them', () => {
    const base = { query: 'Alice', category: 'all', page: 1, pageSize: 10, groups: [], total: 0, hasMore: false, countsExact: true };
    expect(isSearchResponse(base)).toBe(true);
    expect(isSearchResponse({ ...base, groups: [{ category: 'residents', hits: null }] })).toBe(false);
    expect(isSearchResponse({ ...base, total: Infinity })).toBe(false);
    const group = { category: 'residents', total: 1, page: 1, unavailable: false, hits: [makeHit('residents', { id: 'abc', full_name: 'Alice' })] };
    expect(isSearchResponse({ ...base, groups: [group], total: 1 })).toBe(true);
    expect(isSearchResponse({ ...base, groups: [group, group] })).toBe(false);
    expect(isSearchResponse({ ...base, groups: [{ ...group, hits: [{ ...group.hits[0], href: 'https://external.test' }] }] })).toBe(false);
  });
  it('scopes every read, bounds payloads, and emits only allowlisted previews', async () => {
    const f = fixture();
    const result = await search.runSearch(f.db, 'tenant-a', 'Search', 'all', 1);
    expect(result.groups).toHaveLength(15); expect(result.total).toBe(15);
    for (const { url } of f.calls) {
      expect(url.searchParams.get(url.pathname.includes('admin_') ? 'tenant_id' : 'barangay_id')).toBe('eq.tenant-a');
      if (!url.pathname.includes('admin_')) expect(url.searchParams.get('deleted_at')).toBe('is.null');
      if (!url.searchParams.has('id')) expect(url.searchParams.get('limit')).toBe('3');
    }
    const resident = result.groups[0].hits[0];
    expect(resident.preview).toContain('alice@example.test');
    expect(JSON.stringify(result)).not.toContain('private-url');
    expect(resident.href).toBe('/search/residents/record-a?q=Search');
  });
  it('escapes punctuation and filter syntax while keeping multi-token AND semantics', async () => {
    const f = fixture();
    await search.runSearch(f.db, 'tenant-a', 'A.* ,x0.eq.admin', 'all', 1);
    for (const { url } of f.calls) {
      const filters = url.searchParams.getAll('or');
      expect(filters).toHaveLength(2);
      expect(filters[0]).toContain('a\\\\.\\\\*');
      expect(filters[1]).toContain('",x0\\\\.eq\\\\.admin"');
    }
  });
  it('reports partial failures explicitly and rejects total failures', async () => {
    const partial = fixture({ failed: ['admin_residents_browse'] });
    const result = await search.runSearch(partial.db, 'tenant-a', 'Search', 'all', 1);
    expect(result.groups[0].unavailable).toBe(true); expect(result.total).toBe(14);
    const all = fixture({ failed: ['admin_residents_browse', 'admin_requests_browse', 'admin_incidents_browse', 'admin_transactions_browse',
      'admin_health_browse', 'admin_applicants_browse', 'admin_households_browse', 'admin_staff_browse', 'announcements', 'document_types',
      'emergency_information', 'evacuation_centers', 'faq_articles', 'waste_zones', 'waste_collection_schedules'] });
    await expect(search.runSearch(all.db, 'tenant-a', 'Search', 'all', 1)).rejects.toThrow('temporarily unavailable');
  });
  it('clamps deep pages to the last page and counts other filters without reading rows', async () => {
    const f = fixture({ count: 12 });
    const result = await search.runSearch(f.db, 'tenant-a', 'Search', 'residents', 999);
    expect(result.page).toBe(2); expect(result.hasMore).toBe(false);
    const read = f.calls.find(call => call.url.pathname.endsWith('admin_residents_browse') && call.method !== 'HEAD' && !call.url.searchParams.has('id'))!;
    expect(read.url.searchParams.get('offset')).toBe('10'); expect(read.url.searchParams.get('limit')).toBe('10');
    expect(f.calls.filter(call => !call.url.pathname.endsWith('admin_residents_browse')).every(call => call.method === 'HEAD')).toBe(true);
  });
  it('makes changed or deleted records a recoverable category failure', async () => {
    const f = fixture({ missingPayload: true });
    await expect(search.runSearch(f.db, 'tenant-a', 'Search', 'all', 1)).rejects.toThrow('temporarily unavailable');
  });
  it('builds safe record links and readable text previews', () => {
    const hit = makeHit('announcements', { id: 'record-id', title: 'Community update', body: '<p>Useful **news**</p>' }, 'news');
    expect(hit.preview).toBe('Useful news'); expect(hit.href).toBe('/search/announcements/record-id?q=news');
    expect(makeHit('requests', { id: 'abc', reference_number: 'REQ-10' }).href).toBe('/requests?record=abc');
    expect(makeHit('residents', { id: 'abc', full_name: 'Alice', email_verification_status: 'unavailable' }).meta).toBe('Email unavailable');
    expect(makeHit('services', { id: 'abc', name: 'Document', is_active: false }).meta).toBe('Inactive');
    expect(valueAt({ content: [{ label: 'Hotline', number: '123', hidden: 'private-value' }] }, 'content')).toBe('Hotline — 123');
    expect(plainPreview('alice_santos@example.test **News** [Help](https://example.test)')).toBe('alice_santos@example.test News Help');
    expect(makeHit('announcements', { id: 'abc', title: 'Update', body: 'intro '.repeat(100) + 'Alice arrived' }, 'Alice Santos').preview).toContain('Alice');
  });
});
