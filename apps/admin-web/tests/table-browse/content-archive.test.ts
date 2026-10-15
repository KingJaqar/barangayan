import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentArchiveConfig } from '../../src/lib/admin-tables/archive-sections';
import { parseBrowseState } from '../../src/lib/admin-tables/browse-state';
import type * as Adapter from '../../src/lib/admin-tables/queries/content-archive';

const output = path.resolve('tests/table-browse/.content-archive-test.mjs');
let adapter: typeof Adapter;
beforeAll(async () => {
  await build({ entryPoints: ['src/lib/admin-tables/queries/content-archive.ts'], outfile: output,
    bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'server-test', setup(b) {
      b.onResolve({ filter: /^server-only$|supabase\/server$/ }, () => ({ path: 'boundary', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export function createSupabaseServerClient(){}', loader: 'js' }));
    } }] });
  adapter = await import(pathToFileURL(output).href);
});
afterAll(async () => { await fs.rm(output, { force: true }); });

function fixture(replies: { total?: number; rows?: object[]; status?: number; code?: string }[]) {
  const urls: URL[] = [];
  const db = createClient<Database>('https://fixture.invalid', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async url => {
      urls.push(new URL(String(url)));
      const reply = replies.shift();
      if (!reply) throw new Error('Unexpected request');
      return new Response(JSON.stringify(reply.code ? { code: reply.code, message: 'fixture' } : reply.rows ?? []), {
        status: reply.status ?? 200, headers: { 'content-type': 'application/json', 'content-range': `0-9/${reply.total ?? '*'}` },
      });
    } },
  });
  return { db, urls };
}
const archived = { id: 'fixture', name: 'Service', title: 'Announcement', deleted_at: '2026-10-12T01:00:00Z' };

describe('content archive queries', () => {
  it('loads every new section and waste subtype through tenant-scoped archived reads', async () => {
    for (const [name, kind, table] of [
      ['services', '', 'document_types'], ['announcements', '', 'announcements'], ['hub', '', 'emergency_information'],
      ['evacuation-centers', '', 'evacuation_centers'], ['waste-management', 'zones', 'waste_zones'],
      ['waste-management', 'schedules', 'waste_collection_schedules'], ['waste-management', 'incidents', 'incidents'],
    ] as const) {
      const f = fixture([{ total: 1, rows: [archived] }]);
      const state = parseBrowseState(new URLSearchParams({ kind }), contentArchiveConfig(name));
      expect((await adapter.browseContentArchive(name, state, f.db, 'tenant-a')).status).toBe('success');
      const url = f.urls[0];
      expect(url.pathname).toContain(table);
      expect(url.searchParams.get('barangay_id')).toBe('eq.tenant-a');
      expect(url.searchParams.get('deleted_at')).toBe('not.is.null');
      expect(url.searchParams.get('order')).toBe('deleted_at.desc,id.asc');
      expect(url.searchParams.get('limit')).toBe('10');
      if (kind === 'incidents') {
        expect(url.searchParams.get('incident_categories.is_trash_related')).toBe('eq.true');
        expect(url.searchParams.get('select')).toContain('!inner');
      }
    }
  });
  it('keeps regex characters literal and searches raw text without case sensitivity', async () => {
    const f = fixture([{ total: 0 }]);
    const state = parseBrowseState(new URLSearchParams({ q: '  A.*"  ' }), contentArchiveConfig('services'));
    const result = await adapter.browseContentArchive('services', state, f.db, 'tenant-a');
    expect(result).toMatchObject({ status: 'success', value: { state: { q: 'A.*"' } } });
    const filter = f.urls[0].searchParams.get('or');
    expect(filter).toContain('.imatch.');
    expect(filter).toContain('a\\\\.\\\\*');
  });
  it('corrects an out-of-range page using an exact count and preserves archive scope', async () => {
    const f = fixture([{ status: 416, code: 'PGRST103' }, { total: 1 }, { total: 1, rows: [archived] }]);
    const state = parseBrowseState(new URLSearchParams({ page: '9' }), contentArchiveConfig('services'));
    const result = await adapter.browseContentArchive('services', state, f.db, 'tenant-a');
    expect(result).toMatchObject({ status: 'success', value: { state: { page: 1 }, total: 1 } });
    expect(f.urls).toHaveLength(3);
    expect(f.urls.every(url => url.searchParams.get('deleted_at') === 'not.is.null')).toBe(true);
  });
  it('reports errors and missing counts instead of presenting an empty archive', async () => {
    for (const reply of [{ status: 403, code: '42501' }, { rows: [] }]) {
      const f = fixture([reply]);
      const state = parseBrowseState(new URLSearchParams(), contentArchiveConfig('services'));
      expect((await adapter.browseContentArchive('services', state, f.db, 'tenant-a')).status).toBe('error');
    }
  });
});
