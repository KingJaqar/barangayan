import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { describe, expect, it } from 'vitest';

import { residentApi } from '../src/data/resident-api';

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
const document = {
  id: REQUEST, name: 'Barangay Clearance', description: null, fee_centavos: 5000, processing_target_hours: 24, requirements: ['Valid ID'],
  contract_version: 1, service_kind: null, charter: null, purposes: [], requirement_rules: {}, pricing_mode: 'fixed', processing_target_minutes: null,
};

describe('typed resident adapters against the real query builder (P02-T01/T03)', () => {
  it('selects explicit columns, scopes to the tenant, orders with an id tie-break and reads one page', async () => {
    const { api, requests } = harness([{ body: [document] }]);
    expect(await api.documents('')({ from: 25, to: 49 }, signal())).toEqual([document]);
    const url = requests[0].url;
    expect(url.pathname).toBe('/rest/v1/document_types');
    expect(url.searchParams.get('select')).toBe('id,name,description,fee_centavos,processing_target_hours,requirements,contract_version,service_kind,charter,purposes,requirement_rules,pricing_mode,processing_target_minutes');
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
    await api.requests({ group: 'all', sub: 'all' })({ from: 0, to: 24 }, signal());
    const params = requests[0].url.searchParams;
    expect(params.get('resident_id')).toBe(`eq.${USER}`);
    expect(params.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(params.get('order')).toBe('created_at.desc,id.asc');
  });
  it('turns each request filter into a server-side restriction, so paging and counts agree', async () => {
    const { api, requests } = harness([{ body: [] }, { body: [] }, { body: [] }, { body: [] }, { body: [] }, { body: [] }]);
    const page = { from: 0, to: 24 };
    await api.requests({ group: 'active', sub: 'all' })(page, signal());
    await api.requests({ group: 'active', sub: 'pending_payment' })(page, signal());
    await api.requests({ group: 'active', sub: 'paid' })(page, signal());
    await api.requests({ group: 'active', sub: 'processing' })(page, signal());
    await api.requests({ group: 'pickup', sub: 'all' })(page, signal());
    await api.requests({ group: 'history', sub: 'all' })(page, signal());
    const get = (index: number, key: string) => requests[index].url.searchParams.getAll(key);
    expect(get(0, 'status')).toEqual(['in.(submitted,in_progress)']);
    expect(get(1, 'status')).toEqual(['in.(submitted)']);
    expect(get(1, 'payment_status')).toEqual(['not.in.(paid,waived)']);
    expect(get(2, 'payment_status')).toEqual(['in.(paid,waived)']);
    expect(get(3, 'status')).toEqual(['in.(in_progress)']);
    expect(get(4, 'status')).toEqual(['in.(ready_for_pickup)']);
    expect(get(5, 'status')).toEqual(['in.(completed,cancelled)']);
    for (let index = 0; index < 6; index++) expect(get(index, 'resident_id')).toEqual([`eq.${USER}`]);
  });
  it('counts each group on the server with head requests scoped to the owner', async () => {
    const reply = (count: number): Reply => ({ status: 200, body: [], headers: { 'content-range': `*/${count}` } });
    const { api, requests } = harness([reply(9), reply(4), reply(1), reply(4)]);
    expect(await api.requestCounts(signal())).toEqual({ all: 9, active: 4, pickup: 1, history: 4 });
    expect(requests.every((request) => request.method === 'HEAD' && request.url.searchParams.get('resident_id') === `eq.${USER}`)).toBe(true);
  });
  it('reads the latest activity by last update and the own supporting files of a request', async () => {
    const { api, requests } = harness([{ body: [] }, { body: [] }]);
    await api.activity()({ from: 0, to: 24 }, signal());
    expect(requests[0].url.searchParams.get('order')).toBe('updated_at.desc,id.asc');
    await api.requestAttachments(REQUEST, signal());
    expect(requests[1].url.pathname).toBe('/rest/v1/request_attachments');
    expect(requests[1].url.searchParams.get('request_id')).toBe(`eq.${REQUEST}`);
    expect(requests[1].url.searchParams.get('resident_id')).toBe(`eq.${USER}`);
  });
  it('reads the server clock snapshot through the tracking function and fails closed on a malformed one', async () => {
    const snapshot = { request: { timing_model: 'agency_minutes_v1', target_minutes_snapshot: 60, sla_state: 'running', created_at: '2026-10-15T01:00:00Z', accepted_at: '2026-10-15T01:05:00Z', ready_at: null, released_at: null, cancelled_at: null, extra: 'ignored' },
      pauses: [{ started_at: '2026-10-15T01:10:00Z', resumed_at: null, reason: 'Missing form', started_by: 'staff' }], evaluated_at: '2026-10-15T01:20:00.123456Z' };
    const { api, requests } = harness([{ body: snapshot }, { body: { request: null } }, { body: null }]);
    const read = await api.slaTracking(REQUEST, signal());
    expect(requests[0].url.pathname).toBe('/rest/v1/rpc/service_request_sla_tracking');
    expect(JSON.parse(requests[0].body ?? '{}')).toEqual({ p_request_id: REQUEST });
    expect(read.pauses).toEqual([{ started_at: '2026-10-15T01:10:00Z', resumed_at: null, reason: 'Missing form' }]);
    await expect(api.slaTracking(REQUEST, signal())).rejects.toMatchObject({ kind: 'schema' });
    await expect(api.slaTracking(REQUEST, signal())).rejects.toMatchObject({ kind: 'not-found' });
  });
  it('sends the cancellation reason, trimmed, and defaults it when none is given', async () => {
    const { api, requests } = harness([{ body: null }, { body: null }]);
    await api.cancelRequest(REQUEST, '  Changed my mind  ');
    await api.cancelRequest(REQUEST);
    expect(JSON.parse(requests[0].body ?? '{}')).toEqual({ p_request_id: REQUEST, p_note: 'Changed my mind' });
    expect(JSON.parse(requests[1].body ?? '{}')).toEqual({ p_request_id: REQUEST, p_note: 'Cancelled by resident' });
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
  it('has no direct client insert for requests: submission goes through submit_service_request only (P08-T06)', () => {
    const { api } = harness([]);
    expect('createRequest' in api).toBe(false);
  });
  it('reads the approved ID version scoped to the owner and tenant, and never returns an unverified one', async () => {
    const version = { id: REQUEST, version: 3, id_type: 'PhilSys', front_path: `${USER}/versions/${REQUEST}/id-front.jpg`, back_path: null, decision: 'verified', submitted_at: '2026-10-01T00:00:00Z', reviewed_at: '2026-10-02T00:00:00Z', rejection_reason: null };
    const { api, requests } = harness([{ body: version }, { body: { ...version, decision: 'revoked' } }, { body: null }]);
    expect(await api.approvedIdSubmission(REQUEST, signal())).toMatchObject({ id: REQUEST, version: 3 });
    const params = requests[0].url.searchParams;
    expect(requests[0].url.pathname).toBe('/rest/v1/id_submissions');
    expect(params.get('id')).toBe(`eq.${REQUEST}`);
    expect(params.get('resident_id')).toBe(`eq.${USER}`);
    expect(params.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(await api.approvedIdSubmission(REQUEST, signal())).toBeNull();
    expect(await api.approvedIdSubmission(REQUEST, signal())).toBeNull();
  });
  it('marks an announcement read with an idempotent upsert', async () => {
    const { api, requests } = harness([{ status: 201 }]);
    await api.markAnnouncementRead(REQUEST);
    expect(requests[0].url.searchParams.get('on_conflict')).toBe('announcement_id,resident_id');
  });
});
