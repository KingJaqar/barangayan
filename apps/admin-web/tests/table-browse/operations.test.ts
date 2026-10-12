import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as Options from '../../src/lib/admin-tables/queries/operations-options';

const output = path.resolve('tests/table-browse/.operations-test.mjs');
let options: typeof Options;
beforeAll(async () => {
  await build({ entryPoints: ['src/lib/admin-tables/queries/operations-options.ts'], outfile: output,
    bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'server-test', setup(b) {
      b.onResolve({ filter: /^server-only$/ }, () => ({ path: 'boundary', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: '', loader: 'js' }));
    } }] });
  options = await import(pathToFileURL(output).href);
});
afterAll(async () => { await fs.rm(output, { force: true }); });

describe('independent incident/registration action options', () => {
  for (const table of ['incident_categories', 'medical_drives'] as const) it(`loads ${table} beyond the API cap with explicit tenant isolation`, async () => {
    const urls: URL[] = [], ranges: string[] = [];
    const db = createClient<Database>('https://fixture.invalid', 'fixture-key', { auth: { persistSession: false },
      global: { fetch: async (url) => {
        const parsed = new URL(String(url)); urls.push(parsed);
        const start = Number(parsed.searchParams.get('offset')); ranges.push(`${start}:${parsed.searchParams.get('limit')}`);
        return new Response(JSON.stringify(Array.from({ length: Math.min(500, 1001 - start) }, (_, index) => ({ id: String(start + index) }))),
          { headers: { 'content-type': 'application/json' } });
      } } });
    const result = await options.operationsOptions(db, table, 'tenant-A');
    expect(result.status).toBe('success'); if (result.status === 'success') expect(result.value).toHaveLength(1001);
    expect(ranges).toEqual(['0:500', '500:500', '1000:500']);
    for (const url of urls) {
      expect(url.searchParams.get('barangay_id')).toBe('eq.tenant-A');
      expect(url.searchParams.get('order')).toBe(table === 'medical_drives' ? 'title.asc,id.asc' : 'name.asc,id.asc');
      if (table === 'medical_drives') { expect(url.searchParams.get('is_active')).toBe('eq.true'); expect(url.searchParams.get('deleted_at')).toBe('is.null'); }
    }
  });
  it('does not expose the first options batch as complete when the next batch fails', async () => {
    let requests = 0;
    const db = createClient<Database>('https://fixture.invalid', 'fixture-key', { auth: { persistSession: false },
      global: { fetch: async () => ++requests === 1
        ? new Response(JSON.stringify(Array.from({ length: 500 }, (_, i) => ({ id: String(i) }))), { headers: { 'content-type': 'application/json' } })
        : new Response(JSON.stringify({ code: 'XX000', message: 'fault' }), { status: 500, headers: { 'content-type': 'application/json' } }) } });
    expect(await options.operationsOptions(db, 'medical_drives', 'tenant-A')).toMatchObject({ status: 'error', code: 'query-failed' });
    expect(requests).toBe(2);
  });
});
