import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-crypto', () => ({ randomUUID: () => '99999999-9999-4999-8999-999999999999' }));
const { residentApi } = await import('../src/data/resident-api');

const TENANT = '22222222-2222-4222-8222-222222222222';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REQUEST = '11111111-1111-4111-8111-111111111111';
const signal = () => new AbortController().signal;

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | 'network-error';
/** Real supabase-js client whose transport is scripted; records every request URL/method. */
function harness(replies: Reply[]) {
  const requests: { url: URL; method: string; body?: string }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: new URL(String(input)), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined });
    const reply = replies.shift() ?? { body: [] };
    if (reply === 'network-error') throw new TypeError('Network request failed');
    return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'content-type': 'application/json', ...reply.headers } });
  };
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  return { api: residentApi(client, TENANT, USER), requests };
}
const document = { id: REQUEST, name: 'Barangay Clearance', description: null, fee_centavos: 5000, processing_target_hours: 24, requirements: ['Valid ID'] };

describe('typed resident adapters against the real query builder (P02-T01/T03)', () => {
  it('selects explicit columns, scopes to the tenant, orders with an id tie-break and reads one page', async () => {
    const { api, requests } = harness([{ body: [document] }]);
    expect(await api.documents('')({ from: 25, to: 49 }, signal())).toEqual([document]);
    const url = requests[0].url;
    expect(url.pathname).toBe('/rest/v1/document_types');
    expect(url.searchParams.get('select')).toBe('id,name,description,fee_centavos,processing_target_hours,requirements');
    expect(url.searchParams.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(url.searchParams.get('deleted_at')).toBe('is.null');
    expect(url.searchParams.get('order')).toBe('name.asc,id.asc');
    expect(url.searchParams.get('offset')).toBe('25');
    expect(url.searchParams.get('limit')).toBe('25');
  });
  it('sends resident search as an escaped, quoted server-side filter', async () => {
    const { api, requests } = harness([{ body: [] }]);
    await api.documents('50%, (cert)')({ from: 0, to: 24 }, signal());
    expect(requests[0].url.searchParams.get('or')).toBe('(name.ilike."%50\\\\%, (cert)%",description.ilike."%50\\\\%, (cert)%")');
  });
  it('matches drive-type labels and ISO dates for drive search', async () => {
    const { api, requests } = harness([{ body: [] }, { body: [] }]);
    await api.drives('dental')({ from: 0, to: 24 }, signal());
    expect(requests[0].url.searchParams.get('or')).toContain('type.in.(dental)');
    await api.drives('2026-11-02')({ from: 0, to: 24 }, signal());
    expect(requests[1].url.searchParams.get('or')).toContain('drive_date.eq.2026-11-02');
  });
  it('scopes private reads to the signed-in owner and tenant', async () => {
    const { api, requests } = harness([{ body: [] }]);
    await api.requests()({ from: 0, to: 24 }, signal());
    const params = requests[0].url.searchParams;
    expect(params.get('resident_id')).toBe(`eq.${USER}`);
    expect(params.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(params.get('order')).toBe('created_at.desc,id.asc');
  });
  it('treats a malformed link as not found without querying', async () => {
    const { api, requests } = harness([]);
    expect(await api.request('../../etc', signal())).toBeNull();
    expect(await api.faqArticle(42, signal())).toBeNull();
    expect(requests).toHaveLength(0);
  });
  it('fails closed on schema drift and on HTTP/authorization errors', async () => {
    const { api } = harness([
      { body: [{ ...document, fee_centavos: '50.00' }] },
      { status: 401, body: { code: 'PGRST301', message: 'JWT expired' } },
      { status: 403, body: { code: '42501', message: 'permission denied for table document_types' } },
    ]);
    await expect(api.documents('')({ from: 0, to: 24 }, signal())).rejects.toMatchObject({ kind: 'schema' });
    await expect(api.documents('')({ from: 0, to: 24 }, signal())).rejects.toMatchObject({ kind: 'session' });
    await expect(api.documents('')({ from: 0, to: 24 }, signal())).rejects.toMatchObject({ kind: 'authorization' });
  });
  it('drops a read whose caller already left the screen', async () => {
    const { api } = harness([{ body: [document] }]);
    const controller = new AbortController();
    const pending = api.documents('')({ from: 0, to: 24 }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeTruthy();
  });
  it('requires real counts for the Reports signals', async () => {
    const counted = (n: number) => ({ status: 200, headers: { 'content-range': `*/${n}` } });
    const { api } = harness([counted(2), counted(1), counted(5), counted(3)]);
    expect(await api.reportCounts(signal())).toEqual({ active: 2, unreadResolved: 1, unreadAnnouncements: 2 });
    const missing = harness([counted(2), { status: 200 }, counted(5), counted(3)]);
    await expect(missing.api.reportCounts(signal())).rejects.toMatchObject({ kind: 'schema' });
  });
});

describe('write reconciliation (P02-T02, F03)', () => {
  it('reconciles a lost cancellation reply instead of reporting failure or retrying', async () => {
    const { api, requests } = harness(['network-error', { body: { status: 'cancelled' } }]);
    await expect(api.cancelRequest(REQUEST)).resolves.toBeUndefined();
    expect(requests.map((request) => request.method)).toEqual(['POST', 'GET']);
  });
  it('reports an unconfirmed cancellation as unknown-commit, never as success', async () => {
    const { api } = harness(['network-error', { body: { status: 'submitted' } }]);
    await expect(api.cancelRequest(REQUEST)).rejects.toMatchObject({ kind: 'unknown-commit' });
  });
  it('keeps a definite rejection definite', async () => {
    const { api } = harness([{ status: 403, body: { code: '42501', message: 'denied' } }, { body: null }]);
    await expect(api.cancelRequest(REQUEST)).rejects.toMatchObject({ kind: 'authorization' });
  });
  it('recovers the committed request after a lost insert reply using the client-generated id', async () => {
    const { api, requests } = harness(['network-error', { body: { id: '99999999-9999-4999-8999-999999999999' } }]);
    expect(await api.createRequest(REQUEST)).toEqual({ id: '99999999-9999-4999-8999-999999999999' });
    expect(JSON.parse(requests[0].body ?? '{}')).toMatchObject({ id: '99999999-9999-4999-8999-999999999999', resident_id: USER, barangay_id: TENANT });
    expect(requests[1].url.searchParams.get('id')).toBe('eq.99999999-9999-4999-8999-999999999999');
  });
  it('marks an announcement read with an idempotent upsert', async () => {
    const { api, requests } = harness([{ status: 201 }]);
    await api.markAnnouncementRead(REQUEST);
    expect(requests[0].url.searchParams.get('on_conflict')).toBe('announcement_id,resident_id');
  });
});
