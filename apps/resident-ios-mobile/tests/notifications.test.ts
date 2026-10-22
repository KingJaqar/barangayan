import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { describe, expect, it, vi } from 'vitest';
import { DataError } from '../src/data/outcome';
import { residentApi, type BulkResult, type InboxItem } from '../src/data/resident-api';
import { InboxActions, type InboxApi } from '../src/features/notifications/inbox-actions';
import { destinationHref, inboxDetail, inboxEntry, kindEnabled, kindPresentation, NOTIFICATION_KINDS, openLabel, parseDestination, parsePushData } from '../src/features/notifications/model';
import { PreferenceActions, type PreferenceDeps } from '../src/features/notifications/preference-actions';
import { createSerialQueue, readRecord, registerDevice, releaseDevice, retryPendingRelease, type PermissionState, type PushApi, type PushPort, type RecordStore } from '../src/features/notifications/push-controller';
import { createReplayGuard, resolveTap } from '../src/features/notifications/tap-routing';
import { releaseGates } from '../src/lib/release-gates';

const TENANT = '22222222-2222-4222-8222-222222222222';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const uuidFor = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const TOKEN = 'ExponentPushToken[abc-123]';
const signal = () => new AbortController().signal;

type Reply = { status?: number; body?: unknown } | 'network-error';
function harness(replies: Reply[], userId: string | null = USER) {
  const requests: { url: URL; method: string; body?: string }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: new URL(String(input)), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined });
    const reply = replies.shift() ?? { body: [] };
    if (reply === 'network-error') throw new TypeError('Network request failed');
    return new Response(reply.status === 204 ? null : reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  return { api: residentApi(client, TENANT, userId ?? undefined), requests };
}

const inboxRowFor = (index: number, overrides: Partial<InboxItem> = {}): InboxItem => ({
  id: uuidFor(index), kind: 'request_status', title: 'Request update', body: 'Your document request is complete.',
  destination: { v: 1, kind: 'request', id: uuidFor(900 + index) }, created_at: '2026-10-20T08:00:00Z', read_at: null, ...overrides,
});

describe('release gate (G13)', () => {
  it('keeps remote push closed: only the owner can open it, and no evidence of a device run exists', () => {
    expect(releaseGates.remotePush).toBe(false);
  });
});

describe('destinations (A52-009, P17-T05)', () => {
  const id = uuidFor(7);
  it('accepts exactly {v:1, kind, id} with an allowlisted kind and a UUID', () => {
    expect(parseDestination({ v: 1, kind: 'request', id })).toEqual({ v: 1, kind: 'request', id });
    for (const bad of [null, undefined, 'x', 7, [], {}, { v: 2, kind: 'request', id }, { v: 1, kind: 'url', id }, { v: 1, kind: 'request', id: 'not-a-uuid' },
      { v: 1, kind: 'request', id, url: 'https://evil.example' }, { v: 1, kind: 'request' }, { kind: 'request', id }]) {
      expect(parseDestination(bad)).toBeNull();
    }
  });
  it('maps each kind to its own typed screen and never guesses a record type', () => {
    expect(destinationHref({ v: 1, kind: 'request', id })).toEqual({ pathname: '/request/[id]', params: { id } });
    expect(destinationHref({ v: 1, kind: 'incident', id })).toEqual({ pathname: '/reports/incidents/[incidentId]', params: { incidentId: id } });
    expect(destinationHref({ v: 1, kind: 'announcement', id })).toEqual({ pathname: '/reports/announcements/[announcementId]', params: { announcementId: id } });
    expect(destinationHref({ v: 1, kind: 'drive', id })).toEqual({ pathname: '/health/[id]', params: { id } });
    expect(destinationHref({ v: 1, kind: 'registration', id })).toEqual({ pathname: '/health', params: { segment: 'registrations' } });
    expect(openLabel({ v: 1, kind: 'incident', id })).toBe('Open report');
  });
  it('trusts a push payload only when it is exactly the pointer the sender builds', () => {
    expect(parsePushData({ v: 1, kind: 'payment', id, inbox: uuidFor(8) })).toBeNull();
    expect(parsePushData({ v: 1, kind: 'request', id, inbox: uuidFor(8) })).toEqual({ destination: { v: 1, kind: 'request', id }, inboxId: uuidFor(8) });
    for (const bad of [null, {}, { v: 1, kind: 'request', id }, { v: 1, kind: 'request', id, inbox: 'x' }, { v: 3, kind: 'request', id, inbox: uuidFor(8) }, 'https://example.com']) {
      expect(parsePushData(bad)).toBeNull();
    }
  });
  it('shows an entry with an unknown kind or destination as a plain entry', () => {
    const entry = inboxEntry(inboxRowFor(1, { kind: 'brand_new_kind', destination: { v: 1, kind: 'hologram', id } }));
    expect(entry.destination).toBeNull();
    expect(entry.read).toBe(false);
    expect(kindPresentation('brand_new_kind')).toEqual({ label: 'Notification', icon: 'bell' });
    expect(inboxEntry(inboxRowFor(2, { read_at: '2026-10-20T09:00:00Z' })).read).toBe(true);
  });
  it('treats a kind as on unless the resident turned it off', () => {
    expect(kindEnabled({}, 'payment')).toBe(true);
    expect(kindEnabled({ payment: false }, 'payment')).toBe(false);
    expect(kindEnabled({ payment: false }, 'announcement')).toBe(true);
    expect(NOTIFICATION_KINDS.map((entry) => entry.kind)).toEqual(['request_status', 'payment', 'incident_status', 'announcement', 'medical_drive', 'health_registration']);
  });
  it('words the inbox entry point from its own count', () => {
    expect(inboxDetail(null)).toBe('Updates from your barangay');
    expect(inboxDetail(0)).toBe('No unread notifications');
    expect(inboxDetail(1)).toBe('1 unread notification');
    expect(inboxDetail(12)).toBe('12 unread notifications');
  });
});

describe('notification taps (P17-T05, cold/warm/foreground)', () => {
  const requestId = uuidFor(40);
  const data = { v: 1, kind: 'request', id: requestId, inbox: uuidFor(1) };
  const stored = (destination: unknown = { v: 1, kind: 'request', id: requestId }) => inboxRowFor(1, { destination });
  it('opens the stored destination of the resident\'s own inbox row', async () => {
    const read = vi.fn(async () => stored());
    expect(await resolveTap(data, read, signal())).toEqual({ kind: 'open', href: { pathname: '/request/[id]', params: { id: requestId } }, inboxId: uuidFor(1) });
    expect(read).toHaveBeenCalledWith(uuidFor(1), expect.anything());
  });
  it('lands in the inbox, with a reason, for a malformed payload and reads nothing', async () => {
    const read = vi.fn(async () => stored());
    for (const bad of [null, undefined, {}, 'https://evil.example', { v: 1, kind: 'request', id: requestId }, { ...data, kind: 'url' }, { ...data, inbox: 'x' }]) {
      expect(await resolveTap(bad, read, signal())).toEqual({ kind: 'inbox', reason: 'malformed' });
    }
    expect(read).not.toHaveBeenCalled();
  });
  it('lands in the inbox when the entry is purged or belongs to another account (row-level security returns nothing)', async () => {
    expect(await resolveTap(data, async () => null, signal())).toEqual({ kind: 'inbox', reason: 'unavailable' });
  });
  it('refuses a payload that disagrees with the stored row, or a stored destination this version cannot open', async () => {
    expect(await resolveTap(data, async () => stored({ v: 1, kind: 'request', id: uuidFor(41) }), signal())).toEqual({ kind: 'inbox', reason: 'malformed' });
    expect(await resolveTap(data, async () => stored({ v: 1, kind: 'incident', id: requestId }), signal())).toEqual({ kind: 'inbox', reason: 'malformed' });
    expect(await resolveTap(data, async () => stored({ v: 9, kind: 'request', id: requestId }), signal())).toEqual({ kind: 'inbox', reason: 'malformed' });
    expect(await resolveTap(data, async () => stored('https://evil.example'), signal())).toEqual({ kind: 'inbox', reason: 'malformed' });
  });
  it('lets a read failure through to the caller, which reports the server as unreachable', async () => {
    await expect(resolveTap(data, async () => { throw new DataError('offline'); }, signal())).rejects.toBeInstanceOf(DataError);
  });
  it('handles each response once, remembering a bounded number', () => {
    const guard = createReplayGuard(3);
    expect(guard.handled('a')).toBe(false);
    expect(guard.handled('a')).toBe(true);
    for (const id of ['b', 'c', 'd']) guard.handled(id);
    // 'a' was the oldest and has been forgotten, so a very late replay is the only one that could pass.
    expect(guard.handled('a')).toBe(false);
    expect(guard.handled('d')).toBe(true);
  });
});

function memoryStore(initial: string | null = null) {
  let value = initial;
  const store: RecordStore & { writes: (string | null)[]; failWrites: boolean } = {
    writes: [], failWrites: false,
    read: async () => value,
    write: async (next) => { if (store.failWrites) throw new Error('storage unavailable'); value = next; store.writes.push(next); },
  };
  return store;
}
function port(permission: PermissionState, token: string | null = TOKEN, afterRequest: PermissionState = 'granted'): PushPort & { requested: number } {
  let current = permission;
  const value = {
    requested: 0,
    permission: async () => current,
    requestPermission: async () => { value.requested++; current = afterRequest; return current; },
    token: async () => token,
  };
  return value;
}
function pushApi(overrides: Partial<PushApi> = {}): PushApi & { registered: string[]; released: string[] } {
  const value = {
    registered: [] as string[], released: [] as string[],
    registerPushToken: async (token: string) => { value.registered.push(token); },
    releasePushToken: async (token: string) => { value.released.push(token); },
    ...overrides,
  };
  return value;
}

describe('device registration (A44-003…006, 015…017, P17-T03)', () => {
  it('registers the token of a granted device and remembers whose it is', async () => {
    const api = pushApi(); const store = memoryStore();
    expect(await registerDevice({ port: port('granted'), api, store, userId: USER, enabled: true, askPermission: false })).toEqual({ status: 'registered', token: TOKEN });
    expect(api.registered).toEqual([TOKEN]);
    expect(await readRecord(store)).toEqual({ userId: USER, token: TOKEN, pendingRelease: false });
  });
  it('does nothing, and does not ask the iPhone, while the saved switch is off', async () => {
    const api = pushApi(); const device = port('undetermined');
    expect(await registerDevice({ port: device, api, store: memoryStore(), userId: USER, enabled: false, askPermission: true })).toEqual({ status: 'off' });
    expect(device.requested).toBe(0);
    expect(api.registered).toEqual([]);
  });
  it('asks the iPhone only when explicitly allowed to, and reports the answer', async () => {
    const quiet = port('undetermined');
    expect(await registerDevice({ port: quiet, api: pushApi(), store: memoryStore(), userId: USER, enabled: true, askPermission: false })).toEqual({ status: 'needs-permission' });
    expect(quiet.requested).toBe(0);
    const granted = port('undetermined', TOKEN, 'granted');
    expect((await registerDevice({ port: granted, api: pushApi(), store: memoryStore(), userId: USER, enabled: true, askPermission: true })).status).toBe('registered');
    expect(granted.requested).toBe(1);
    const refused = port('undetermined', TOKEN, 'denied'); const api = pushApi();
    expect(await registerDevice({ port: refused, api, store: memoryStore(), userId: USER, enabled: true, askPermission: true })).toEqual({ status: 'denied' });
    expect(api.registered).toEqual([]);
  });
  it('never prompts again once the iPhone has denied', async () => {
    const denied = port('denied');
    expect(await registerDevice({ port: denied, api: pushApi(), store: memoryStore(), userId: USER, enabled: true, askPermission: true })).toEqual({ status: 'denied' });
    expect(denied.requested).toBe(0);
  });
  it('reports a missing token (simulator, no push project, offline) as unavailable, not as an error', async () => {
    expect(await registerDevice({ port: port('granted', null), api: pushApi(), store: memoryStore(), userId: USER, enabled: true, askPermission: false })).toEqual({ status: 'unavailable' });
    const throwing: PushPort = { ...port('granted'), token: async () => { throw new Error('no project id'); } };
    expect(await registerDevice({ port: throwing, api: pushApi(), store: memoryStore(), userId: USER, enabled: true, askPermission: false })).toEqual({ status: 'unavailable' });
  });
  it('reports a rejected registration and keeps no record of it', async () => {
    const error = new DataError('http');
    const store = memoryStore();
    const result = await registerDevice({ port: port('granted'), api: pushApi({ registerPushToken: async () => { throw error; } }), store, userId: USER, enabled: true, askPermission: false });
    expect(result).toEqual({ status: 'failed', error });
    expect(await readRecord(store)).toBeNull();
  });
  it('ignores a corrupt or foreign record', async () => {
    expect(await readRecord(memoryStore('not json'))).toBeNull();
    expect(await readRecord(memoryStore(JSON.stringify({ userId: 'x', token: TOKEN, pendingRelease: false })))).toBeNull();
    const broken: RecordStore = { read: async () => { throw new Error('keychain'); }, write: async () => undefined };
    expect(await readRecord(broken)).toBeNull();
  });
});

describe('releasing the token: opt-out, logout and the offline retry marker (A44-006, P17-T03)', () => {
  const record = (pendingRelease: boolean, userId = USER) => JSON.stringify({ userId, token: TOKEN, pendingRelease });
  it('removes the token and clears the marker', async () => {
    const api = pushApi(); const store = memoryStore(record(false));
    expect(await releaseDevice({ api, store, userId: USER })).toBe('released');
    expect(api.released).toEqual([TOKEN]);
    expect(await readRecord(store)).toBeNull();
    // The marker was written before the request, so a crash in between would still be retried.
    expect(JSON.parse(store.writes[0] as string).pendingRelease).toBe(true);
  });
  it('keeps the retry marker when the removal cannot be confirmed (offline logout)', async () => {
    const api = pushApi({ releasePushToken: async () => { throw new DataError('offline'); } }); const store = memoryStore(record(false));
    expect(await releaseDevice({ api, store, userId: USER })).toBe('pending');
    expect(await readRecord(store)).toEqual({ userId: USER, token: TOKEN, pendingRelease: true });
  });
  it('completes a pending removal with no session and whoever signed out, because the server needs only the token', async () => {
    const api = pushApi();
    const store = memoryStore(record(true, OTHER));
    expect(await retryPendingRelease({ api, store })).toBe('released');
    expect(api.released).toEqual([TOKEN]);
    expect(await readRecord(store)).toBeNull();
  });
  it('does nothing when no removal is pending', async () => {
    const api = pushApi();
    expect(await retryPendingRelease({ api, store: memoryStore(record(false)) })).toBe('none');
    expect(await retryPendingRelease({ api, store: memoryStore() })).toBe('none');
    expect(api.released).toEqual([]);
  });
  it('keeps the marker, and tries again later, while the server cannot be reached', async () => {
    const store = memoryStore(record(true));
    const api = pushApi({ releasePushToken: async () => { throw new DataError('offline'); } });
    expect(await retryPendingRelease({ api, store })).toBe('pending');
    expect(await readRecord(store)).toEqual({ userId: USER, token: TOKEN, pendingRelease: true });
    const later = pushApi();
    expect(await retryPendingRelease({ api: later, store })).toBe('released');
    expect(await readRecord(store)).toBeNull();
  });
  it('lets a later registration replace the marker, so a token another account took over is not released', async () => {
    const store = memoryStore(record(true, OTHER));
    const api = pushApi();
    await registerDevice({ port: port('granted'), api, store, userId: USER, enabled: true, askPermission: false });
    expect(await retryPendingRelease({ api, store })).toBe('none');
    expect(api.released).toEqual([]);
    expect(await readRecord(store)).toEqual({ userId: USER, token: TOKEN, pendingRelease: false });
  });
  it('falls back to the device token when no record exists, and does nothing when there is none', async () => {
    const api = pushApi();
    expect(await releaseDevice({ api, store: memoryStore(), userId: USER, port: port('granted') })).toBe('released');
    expect(api.released).toEqual([TOKEN]);
    expect(await releaseDevice({ api: pushApi(), store: memoryStore(), userId: USER })).toBe('none');
    expect(await releaseDevice({ api: pushApi(), store: memoryStore(), userId: USER, port: port('granted', null) })).toBe('none');
  });
  it('does not claim another account\'s token as its own record', async () => {
    const api = pushApi();
    expect(await releaseDevice({ api, store: memoryStore(record(false, OTHER)), userId: USER })).toBe('none');
    expect(api.released).toEqual([]);
  });
  it('reports pending when the marker itself cannot be written', async () => {
    const store = memoryStore(record(false)); store.failWrites = true; const api = pushApi();
    expect(await releaseDevice({ api, store, userId: USER })).toBe('pending');
    expect(api.released).toEqual([]);
  });
  it('runs queued operations one after another, even after a failure', async () => {
    const queue = createSerialQueue(); const order: string[] = [];
    const first = queue(async () => { await Promise.resolve(); order.push('first'); throw new Error('boom'); });
    const second = queue(async () => { order.push('second'); return 2; });
    await expect(first).rejects.toThrow('boom');
    expect(await second).toBe(2);
    expect(order).toEqual(['first', 'second']);
  });
});

describe('notification queries and writes (B18)', () => {
  it('reads only the resident\'s own inbox, newest first, with a stable tie-break', async () => {
    const { api, requests } = harness([{ body: [inboxRowFor(1)] }]);
    const rows = await api.inbox()({ from: 0, to: 24 }, signal());
    expect(rows).toHaveLength(1);
    const url = requests[0].url;
    expect(url.pathname).toBe('/rest/v1/notification_inbox');
    expect(url.searchParams.get('select')).toBe('id,kind,title,body,destination,created_at,read_at');
    expect(url.searchParams.get('recipient_id')).toBe(`eq.${USER}`);
    expect(url.searchParams.get('order')).toBe('created_at.desc,id.asc');
    expect(url.searchParams.get('read_at')).toBeNull();
  });
  it('restricts the Unread filter on the server so paging and counts agree', async () => {
    const { api, requests } = harness([{ body: [] }]);
    await api.inbox(true)({ from: 25, to: 49 }, signal());
    expect(requests[0].url.searchParams.get('read_at')).toBe('is.null');
    expect(requests[0].url.searchParams.get('offset')).toBe('25');
  });
  it('needs a signed-in resident', async () => {
    const { api } = harness([{ body: [] }], null);
    await expect(api.inbox()({ from: 0, to: 24 }, signal())).rejects.toMatchObject({ kind: 'session' });
    await expect(api.inboxUnreadCount(signal())).rejects.toMatchObject({ kind: 'session' });
  });
  it('fails an unexpected row shape instead of showing it', async () => {
    const { api } = harness([{ body: [{ id: uuidFor(1), kind: 'payment' }] }]);
    await expect(api.inbox()({ from: 0, to: 24 }, signal())).rejects.toMatchObject({ kind: 'schema' });
  });
  it('keeps a row with an unknown destination so the inbox still lists it', async () => {
    const { api } = harness([{ body: [inboxRowFor(1, { kind: 'future', destination: { v: 7 } })] }]);
    const [row] = await api.inbox()({ from: 0, to: 24 }, signal());
    expect(inboxEntry(row).destination).toBeNull();
  });
  it('reads one own entry, treating a malformed id as absent without a request', async () => {
    const { api, requests } = harness([{ body: inboxRowFor(1) }]);
    expect(await api.inboxItem('not-a-uuid', signal())).toBeNull();
    expect(requests).toHaveLength(0);
    expect((await api.inboxItem(uuidFor(1), signal()))?.id).toBe(uuidFor(1));
    expect(requests[0].url.searchParams.get('recipient_id')).toBe(`eq.${USER}`);
    expect(requests[0].url.searchParams.get('id')).toBe(`eq.${uuidFor(1)}`);
  });
  it('counts unread entries from the server and never turns a missing count into zero', async () => {
    const { api, requests } = harness([{ body: [], status: 200 }]);
    await expect(api.inboxUnreadCount(signal())).rejects.toMatchObject({ kind: 'schema' });
    expect(requests[0].url.searchParams.get('read_at')).toBe('is.null');
    expect(requests[0].url.searchParams.get('recipient_id')).toBe(`eq.${USER}`);
  });
  it('marks one entry read or unread and reports an entry that is gone', async () => {
    const { api, requests } = harness([{ body: [{ id: uuidFor(1) }] }, { body: [{ id: uuidFor(1) }] }, { body: [] }]);
    await api.setInboxRead(uuidFor(1), true);
    expect(JSON.parse(requests[0].body ?? '{}').read_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(requests[0].method).toBe('PATCH');
    expect(requests[0].url.searchParams.get('recipient_id')).toBe(`eq.${USER}`);
    await api.setInboxRead(uuidFor(1), false);
    expect(JSON.parse(requests[1].body ?? '{}').read_at).toBeNull();
    await expect(api.setInboxRead(uuidFor(2), true)).rejects.toMatchObject({ kind: 'not-found' });
    await expect(api.setInboxRead('nope', true)).rejects.toMatchObject({ kind: 'not-found' });
  });
  it('snapshots every unread id across pages and marks them in chunks, skipping entries that changed', async () => {
    const page = Array.from({ length: 100 }, (_, index) => ({ id: uuidFor(index + 1) }));
    const { api, requests } = harness([{ body: page }, { body: [{ id: uuidFor(101) }] }]);
    const ids = await api.unreadInboxIds(signal());
    expect(ids).toHaveLength(101);
    expect(requests[0].url.searchParams.get('read_at')).toBe('is.null');
    const written = harness([{ body: ids.slice(0, 100).map((id) => ({ id })) }, { body: [{ id: ids[100] }] }]);
    const result = await written.api.markInboxRead([...ids, ids[0]]);
    expect(result).toEqual({ requested: 101, done: 101, failure: null });
    expect(written.requests).toHaveLength(2);
    expect(written.requests[0].url.searchParams.get('read_at')).toBe('is.null');
    const skipped = harness([{ body: [{ id: uuidFor(1) }] }]);
    expect(await skipped.api.markInboxRead([uuidFor(1), uuidFor(2)])).toEqual({ requested: 2, done: 1, failure: null });
  });
  it('stops a bulk marking at the first failure and reports how far it got', async () => {
    const ids = Array.from({ length: 150 }, (_, index) => uuidFor(index + 1));
    const { api } = harness([{ body: ids.slice(0, 100).map((id) => ({ id })) }, { status: 500, body: { message: 'boom' } }]);
    const result = await api.markInboxRead(ids);
    expect(result.done).toBe(100);
    expect(result.requested).toBe(150);
    expect(result.failure).not.toBeNull();
  });
  it('reads the saved kinds and treats a missing row as every kind on', async () => {
    const { api, requests } = harness([{ body: { kinds: { payment: false } } }, { body: null, status: 200 }]);
    expect(await api.notificationKinds(signal())).toEqual({ payment: false });
    expect(requests[0].url.pathname).toBe('/rest/v1/notification_preferences');
    expect(requests[0].url.searchParams.get('user_id')).toBe(`eq.${USER}`);
    expect(await api.notificationKinds(signal())).toEqual({});
  });
  it('saves preferences through the RPC and shows the stored answer', async () => {
    const { api, requests } = harness([{ body: [{ push_enabled: false, kinds: { payment: false } }] }, { body: [] }]);
    expect(await api.saveNotificationPreferences({ pushEnabled: false, kinds: { payment: false } })).toEqual({ push_enabled: false, kinds: { payment: false } });
    expect(requests[0].url.pathname).toBe('/rest/v1/rpc/set_notification_preferences');
    expect(JSON.parse(requests[0].body ?? '{}')).toEqual({ p_push_enabled: false, p_kinds: { payment: false } });
    await expect(api.saveNotificationPreferences({ pushEnabled: true })).rejects.toMatchObject({ kind: 'schema' });
  });
  it('registers and releases tokens through the owned RPCs', async () => {
    const { api, requests } = harness([{ status: 204 }, { status: 204 }]);
    await api.registerPushToken(TOKEN);
    await api.releasePushToken(TOKEN);
    expect(requests[0].url.pathname).toBe('/rest/v1/rpc/upsert_push_token');
    expect(JSON.parse(requests[0].body ?? '{}')).toEqual({ p_expo_push_token: TOKEN, p_device_type: 'ios' });
    expect(requests[1].url.pathname).toBe('/rest/v1/rpc/release_push_token');
    expect(JSON.parse(requests[1].body ?? '{}')).toEqual({ p_expo_push_token: TOKEN });
  });
});

describe('inbox read controls (A44, P17-T04)', () => {
  function apiDouble(overrides: Partial<InboxApi> = {}): InboxApi & { calls: string[] } {
    const value = {
      calls: [] as string[],
      setInboxRead: vi.fn(async (id: string, read: boolean) => { value.calls.push(`${read ? 'read' : 'unread'}:${id}`); }),
      unreadInboxIds: vi.fn(async () => [uuidFor(1), uuidFor(2)]),
      markInboxRead: vi.fn(async (ids: readonly string[]): Promise<BulkResult> => ({ requested: ids.length, done: ids.length, failure: null })),
      ...overrides,
    };
    return value;
  }
  it('shows a change at once, keeps it until the list is re-read, then forgets it', async () => {
    const seen: Record<string, boolean>[] = [];
    let actions!: InboxActions;
    const api = apiDouble();
    actions = new InboxActions(api, async () => { seen.push({ ...actions.getState().overrides }); });
    await actions.setRead(uuidFor(1), true);
    expect(seen).toEqual([{ [uuidFor(1)]: true }]);
    expect(actions.getState()).toMatchObject({ overrides: {}, busy: false, failed: false, message: 'Marked as read.' });
  });
  it('puts the old value back, with a message, when the write fails', async () => {
    const api = apiDouble({ setInboxRead: async () => { throw new DataError('offline'); } });
    const actions = new InboxActions(api, async () => undefined);
    await actions.setRead(uuidFor(1), true);
    expect(actions.getState()).toMatchObject({ overrides: {}, failed: true });
    expect(actions.getState().message).toContain('offline');
  });
  it('says the change may have been saved when the reply is lost', async () => {
    const api = apiDouble({ setInboxRead: async () => { throw new DataError('unknown-commit'); } });
    const actions = new InboxActions(api, async () => undefined);
    await actions.setRead(uuidFor(1), false);
    expect(actions.getState().failed).toBe(true);
    expect(actions.getState().message).toContain('may have been saved');
  });
  it('sends one write for two rapid activations', async () => {
    const api = apiDouble();
    const actions = new InboxActions(api, async () => undefined);
    await Promise.all([actions.setRead(uuidFor(1), true), actions.setRead(uuidFor(1), true)]);
    expect(api.setInboxRead).toHaveBeenCalledTimes(1);
  });
  it('marks the entries that were unread when tapped, in one snapshot', async () => {
    const api = apiDouble();
    const actions = new InboxActions(api, async () => undefined);
    await actions.markAllRead();
    expect(api.markInboxRead).toHaveBeenCalledWith([uuidFor(1), uuidFor(2)]);
    expect(actions.getState()).toMatchObject({ failed: false, message: 'Marked 2 notifications as read.' });
  });
  it('says so when nothing is unread, and writes nothing', async () => {
    const api = apiDouble({ unreadInboxIds: async () => [] });
    const actions = new InboxActions(api, async () => undefined);
    await actions.markAllRead();
    expect(api.markInboxRead).not.toHaveBeenCalled();
    expect(actions.getState().message).toBe('No unread notifications.');
  });
  it('reports a partly applied bulk marking and lets only the re-read decide what is read', async () => {
    const api = apiDouble({ markInboxRead: async (ids) => ({ requested: ids.length, done: 1, failure: new DataError('offline') }) });
    const actions = new InboxActions(api, async () => undefined);
    await actions.markAllRead();
    expect(actions.getState()).toMatchObject({ failed: true, overrides: {} });
    expect(actions.getState().message).toContain('Marked 1 of 2 notifications as read.');
  });
  it('writes nothing after it is disposed', async () => {
    const api = apiDouble();
    const actions = new InboxActions(api, async () => undefined);
    actions.dispose();
    await actions.setRead(uuidFor(1), true);
    await actions.markAllRead();
    expect(api.setInboxRead).not.toHaveBeenCalled();
    expect(api.unreadInboxIds).not.toHaveBeenCalled();
  });
});

describe('phone-alert preferences (A44-001…003, 014, 015, 018, P17-T03/T06)', () => {
  function deps(overrides: { permission?: PermissionState; afterRequest?: PermissionState; token?: string | null; save?: PreferenceDeps['api']['saveNotificationPreferences']; record?: string | null } = {}) {
    const device = port(overrides.permission ?? 'undetermined', overrides.token === undefined ? TOKEN : overrides.token, overrides.afterRequest ?? 'granted');
    const api = pushApi();
    const store = memoryStore(overrides.record ?? null);
    const saved = { pushEnabled: true as boolean, kinds: {} as Record<string, boolean> };
    const onSaved = vi.fn(async () => undefined);
    const full: PreferenceDeps = {
      api: {
        ...api,
        registerPushToken: api.registerPushToken, releasePushToken: api.releasePushToken,
        notificationKinds: async () => saved.kinds,
        saveNotificationPreferences: overrides.save ?? (async (change) => {
          if (change.pushEnabled !== undefined) saved.pushEnabled = change.pushEnabled;
          if (change.kinds) Object.assign(saved.kinds, change.kinds);
          return { push_enabled: saved.pushEnabled, kinds: { ...saved.kinds } };
        }),
      },
      port: device, store, userId: USER, onSaved,
    };
    return { full, device, api, store, onSaved };
  }
  it('loads the saved kinds and says the device is waiting for permission', async () => {
    const { full } = deps({ permission: 'undetermined' });
    const actions = new PreferenceActions(full, true);
    await actions.load();
    expect(actions.getState()).toMatchObject({ loaded: true, device: 'needs-permission', permission: 'undetermined', pushEnabled: true });
  });
  it('reports the real device state: registered, not registered yet, blocked, or off', async () => {
    const record = JSON.stringify({ userId: USER, token: TOKEN, pendingRelease: false });
    const registered = new PreferenceActions(deps({ permission: 'granted', record }).full, true); await registered.load();
    expect(registered.getState().device).toBe('registered');
    const missing = new PreferenceActions(deps({ permission: 'granted' }).full, true); await missing.load();
    expect(missing.getState().device).toBe('unavailable');
    const blocked = new PreferenceActions(deps({ permission: 'denied' }).full, true); await blocked.load();
    expect(blocked.getState().device).toBe('denied');
    const off = new PreferenceActions(deps({ permission: 'granted', record }).full, false); await off.load();
    expect(off.getState().device).toBe('off');
    const pending = new PreferenceActions(deps({ permission: 'granted', record: JSON.stringify({ userId: USER, token: TOKEN, pendingRelease: true }) }).full, true); await pending.load();
    expect(pending.getState().device).toBe('unavailable');
  });
  it('reports a failed load and keeps the screen usable', async () => {
    const { full } = deps();
    full.api.notificationKinds = async () => { throw new DataError('offline'); };
    const actions = new PreferenceActions(full, true);
    await actions.load();
    expect(actions.getState()).toMatchObject({ loaded: true, failed: true });
    expect(actions.getState().message).toContain('could not be loaded');
  });
  it('turning alerts on saves, asks the iPhone once and registers the token', async () => {
    const { full, device, api, onSaved } = deps({ permission: 'undetermined' });
    const actions = new PreferenceActions(full, false);
    await actions.setPushEnabled(true);
    expect(device.requested).toBe(1);
    expect(api.registered).toEqual([TOKEN]);
    expect(onSaved).toHaveBeenCalled();
    expect(actions.getState()).toMatchObject({ pushEnabled: true, device: 'registered', failed: false, busy: false, permission: 'granted' });
  });
  it('keeps the saved choice on, and says how to allow notifications, when the iPhone refuses', async () => {
    const { full, api } = deps({ permission: 'undetermined', afterRequest: 'denied' });
    const actions = new PreferenceActions(full, false);
    await actions.setPushEnabled(true);
    expect(actions.getState()).toMatchObject({ pushEnabled: true, device: 'denied', failed: true });
    expect(actions.getState().message).toContain('iPhone Settings');
    expect(api.registered).toEqual([]);
  });
  it('puts the switch back and says it was not saved when the server refuses', async () => {
    const { full, device } = deps({ save: async () => { throw new DataError('http'); } });
    const actions = new PreferenceActions(full, false);
    await actions.setPushEnabled(true);
    expect(actions.getState()).toMatchObject({ pushEnabled: false, failed: true, busy: false });
    expect(actions.getState().message).toContain('was not saved');
    expect(device.requested).toBe(0);
  });
  it('re-reads what is stored when the reply to a save is lost', async () => {
    let calls = 0;
    const { full } = deps({ save: async () => { calls++; throw new DataError('unknown-commit'); } });
    const reads = vi.spyOn(full.api, 'notificationKinds');
    const actions = new PreferenceActions(full, false);
    await actions.setPushEnabled(true);
    expect(calls).toBe(1);
    expect(reads).toHaveBeenCalled();
    expect(actions.getState().message).toContain('may have been saved');
  });
  it('turning alerts off saves first, then removes this iPhone\'s token', async () => {
    const record = JSON.stringify({ userId: USER, token: TOKEN, pendingRelease: false });
    const { full, api, store } = deps({ permission: 'granted', record });
    const actions = new PreferenceActions(full, true);
    await actions.setPushEnabled(false);
    expect(api.released).toEqual([TOKEN]);
    expect(await readRecord(store)).toBeNull();
    expect(actions.getState()).toMatchObject({ pushEnabled: false, device: 'off', failed: false });
  });
  it('says alerts have stopped even when the token removal has to wait', async () => {
    const record = JSON.stringify({ userId: USER, token: TOKEN, pendingRelease: false });
    const { full, api, store } = deps({ permission: 'granted', record });
    api.releasePushToken = async () => { throw new DataError('offline'); };
    full.api.releasePushToken = api.releasePushToken;
    const actions = new PreferenceActions(full, true);
    await actions.setPushEnabled(false);
    expect(actions.getState().message).toContain('alerts have already stopped');
    expect((await readRecord(store))?.pendingRelease).toBe(true);
  });
  it('saves one kind at a time, shows it at once and puts it back if it was not kept', async () => {
    const ok = deps({ permission: 'granted' });
    const actions = new PreferenceActions(ok.full, true);
    await actions.setKind('payment', false);
    expect(actions.getState().kinds).toEqual({ payment: false });
    expect(actions.getState()).toMatchObject({ failed: false, message: 'Saved.' });
    const bad = deps({ permission: 'granted', save: async () => { throw new DataError('offline'); } });
    const failing = new PreferenceActions(bad.full, true);
    await failing.setKind('payment', false);
    expect(failing.getState()).toMatchObject({ kinds: {}, failed: true });
  });
  it('sends one save for two rapid activations and nothing after dispose', async () => {
    const save = vi.fn(async () => ({ push_enabled: true, kinds: {} }));
    const { full } = deps({ permission: 'granted', save });
    const actions = new PreferenceActions(full, true);
    await Promise.all([actions.setKind('payment', false), actions.setKind('announcement', false)]);
    expect(save).toHaveBeenCalledTimes(1);
    actions.dispose();
    await actions.setKind('payment', true);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
