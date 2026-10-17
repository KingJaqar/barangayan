import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { describe, expect, it, vi } from 'vitest';
import { incidentStatuses, incidentStatusLabel, resolveView, ANNOUNCEMENT_FILTER_OPTIONS, INCIDENT_FILTER_OPTIONS, GUEST_VIEW_OPTIONS } from '../src/data/report-filters';
import { badgeText, reportsBadgeCount, reportSignals } from '../src/data/report-signals';
import { residentApi } from '../src/data/resident-api';
import { DataError } from '../src/data/outcome';
import { announcementImage, announcementPreview, incidentPhoto } from '../src/features/reports/media';
import { ReadActions, type ReadStateApi } from '../src/features/reports/read-state';

const TENANT = '22222222-2222-4222-8222-222222222222';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const signal = () => new AbortController().signal;
const uuidFor = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | 'network-error';
function harness(replies: Reply[], userId: string | null = USER) {
  const requests: { url: URL; method: string; body?: string }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: new URL(String(input)), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined });
    const reply = replies.shift() ?? { body: [] };
    if (reply === 'network-error') throw new TypeError('Network request failed');
    return new Response(reply.status === 204 ? null : reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'content-type': 'application/json', ...reply.headers } });
  };
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  return { api: residentApi(client, TENANT, userId ?? undefined), requests };
}

describe('Reports views and filters (A32-001…018, A35-009…014, P11-T01)', () => {
  it('reads the view from the iOS segment or the Android tab and falls back to Incidents', () => {
    expect(resolveView('announcements', undefined, true)).toBe('announcements');
    expect(resolveView(undefined, 'announcements', true)).toBe('announcements');
    expect(resolveView(undefined, 'incident-reports', true)).toBe('incidents');
    expect(resolveView(['resolved', 'active'], undefined, true)).toBe('resolved');
    expect(resolveView('segment-that-does-not-exist', undefined, true)).toBe('incidents');
    expect(resolveView(undefined, undefined, true)).toBe('incidents');
    expect(resolveView(7, 7, true)).toBe('incidents');
  });
  it('lets a guest reach only Incidents (sign-in explanation) and Announcements', () => {
    expect(resolveView('active', undefined, false)).toBe('incidents');
    expect(resolveView('resolved', undefined, false)).toBe('incidents');
    expect(resolveView('announcements', undefined, false)).toBe('announcements');
    expect(GUEST_VIEW_OPTIONS.map((option) => option.value)).toEqual(['incidents', 'announcements']);
  });
  it('restricts each own-report view by status: Active is Submitted + In Progress, Resolved is resolved', () => {
    expect(incidentStatuses('active', 'all')).toEqual(['open', 'in_progress']);
    expect(incidentStatuses('resolved', 'all')).toEqual(['resolved']);
    expect(incidentStatuses('incidents', 'all')).toBeNull();
    expect(incidentStatuses('incidents', 'withdrawn')).toEqual(['withdrawn']);
    // A status filter never narrows a view that already fixes its statuses.
    expect(incidentStatuses('active', 'resolved')).toEqual(['open', 'in_progress']);
  });
  it('offers every source status and category filter with resident wording', () => {
    expect(INCIDENT_FILTER_OPTIONS.map((option) => option.label)).toEqual(['All', 'Submitted', 'In Progress', 'Resolved', 'Withdrawn', 'Unresolved']);
    expect(ANNOUNCEMENT_FILTER_OPTIONS.map((option) => option.label)).toEqual(['All', 'General', 'Emergency', 'Health', 'Events']);
    expect(incidentStatusLabel('open')).toBe('Submitted');
    expect(incidentStatusLabel('something-new')).toBe('Unknown');
  });
});

describe('independent counters and the aggregate badge (A36-004…009, P11-T04)', () => {
  const counts = { active: 7, unreadResolved: 2, unreadAnnouncements: 3 };
  it('adds only the two unread counts to the badge and never the active reports', () => {
    expect(reportsBadgeCount(counts)).toBe(5);
    expect(reportsBadgeCount({ ...counts, active: 500 })).toBe(5);
    expect(reportsBadgeCount(null)).toBe(0);
  });
  it('caps the badge text at 99+', () => {
    expect(badgeText(0)).toBe('0');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
  });
  it('keeps the three labeled values separate and null while unavailable', () => {
    expect(reportSignals(counts)).toEqual([
      { key: 'active', label: 'Active reports', value: 7 }, { key: 'unreadResolved', label: 'Unread resolved reports', value: 2 }, { key: 'unreadAnnouncements', label: 'Unread announcements', value: 3 },
    ]);
    expect(reportSignals(null).every((signalItem) => signalItem.value === null)).toBe(true);
  });
});

describe('media locations and previews (P11-T02/T03)', () => {
  it('accepts only plain https announcement images', () => {
    expect(announcementImage('https://cdn.example.org/a.jpg')).toBe('https://cdn.example.org/a.jpg');
    expect(announcementImage('http://cdn.example.org/a.jpg')).toBeNull();
    expect(announcementImage('javascript:alert(1)')).toBeNull();
    expect(announcementImage('https://user:pw@cdn.example.org/a.jpg')).toBeNull();
    expect(announcementImage('data:image/png;base64,AAAA')).toBeNull();
    expect(announcementImage(null)).toBeNull();
  });
  it('shows a report photo only from this project’s incident-photos bucket', () => {
    const project = 'https://example.supabase.co';
    const good = `${project}/storage/v1/object/public/incident-photos/${USER}/1.jpg`;
    expect(incidentPhoto([good], project)).toBe(good);
    expect(incidentPhoto(['https://evil.example.org/storage/v1/object/public/incident-photos/x.jpg', good], project)).toBe(good);
    expect(incidentPhoto([`${project}/storage/v1/object/public/avatars/x.jpg`], project)).toBeNull();
    expect(incidentPhoto([`${project}/storage/v1/object/public/incident-photos/`], project)).toBeNull();
    expect(incidentPhoto([good], 'not a url')).toBeNull();
    expect(incidentPhoto([], project)).toBeNull();
  });
  it('shortens a long body to one line', () => {
    expect(announcementPreview('Short  text\nhere')).toBe('Short text here');
    const long = announcementPreview('word '.repeat(100));
    expect(long.length).toBeLessThanOrEqual(141);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('announcement and own-report reads against the real query builder (P11-T02/T03/T06)', () => {
  const row = { id: uuidFor(1), title: 'Water interruption', category: 'general', published_at: '2026-10-10T01:00:00Z', body: 'Body' };
  it('embeds only the signed-in resident’s own read marker and derives read from it', async () => {
    const { api, requests } = harness([{ body: [{ ...row, announcement_reads: [{ resident_id: USER }] }, { ...row, id: uuidFor(2), announcement_reads: [] }] }]);
    const items = await api.announcements('all')({ from: 0, to: 24 }, signal());
    expect(items.map((item) => item.read)).toEqual([true, false]);
    const params = requests[0].url.searchParams;
    expect(params.get('select')).toBe('id,title,category,published_at,body,announcement_reads(resident_id)');
    expect(params.get('announcement_reads.resident_id')).toBe(`eq.${USER}`);
    expect(params.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(params.get('deleted_at')).toBe('is.null');
    expect(params.get('order')).toBe('published_at.desc,id.asc');
    expect(params.get('category')).toBeNull();
  });
  it('gives a guest no read state and no embed', async () => {
    const { api, requests } = harness([{ body: [row] }], null);
    const [item] = await api.announcements('all')({ from: 0, to: 24 }, signal());
    expect(item.read).toBeNull();
    expect(requests[0].url.searchParams.get('select')).toBe('id,title,category,published_at,body');
  });
  it('filters one category on the server and rejects an unknown one before querying', async () => {
    const { api, requests } = harness([{ body: [] }]);
    await api.announcements('emergency')({ from: 0, to: 24 }, signal());
    expect(requests[0].url.searchParams.get('category')).toBe('eq.emergency');
    await expect(api.announcements('weather' as never)({ from: 0, to: 24 }, signal())).rejects.toBeTruthy();
    expect(requests).toHaveLength(1);
  });
  it('fails closed when a signed-in read arrives without the read embed', async () => {
    const { api } = harness([{ body: [row] }]);
    await expect(api.announcements('all')({ from: 0, to: 24 }, signal())).rejects.toMatchObject({ kind: 'schema' });
  });
  it('removes a read marker idempotently, scoped to the owner', async () => {
    const { api, requests } = harness([{ status: 204 }]);
    await api.markAnnouncementUnread(uuidFor(1));
    expect(requests[0].method).toBe('DELETE');
    expect(requests[0].url.searchParams.get('resident_id')).toBe(`eq.${USER}`);
    expect(requests[0].url.searchParams.get('announcement_id')).toBe(`eq.${uuidFor(1)}`);
  });
  it('reads own reports for a status restriction, scoped to owner and tenant, with an id tie-break', async () => {
    const { api, requests } = harness([{ body: [] }, { body: [] }]);
    await api.incidents(['open', 'in_progress'])({ from: 0, to: 24 }, signal());
    await api.incidents(null)({ from: 0, to: 24 }, signal());
    const first = requests[0].url.searchParams;
    expect(first.get('reporter_id')).toBe(`eq.${USER}`);
    expect(first.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(first.get('status')).toBe('in.(open,in_progress)');
    expect(first.get('order')).toBe('created_at.desc,id.asc');
    expect(requests[1].url.searchParams.get('status')).toBeNull();
  });
  it('treats a zero-row resolved update as a failure, never a success that changed nothing', async () => {
    const { api, requests } = harness([{ body: [{ id: uuidFor(1) }] }, { body: [] }]);
    await api.setIncidentRead(uuidFor(1), true);
    const params = requests[0].url.searchParams;
    expect(params.get('status')).toBe('eq.resolved');
    expect(params.get('reporter_id')).toBe(`eq.${USER}`);
    expect(JSON.parse(requests[0].body ?? '{}').resolved_read_at).toEqual(expect.any(String));
    await expect(api.setIncidentRead(uuidFor(1), false)).rejects.toMatchObject({ kind: 'not-found' });
    expect(JSON.parse(requests[1].body ?? '{}')).toEqual({ resolved_read_at: null });
  });
  it('refuses every write for a guest before any request is sent', async () => {
    const { api, requests } = harness([], null);
    await expect(api.markAnnouncementRead(uuidFor(1))).rejects.toMatchObject({ kind: 'session' });
    await expect(api.markAnnouncementsRead([uuidFor(1)])).rejects.toMatchObject({ kind: 'session' });
    await expect(api.markIncidentsRead([uuidFor(1)])).rejects.toMatchObject({ kind: 'session' });
    await expect(api.setIncidentRead(uuidFor(1), true)).rejects.toMatchObject({ kind: 'session' });
    expect(requests).toHaveLength(0);
  });
});

describe('snapshot-bounded bulk reads (A35-022, A36-003, P11-T05)', () => {
  it('snapshots the unread ids across more than one page', async () => {
    const page = (start: number, count: number, read: boolean) => Array.from({ length: count }, (_, index) => ({ id: uuidFor(start + index), announcement_reads: read ? [{ resident_id: USER }] : [] }));
    const { api, requests } = harness([{ body: page(0, 100, false) }, { body: [...page(100, 20, false), ...page(120, 10, true)] }]);
    const ids = await api.unreadAnnouncementIds(signal());
    expect(ids).toHaveLength(120);
    expect(requests).toHaveLength(2);
    expect(requests[0].url.searchParams.get('announcement_reads.resident_id')).toBe(`eq.${USER}`);
  });
  it('writes the snapshot in chunks of 100 and reports what was stored', async () => {
    const ids = Array.from({ length: 250 }, (_, index) => uuidFor(index + 1));
    const { api, requests } = harness([{ status: 201 }, { status: 201 }, { status: 201 }]);
    expect(await api.markAnnouncementsRead(ids)).toEqual({ requested: 250, done: 250, failure: null });
    expect(requests.map((request) => (JSON.parse(request.body ?? '[]') as unknown[]).length)).toEqual([100, 100, 50]);
  });
  it('stops at the first failed chunk and says how far it got', async () => {
    const ids = Array.from({ length: 250 }, (_, index) => uuidFor(index + 1));
    const { api, requests } = harness([{ status: 201 }, { status: 403, body: { code: '42501', message: 'denied' } }]);
    const result = await api.markAnnouncementsRead(ids);
    expect(result).toMatchObject({ requested: 250, done: 100 });
    expect(result.failure).toBeInstanceOf(DataError);
    expect(requests).toHaveLength(2);
  });
  it('de-duplicates the snapshot and skips resolved reports that changed meanwhile', async () => {
    const { api, requests } = harness([{ body: [{ id: uuidFor(1) }] }]);
    const result = await api.markIncidentsRead([uuidFor(1), uuidFor(1), uuidFor(2)]);
    expect(result).toEqual({ requested: 2, done: 1, failure: null });
    const params = requests[0].url.searchParams;
    expect(params.get('resolved_read_at')).toBe('is.null');
    expect(params.get('status')).toBe('eq.resolved');
    expect(params.get('reporter_id')).toBe(`eq.${USER}`);
    expect(params.get('id')).toBe(`in.(${uuidFor(1)},${uuidFor(2)})`);
  });
});

describe('ReadActions: optimistic changes, rollback, single flight and disposal (P11-T05/T07)', () => {
  function fake(overrides: Partial<ReadStateApi> = {}): ReadStateApi {
    return {
      markAnnouncementRead: vi.fn(async () => undefined), markAnnouncementUnread: vi.fn(async () => undefined), setIncidentRead: vi.fn(async () => undefined),
      unreadAnnouncementIds: vi.fn(async () => []), markAnnouncementsRead: vi.fn(async (ids: readonly string[]) => ({ requested: ids.length, done: ids.length, failure: null })),
      unreadResolvedIncidentIds: vi.fn(async () => []), markIncidentsRead: vi.fn(async (ids: readonly string[]) => ({ requested: ids.length, done: ids.length, failure: null })),
      ...overrides,
    };
  }
  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
  };

  it('shows the change at once, keeps it until the re-read is back, then forgets it', async () => {
    const reread = deferred<void>();
    const actions = new ReadActions(fake(), () => reread.promise);
    const running = actions.setAnnouncementRead('a', true);
    expect(actions.getState().announcements).toEqual({ a: true });
    expect(actions.getState().busy).toBe(true);
    await vi.waitFor(() => expect(actions.getState().message).toBe('Marked as read.'));
    expect(actions.getState().announcements).toEqual({ a: true });
    reread.resolve();
    await running;
    expect(actions.getState().announcements).toEqual({});
  });
  it('rolls the change back and explains a failed write', async () => {
    const api = fake({ markAnnouncementUnread: vi.fn(async () => { throw new DataError('authorization'); }) });
    const settled = vi.fn(async () => undefined);
    const actions = new ReadActions(api, settled);
    await actions.setAnnouncementRead('a', false);
    expect(actions.getState()).toMatchObject({ announcements: {}, busy: false, failed: true });
    expect(actions.getState().message).not.toBe('');
    expect(settled).toHaveBeenCalledTimes(1);
  });
  it('rolls back and re-reads when a lost reply leaves the outcome unknown', async () => {
    const api = fake({ setIncidentRead: vi.fn(async () => { throw new TypeError('Network request failed'); }) });
    const settled = vi.fn(async () => undefined);
    const actions = new ReadActions(api, settled);
    await actions.setIncidentRead('i', true);
    expect(actions.getState().incidents).toEqual({});
    expect(actions.getState().message).toMatch(/may have been saved/);
    expect(settled).toHaveBeenCalledTimes(1);
  });
  it('sends one write for two rapid activations', async () => {
    const gate = deferred<void>();
    const api = fake({ markAnnouncementRead: vi.fn(() => gate.promise) });
    const actions = new ReadActions(api, async () => undefined);
    const first = actions.setAnnouncementRead('a', true);
    await actions.setAnnouncementRead('b', true);
    await actions.markAllAnnouncementsRead();
    expect(api.markAnnouncementRead).toHaveBeenCalledTimes(1);
    expect(api.unreadAnnouncementIds).not.toHaveBeenCalled();
    gate.resolve();
    await first;
  });
  it('marks exactly the snapshot taken at tap time; arrivals afterwards stay untouched', async () => {
    const snapshot = Array.from({ length: 130 }, (_, index) => uuidFor(index + 1));
    const api = fake({ unreadAnnouncementIds: vi.fn(async () => snapshot) });
    const actions = new ReadActions(api, async () => undefined);
    await actions.markAllAnnouncementsRead();
    expect(api.markAnnouncementsRead).toHaveBeenCalledWith(snapshot);
    expect(actions.getState().message).toBe('Marked 130 announcements as read.');
    expect(actions.getState().announcements).toEqual({});
  });
  it('reports nothing to do without writing', async () => {
    const api = fake();
    const actions = new ReadActions(api, async () => undefined);
    await actions.markAllResolvedRead();
    expect(api.markIncidentsRead).not.toHaveBeenCalled();
    expect(actions.getState().message).toBe('No unread resolved reports.');
  });
  it('reports a partial bulk result and drops the optimistic marks for the re-read to decide', async () => {
    const ids = [uuidFor(1), uuidFor(2), uuidFor(3)];
    const seen: Record<string, boolean>[] = [];
    const api = fake({ unreadAnnouncementIds: vi.fn(async () => ids), markAnnouncementsRead: vi.fn(async () => ({ requested: 3, done: 1, failure: new DataError('offline') })) });
    const actions = new ReadActions(api, async () => { seen.push({ ...actions.getState().announcements }); });
    await actions.markAllAnnouncementsRead();
    expect(actions.getState().failed).toBe(true);
    expect(actions.getState().message).toMatch(/^Marked 1 of 3 announcements as read\./);
    expect(seen[0]).toEqual({});
  });
  it('says when resolved reports changed meanwhile and were left alone', async () => {
    const api = fake({ unreadResolvedIncidentIds: vi.fn(async () => [uuidFor(1), uuidFor(2)]), markIncidentsRead: vi.fn(async () => ({ requested: 2, done: 1, failure: null })) });
    const actions = new ReadActions(api, async () => undefined);
    await actions.markAllResolvedRead();
    expect(actions.getState().message).toBe('Marked 1 of 2 resolved reports as read; 1 changed meanwhile and were left as they are.');
    expect(actions.getState().failed).toBe(false);
  });
  it('reports a failed snapshot read without marking anything', async () => {
    const api = fake({ unreadAnnouncementIds: vi.fn(async () => { throw new DataError('offline'); }) });
    const actions = new ReadActions(api, async () => undefined);
    await actions.markAllAnnouncementsRead();
    expect(api.markAnnouncementsRead).not.toHaveBeenCalled();
    expect(actions.getState()).toMatchObject({ failed: true, busy: false });
  });
  it('ignores a late reply and does not refresh after the owner is disposed', async () => {
    const gate = deferred<void>();
    const settled = vi.fn(async () => undefined);
    const actions = new ReadActions(fake({ markAnnouncementRead: vi.fn(() => gate.promise) }), settled);
    const listener = vi.fn();
    actions.subscribe(listener);
    const running = actions.setAnnouncementRead('a', true);
    const before = actions.getState();
    actions.dispose();
    gate.resolve();
    await running;
    expect(actions.getState()).toBe(before);
    expect(settled).not.toHaveBeenCalled();
    await actions.setAnnouncementRead('b', true);
    expect(actions.getState()).toBe(before);
  });
  it('refuses a guest’s write through the real adapter and says why', async () => {
    const { api, requests } = harness([], null);
    const actions = new ReadActions({
      markAnnouncementRead: (id) => api.markAnnouncementRead(id), markAnnouncementUnread: (id) => api.markAnnouncementUnread(id), setIncidentRead: (id, read) => api.setIncidentRead(id, read),
      unreadAnnouncementIds: (abort) => api.unreadAnnouncementIds(abort), markAnnouncementsRead: (ids) => api.markAnnouncementsRead(ids),
      unreadResolvedIncidentIds: (abort) => api.unreadResolvedIncidentIds(abort), markIncidentsRead: (ids) => api.markIncidentsRead(ids),
    }, async () => undefined);
    await actions.setAnnouncementRead(uuidFor(1), true);
    expect(actions.getState()).toMatchObject({ failed: true, announcements: {} });
    expect(requests).toHaveLength(0);
  });
});
