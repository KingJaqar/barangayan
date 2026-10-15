import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { queryResidentSearch, searchPattern, searchExpression } from '../src/lib/search/query';
import { normalizeSearchQuery, searchFilter, searchHref, searchPreview, searchPage, isSearchResponse, resultRelevance, searchTerms } from '../src/lib/search/types';

function fixture(failedTable?: string, documentFields: Record<string, unknown> = {}) {
  const urls: URL[] = [];
  const client = createClient<Database>('http://127.0.0.1:54321', 'synthetic-anon-key', {
    auth: { persistSession: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input)); urls.push(url);
      if (url.pathname.endsWith(failedTable ?? 'never')) return Response.json({ message: 'Read failed', code: '42501' }, { status: 403 });
      const other = url.searchParams.get('or')?.includes('not.or(');
      const data = other ? [] : [{ id: 'doc-id', name: 'Clearance', description: 'A community document', fee_centavos: 0, processing_target_hours: 24, ...documentFields }];
      const headers = { 'Content-Range': other ? '*/0' : '0-0/1' };
      return init?.method === 'HEAD' ? new Response(null, { headers }) : Response.json(data, { headers });
    } },
  });
  return { client, urls };
}

describe('resident search contract', () => {
  it('normalizes and bounds query input, validates filters, and encodes navigation', () => {
    expect(normalizeSearchQuery('  medical\n drive  ')).toBe('medical drive');
    expect(normalizeSearchQuery('a'.repeat(200))).toHaveLength(120);
    expect(searchFilter('profiles')).toBe('all');
    expect(searchHref('a & b', 'help', 2)).toBe('/search?q=a+%26+b&category=help&page=2');
  });
  it('quotes filter grammar and escapes LIKE wildcards', () => {
    expect(searchPattern('a%,_"b')).toBe('"%a\\\\%,\\\\_\\"b%"');
    expect(searchExpression(['title', 'body'], 'medical drive')).toBe('and(or(title.ilike."%medical%",body.ilike."%medical%"),or(title.ilike."%drive%",body.ilike."%drive%"))');
  });
  it('does not issue data queries for an empty or wildcard-only search', async () => {
    const { client, urls } = fixture();
    for (const query of ['', ' ', '%_*']) expect((await queryResidentSearch(client, { userId: null, barangayId: null }, { query })).groups).toEqual([]);
    expect(urls).toHaveLength(0);
  });
  it('keeps guests out of personal content', async () => {
    const { client, urls } = fixture();
    const result = await queryResidentSearch(client, { userId: null, barangayId: null }, { query: 'Clearance' });
    expect(result.groups.map(g => g.category)).toEqual(['documents', 'announcements', 'health', 'help']);
    expect(urls.some(url => /incidents|service_requests/.test(url.pathname))).toBe(false);
  });
  it('applies tenant and ownership filters, omits archived records and bounds suggestions', async () => {
    const { client, urls } = fixture();
    await queryResidentSearch(client, { userId: 'resident-a', barangayId: 'tenant-a' }, { query: 'Clearance', suggestions: true });
    for (const url of urls) {
      expect(url.searchParams.get('barangay_id')).toBe('eq.tenant-a');
      if (url.searchParams.get('select') === 'id,name') continue;
      expect(url.searchParams.get('deleted_at')).toBe('is.null');
      expect(url.searchParams.get('limit')).toBe('3');
      if (url.pathname.endsWith('incidents')) expect(url.searchParams.get('reporter_id')).toBe('eq.resident-a');
      if (url.pathname.endsWith('service_requests')) {
        expect(url.searchParams.get('resident_id')).toBe('eq.resident-a');
        expect(url.searchParams.get('or')).toContain('document_type_id.in.(doc-id)');
      }
    }
  });
  it('fails closed for authenticated users with unavailable tenant scope', async () => {
    const { client, urls } = fixture();
    await expect(queryResidentSearch(client, { userId: 'resident-a', barangayId: null }, { query: 'Clearance' })).rejects.toThrow('Search profile unavailable');
    expect(urls).toHaveLength(0);
  });
  it('keeps successful results when a category fails', async () => {
    const { client } = fixture('announcements');
    const result = await queryResidentSearch(client, { userId: null, barangayId: null }, { query: 'Clearance' });
    expect(result.groups.find(g => g.category === 'announcements')?.failed).toBe(true);
    expect(result.groups.find(g => g.category === 'documents')?.results[0]).toMatchObject({ title: 'Clearance', href: '/services/doc-id', preview: 'A community document', meta: 'No payment required · Same Day' });
  });
  it('shows current charter pricing and processing guidance instead of a misleading flat fee', async () => {
    const { client } = fixture(undefined, { contract_version: 2, pricing_mode: 'per_page', fee_centavos: 1000, processing_target_minutes: 30 });
    const result = await queryResidentSearch(client, { userId: null, barangayId: null }, { query: 'Clearance', category: 'documents' });
    expect(result.groups[0].results[0].meta).toBe('₱10 per confirmed billable page · assessed by staff · 30 minutes of agency processing');
  });
  it('uses deterministic paging and recovers an out-of-range page', async () => {
    const { client, urls } = fixture();
    const result = await queryResidentSearch(client, { userId: null, barangayId: null }, { query: 'Clearance', category: 'documents', page: 1000 });
    // Counts are resolved before requesting rows, avoiding PostgREST 416 errors.
    expect(urls[0].searchParams.has('offset')).toBe(false);
    expect(urls[2].searchParams.get('offset')).toBe('0');
    expect(result.page).toBe(1);
    expect(urls[0].searchParams.get('order')).toBe('name.asc,id.asc');
  });
  it('returns readable plain-text previews around matching passages', () => {
    const preview = searchPreview('intro '.repeat(30) + '<b>vaccination</b> details ' + 'end '.repeat(70), 'vaccination');
    expect(preview).toContain('vaccination');
    expect(preview).not.toContain('<b>');
    expect(preview.length).toBeLessThanOrEqual(192);
    expect(searchPreview('intro '.repeat(30) + 'vaccination for residents', 'residents vaccination')).toContain('vaccination');
  });
  it('bounds invalid page values and deduplicates search words', () => {
    for (const input of [NaN, Infinity, -Infinity, 'bad', undefined, -20, 0]) expect(searchPage(input)).toBe(1);
    expect(searchPage(12345)).toBe(1000);
    expect(searchPage('2.9')).toBe(2);
    expect(searchTerms('Clearance clearance * %')).toEqual(['clearance']);
  });
  it('orders exact, prefix, phrase and multi-word titles ahead of body-only matches', () => {
    const result = { id: 'id', category: 'documents' as const, preview: '', meta: '', href: '/services/id' };
    const scores = ['Clearance', 'Clearance requirements', 'Request a clearance', 'Other services'].map(title => resultRelevance({ ...result, title }, 'clearance'));
    expect(scores).toEqual([4, 3, 2, 0]);
    expect(resultRelevance({ ...result, title: 'Medical vaccination drive' }, 'drive medical')).toBe(1);
  });
  it('rejects malformed or external result links before rendering them', () => {
    const response = { query: 'Clearance', page: 1, pageSize: 3, isAuthenticated: true, groups: [{ category: 'documents', count: 1, failed: false, results: [{ id: 'id', category: 'documents', title: 'Clearance', preview: '', meta: '', href: '/services/id' }] }] };
    expect(isSearchResponse(response)).toBe(true);
    expect(isSearchResponse({ ...response, groups: null })).toBe(false);
    expect(isSearchResponse({ ...response, page: Infinity })).toBe(false);
    response.groups[0].results[0].href = 'https://unexpected.test';
    expect(isSearchResponse(response)).toBe(false);
  });
});
