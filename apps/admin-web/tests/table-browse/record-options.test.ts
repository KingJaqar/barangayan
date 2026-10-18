import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as Actions from '../../src/actions/admin-record-actions';

const output = path.resolve('tests/table-browse/.record-options-test.mjs');
let actions: typeof Actions;
const testGlobal = globalThis as typeof globalThis & { recordOptionsSession?: unknown };
beforeAll(async () => {
  await build({ entryPoints: ['src/actions/admin-record-actions.ts'], outfile: output,
    bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'record-session', setup(b) {
      b.onResolve({ filter: /^server-only$|supabase\/server$|admin-audit-actions$/ }, args => ({ path: args.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: args.path.endsWith('supabase/server')
        ? 'export async function createSupabaseServerClient(){return globalThis.recordOptionsSession}'
        : args.path.endsWith('admin-audit-actions') ? 'export async function logAdminAction(){}' : '', loader: 'js' }));
    } }] });
  actions = await import(pathToFileURL(output).href);
});
afterAll(async () => { delete testGlobal.recordOptionsSession; await fs.rm(output, { force: true }); });

describe('record editor resident options', () => {
  it.each(['requests', 'transactions', 'incidents'] as const)('%s uses its permitted profile roles with complete tenant options', async name => {
    const requests: URL[] = [];
    const profiles = Array.from({ length: 1001 }, (_, i) => ({ id: String(i), full_name: 'Resident ' + i }));
    const db = createClient<Database>('https://fixture.invalid', 'fixture-key', { auth: { persistSession: false }, global: {
      fetch: async url => {
        const parsed = new URL(String(url)); requests.push(parsed);
        const table = parsed.pathname.split('/').at(-1);
        const offset = Number(parsed.searchParams.get('offset'));
        return new Response(JSON.stringify(table?.startsWith('admin_') ? { tenant_id: 'tenant-a' }
          : table === 'profiles' ? profiles.slice(offset, offset + 500) : []), { headers: { 'content-type': 'application/json' } });
      },
    } });
    Object.assign(db.auth, { getUser: async () => ({ data: { user: { id: 'active-admin' } }, error: null }) });
    testGlobal.recordOptionsSession = db;
    const result = await actions.loadAdminRecordOptions(name, 'record-id');
    expect(result.error).toBeNull();
    expect(result.options?.residents).toHaveLength(1001);
    const profileRequests = requests.filter(url => url.pathname.endsWith('/profiles'));
    for (const url of profileRequests) {
      expect(url.searchParams.get('barangay_id')).toBe('eq.tenant-a');
      expect(url.searchParams.get('deleted_at')).toBe('is.null');
    }
    const residentRequests = profileRequests.filter(url => url.searchParams.get('role') !== 'eq.admin');
    expect(residentRequests).toHaveLength(3);
    for (const url of residentRequests) expect(url.searchParams.get('role')).toBe(name === 'incidents' ? 'eq.resident' : 'in.(resident,admin)');
    expect(profileRequests.filter(url => url.searchParams.get('role') === 'eq.admin')).toHaveLength(name === 'transactions' ? 3 : 0);
  });
});

describe('request payment mutation boundary', () => {
  it.each(['paid', 'pending', 'failed', 'refunded'])('validates %s and returns the saved row version', async payment_status => {
    const id = '01320000-0000-4000-8000-000000000021';
    const expected = '2026-10-18T00:00:00.000001+00:00';
    const saved = { id, contract_version: 2, payment_method: 'qrph', payment_status, updated_at: '2026-10-18T00:01:00.000001+00:00' };
    let sent: Record<string, unknown> | undefined;
    const db = createClient<Database>('https://fixture.invalid', 'fixture-key', { auth: { persistSession: false }, global: {
      fetch: async (url, options) => {
        const parsed = new URL(String(url));
        let response;
        if (parsed.pathname.includes('/rpc/')) {
          sent = JSON.parse(String(options?.body));
          response = { id, row: saved, payment_audited: true };
        } else if (parsed.pathname.endsWith('/profiles')) response = { role: 'admin', deleted_at: null };
        else response = { row: { id, contract_version: 2, updated_at: expected, reference_number: 'PAY-TEST' } };
        return new Response(JSON.stringify(response), { headers: { 'content-type': 'application/json' } });
      },
    } });
    Object.assign(db.auth, { getUser: async () => ({ data: { user: { id: 'admin' } }, error: null }) });
    testGlobal.recordOptionsSession = db;
    expect(await actions.mutateAdminRecord('requests', id, 'save', expected, { payment_method: 'qrph', payment_status })).toEqual({ error: null, row: saved });
    expect(sent).toMatchObject({ p_screen: 'requests', p_expected: expected, p_patch: { payment_method: 'qrph', payment_status } });
    expect(await actions.mutateAdminRecord('requests', id, 'save', expected, { resident_id: '01320000-0000-4000-8000-000000000004' })).toMatchObject({ error: 'This field cannot be edited here.' });
  });
});
