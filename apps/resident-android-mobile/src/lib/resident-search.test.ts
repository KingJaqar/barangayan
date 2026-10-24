import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { normalizeSearchQuery, queryResidentSearch, searchExpression, searchPattern } from './resident-search';

function fixture(options: { fail?: string; rows?: number; reject?: boolean } = {}) {
  const calls: { table: string; operations: [string, ...unknown[]][] }[] = [];
  const client = { from(table: string) {
    const call = { table, operations: [] as [string, ...unknown[]][] }; calls.push(call);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'is', 'or', 'filter', 'eq', 'order', 'range', 'retry', 'abortSignal']) builder[method] = (...args: unknown[]) => { call.operations.push([method, ...args]); return builder; };
    builder.then = (resolve: (value: unknown) => void, reject: (reason: Error) => void) => options.reject ? Promise.reject(new Error('offline')).then(resolve, reject) : Promise.resolve({ error: table === options.fail ? { message: 'forbidden' } : null, data: Array.from({ length: options.rows ?? 1 }, (_, index) => ({ id: String(index), name: 'Clearance', title: 'Clearance', question: 'Clearance', reference_number: 'REF', description: 'body' })) }).then(resolve, reject);
    return builder;
  } } as unknown as SupabaseClient<Database>;
  return { client, calls };
}
const scope = { userId: 'resident-1', barangayId: 'barangay-1' };
const signal = () => new AbortController().signal;

describe('resident Android search boundary', () => {
  it('normalizes and bounds input and avoids empty/punctuation backend calls', async () => {
    expect(normalizeSearchQuery('  a\n b  ')).toBe('a b');
    expect(normalizeSearchQuery('a'.repeat(200))).toHaveLength(120);
    const { client, calls } = fixture();
    expect(await queryResidentSearch(client, scope, '  % _ * , ', signal())).toEqual([]);
    expect(calls).toHaveLength(0);
  });
  it('quotes filter grammar and escapes wildcard input', () => {
    const pattern = searchPattern('a%,)_"\\b');
    expect(pattern.startsWith('"%')).toBe(true); expect(pattern.endsWith('%"')).toBe(true);
    expect(pattern).toContain('\\\\%'); expect(pattern).toContain('\\\\_'); expect(pattern).toContain('\\"');
    expect(searchExpression(['title', 'body'], 'Foo foo bar')).toBe('and(or(title.ilike."%foo%",body.ilike."%foo%"),or(title.ilike."%bar%",body.ilike."%bar%"))');
  });
  it('limits guests to public sources, always excluding deleted and inactive content', async () => {
    const { client, calls } = fixture(); const abort = signal();
    await queryResidentSearch(client, { userId: null, barangayId: null }, 'clearance', abort);
    expect(calls.map(call => call.table)).toEqual(['document_types', 'announcements', 'medical_drives', 'faq_articles']);
    for (const call of calls) {
      expect(call.operations).toContainEqual(['is', 'deleted_at', null]);
      expect(call.operations).toContainEqual(['range', 0, 20]);
      expect(call.operations).toContainEqual(['retry', false]);
      expect(call.operations).toContainEqual(['abortSignal', abort]);
      if (call.table !== 'announcements') expect(call.operations).toContainEqual(['filter', 'is_active', 'eq', true]);
    }
  });
  it('adds explicit tenant and personal ownership filters to the session client', async () => {
    const { client, calls } = fixture(); await queryResidentSearch(client, scope, 'clearance', signal());
    expect(calls).toHaveLength(6);
    for (const call of calls) expect(call.operations).toContainEqual(['eq', 'barangay_id', scope.barangayId]);
    expect(calls.find(call => call.table === 'incidents')?.operations).toContainEqual(['filter', 'reporter_id', 'eq', scope.userId]);
    expect(calls.find(call => call.table === 'service_requests')?.operations).toContainEqual(['filter', 'resident_id', 'eq', scope.userId]);
  });
  it('fails closed for a resident without a tenant', async () => {
    const { client, calls } = fixture();
    await expect(queryResidentSearch(client, { userId: 'resident', barangayId: null }, 'clearance', signal())).rejects.toThrow('profile');
    expect(calls).toHaveLength(0);
  });
  it('caps displayed results and identifies incomplete sources', async () => {
    const { client } = fixture({ rows: 21, fail: 'incidents' });
    const groups = await queryResidentSearch(client, scope, 'clearance', signal());
    expect(groups.find(group => group.category === 'reports')).toMatchObject({ failed: true, results: [] });
    expect(groups[0].more).toBe(true); expect(groups[0].results).toHaveLength(20);
  });
  it('distinguishes network failure from cancellation', async () => {
    const { client } = fixture({ reject: true });
    expect((await queryResidentSearch(client, scope, 'clearance', signal())).every(group => group.failed)).toBe(true);
    const controller = new AbortController(); controller.abort();
    await expect(queryResidentSearch(client, scope, 'clearance', controller.signal)).rejects.toThrow('cancelled');
  });
});
