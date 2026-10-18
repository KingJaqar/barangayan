import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pilotConfig, formatAdminTimestamp } from '../../src/lib/admin-tables/pilot-config';
import { parseBrowseState } from '../../src/lib/admin-tables/browse-state';
import type * as Options from '../../src/lib/admin-tables/queries/pilot-options';

const output = path.resolve('tests/table-browse/.pilot-test.mjs');
let options: typeof Options;
beforeAll(async () => {
  await build({ entryPoints: ['src/lib/admin-tables/queries/pilot-options.ts'], outfile: output,
    bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'server-boundary', setup(b) {
      b.onResolve({ filter: /^server-only$/ }, () => ({ path: 'boundary', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: '', loader: 'js' }));
    } }] });
  options = await import(pathToFileURL(output).href);
});
afterAll(async () => { await fs.rm(output, { force: true }); });

describe('pilot integration contracts', () => {
  it('retains explicit defaults and associates only exact displayed columns', () => {
    expect(parseBrowseState(new URLSearchParams(), pilotConfig('requests'))).toMatchObject({ sort: 'reference', dir: 'asc', filters: { tab: 'active' } });
    expect(parseBrowseState(new URLSearchParams(), pilotConfig('transactions'))).toMatchObject({ sort: 'created', dir: 'desc', filters: { tab: 'all' } });
    expect(pilotConfig('transactions').sorts.find(sort => sort.key === 'paid')?.columnId).toBeUndefined();
    expect(pilotConfig('requests').sorts.find(sort => sort.key === 'submitted')?.columnId).toBe('submitted');
  });
  it('accepts a valid retired document UUID and rejects arbitrary filters', () => {
    const doc = '30000000-0000-4000-8000-000000000001';
    expect(parseBrowseState(new URLSearchParams({ doc }), pilotConfig('requests', doc)).filters.doc).toBe(doc);
    expect(parseBrowseState(new URLSearchParams({ doc: 'bad' }), pilotConfig('requests', 'bad')).filters.doc).toBe('');
  });
  it('displays timestamps in Manila even when the test host has another timezone', () => {
    expect(formatAdminTimestamp('2026-01-01T00:00:00Z')).toContain('8:00');
  });
  it('fetches complete restricted tenant options beyond the transport cap', async () => {
    const requests: URL[] = [];
    const rows = Array.from({ length: 1505 }, (_, i) => ({ id: String(i), full_name: 'Resident ' + i }));
    const db = createClient<Database>('https://fixture.invalid', 'fixture-key', { auth: { persistSession: false }, global: {
      fetch: async url => {
        const parsed = new URL(String(url)); requests.push(parsed);
        const offset = Number(parsed.searchParams.get('offset'));
        return new Response(JSON.stringify(rows.slice(offset, offset + 500)), { headers: { 'content-type': 'application/json' } });
      },
    } });
    const result = await options.pilotOptions(db, 'profiles', 'tenant-a', 'resident');
    expect(result.status === 'success' && result.value).toEqual(rows);
    expect(requests).toHaveLength(4);
    requests.forEach(url => {
      expect(url.searchParams.get('select')).toBe('id,full_name');
      expect(url.searchParams.get('barangay_id')).toBe('eq.tenant-a');
      expect(url.searchParams.get('role')).toBe('eq.resident');
      expect(url.searchParams.get('deleted_at')).toBe('is.null');
      expect(url.searchParams.get('limit')).toBe('500');
    });
  });
  it('discards a partial option result when a later batch fails without retrying', async () => {
    let reads = 0;
    const db = createClient<Database>('https://fixture.invalid', 'fixture-key', { auth: { persistSession: false }, global: {
      fetch: async () => {
        reads++;
        return new Response(JSON.stringify(reads === 1 ? Array.from({ length: 500 }, (_, i) => ({ id: String(i) })) : { message: 'failed' }),
          { status: reads === 1 ? 200 : 500, headers: { 'content-type': 'application/json' } });
      },
    } });
    expect(await options.pilotOptions(db, 'document_types', 'tenant-a', undefined, true)).toMatchObject({ status: 'error', code: 'query-failed' });
    expect(reads).toBe(2);
  });
  it('includes resident and admin requesters while retaining tenant and active-profile filters', async () => {
    let requested: URL | undefined;
    const rows = [{ id: 'resident', full_name: 'Resident' }, { id: 'admin', full_name: 'Admin resident' }];
    const db = createClient<Database>('https://fixture.invalid', 'fixture-key', { auth: { persistSession: false }, global: {
      fetch: async url => {
        requested = new URL(String(url));
        return new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } });
      },
    } });
    expect(await options.pilotOptions(db, 'profiles', 'tenant-a', 'requester')).toEqual({ status: 'success', value: rows });
    expect(requested?.searchParams.get('role')).toBe('in.(resident,admin)');
    expect(requested?.searchParams.get('barangay_id')).toBe('eq.tenant-a');
    expect(requested?.searchParams.get('deleted_at')).toBe('is.null');
  });
});
