import { describe, expect, it } from 'vitest';

import {
  createSerialQueue,
  registerDevice,
  releaseDevice,
  retryPendingRelease,
  type PermissionState,
  type PushApi,
  type PushPort,
  type RecordStore,
} from './push-registration';

const TOKEN = 'ExponentPushToken[device-a]';
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function memoryStore(initial: string | null = null): RecordStore & { value: string | null } {
  const store = { value: initial, read: async () => store.value, write: async (value: string | null) => { store.value = value; } };
  return store;
}

function fakes(permission: PermissionState, options: { token?: string | null; granted?: PermissionState } = {}) {
  const calls = { requested: 0, registered: [] as string[], released: [] as string[] };
  const port: PushPort = {
    permission: async () => permission,
    requestPermission: async () => { calls.requested++; return options.granted ?? 'granted'; },
    token: async () => (options.token === undefined ? TOKEN : options.token),
  };
  const api: PushApi & { failRegister: boolean; failRelease: boolean } = {
    failRegister: false,
    failRelease: false,
    register: async (token) => { if (api.failRegister) throw new Error('offline'); calls.registered.push(token); },
    release: async (token) => { if (api.failRelease) throw new Error('offline'); calls.released.push(token); },
  };
  return { port, api, calls };
}
const record = (userId: string, pendingRelease: boolean) => JSON.stringify({ userId, token: TOKEN, pendingRelease });

describe('registerDevice', () => {
  it('registers a granted device and remembers whose token it is', async () => {
    const { port, api, calls } = fakes('granted'); const store = memoryStore();
    expect(await registerDevice({ port, api, store, userId: USER, askPermission: false })).toEqual({ status: 'registered', token: TOKEN });
    expect(calls.registered).toEqual([TOKEN]);
    expect(JSON.parse(store.value ?? 'null')).toEqual({ userId: USER, token: TOKEN, pendingRelease: false });
  });

  it('never prompts unless the call is an explicit action, and reports the state instead', async () => {
    const { port, api, calls } = fakes('undetermined'); const store = memoryStore();
    expect(await registerDevice({ port, api, store, userId: USER, askPermission: false })).toEqual({ status: 'needs-permission' });
    expect(calls.requested).toBe(0);
    expect(calls.registered).toEqual([]);
    expect(store.value).toBeNull();
  });

  it('prompts once when asked and registers when the resident agrees', async () => {
    const { port, api, calls } = fakes('undetermined'); const store = memoryStore();
    expect((await registerDevice({ port, api, store, userId: USER, askPermission: true })).status).toBe('registered');
    expect(calls.requested).toBe(1);
  });

  it('keeps a denial as a state: no token request, no registration, no prompt', async () => {
    const denied = fakes('denied');
    expect(await registerDevice({ ...denied, store: memoryStore(), userId: USER, askPermission: true })).toEqual({ status: 'denied' });
    expect(denied.calls.requested).toBe(0);
    const refused = fakes('undetermined', { granted: 'denied' });
    expect(await registerDevice({ ...refused, store: memoryStore(), userId: USER, askPermission: true })).toEqual({ status: 'denied' });
    expect(refused.calls.registered).toEqual([]);
  });

  it('reports an unavailable token and a rejected registration without writing a record', async () => {
    const none = fakes('granted', { token: null });
    expect(await registerDevice({ ...none, store: memoryStore(), userId: USER, askPermission: false })).toEqual({ status: 'unavailable' });
    const rejected = fakes('granted'); rejected.api.failRegister = true; const store = memoryStore();
    expect(await registerDevice({ ...rejected, store, userId: USER, askPermission: false })).toEqual({ status: 'failed' });
    expect(store.value).toBeNull();
  });

  it('turns a token that throws into unavailable', async () => {
    const { port, api } = fakes('granted'); port.token = async () => { throw new Error('boom'); };
    expect(await registerDevice({ port, api, store: memoryStore(), userId: USER, askPermission: false })).toEqual({ status: 'unavailable' });
  });
});

describe('releaseDevice', () => {
  it('writes the marker first, then removes the token and the record', async () => {
    const { api, calls } = fakes('granted'); const store = memoryStore(record(USER, false));
    api.release = async (token) => { expect(JSON.parse(store.value ?? 'null').pendingRelease).toBe(true); calls.released.push(token); };
    expect(await releaseDevice({ api, store, userId: USER })).toBe('released');
    expect(calls.released).toEqual([TOKEN]);
    expect(store.value).toBeNull();
  });

  it('keeps the retry marker when the removal cannot be confirmed (offline sign-out)', async () => {
    const { api, calls } = fakes('granted'); api.failRelease = true; const store = memoryStore(record(USER, false));
    expect(await releaseDevice({ api, store, userId: USER })).toBe('pending');
    expect(JSON.parse(store.value ?? 'null')).toEqual({ userId: USER, token: TOKEN, pendingRelease: true });
    expect(calls.released).toEqual([]);
  });

  it('never releases a token another account registered', async () => {
    const { api, calls, port } = fakes('granted'); const store = memoryStore(record(OTHER, false));
    expect(await releaseDevice({ api, store, userId: USER, port })).toBe('none');
    expect(calls.released).toEqual([]);
    expect(JSON.parse(store.value ?? 'null').userId).toBe(OTHER);
  });

  it('falls back to the device token only when no record exists, and only with permission', async () => {
    const granted = fakes('granted');
    expect(await releaseDevice({ api: granted.api, store: memoryStore(), userId: USER, port: granted.port })).toBe('released');
    expect(granted.calls.released).toEqual([TOKEN]);
    const denied = fakes('denied');
    expect(await releaseDevice({ api: denied.api, store: memoryStore(), userId: USER, port: denied.port })).toBe('none');
    expect(await releaseDevice({ api: denied.api, store: memoryStore(), userId: USER })).toBe('none');
  });

  it('treats a corrupt record as none', async () => {
    const { api } = fakes('granted');
    expect(await releaseDevice({ api, store: memoryStore('{not json'), userId: USER })).toBe('none');
    expect(await releaseDevice({ api, store: memoryStore(JSON.stringify({ userId: USER, token: 5, pendingRelease: true })), userId: USER })).toBe('none');
  });
});

describe('retryPendingRelease', () => {
  it('completes a pending removal without a signed-in account, once', async () => {
    const { api, calls } = fakes('granted'); const store = memoryStore(record(USER, true));
    expect(await retryPendingRelease({ api, store })).toBe('released');
    expect(calls.released).toEqual([TOKEN]);
    expect(store.value).toBeNull();
    expect(await retryPendingRelease({ api, store })).toBe('none');
    expect(calls.released).toEqual([TOKEN]);
  });

  it('stays pending while offline and does nothing for a record that is not pending', async () => {
    const { api } = fakes('granted'); api.failRelease = true; const store = memoryStore(record(USER, true));
    expect(await retryPendingRelease({ api, store })).toBe('pending');
    expect(JSON.parse(store.value ?? 'null').pendingRelease).toBe(true);
    expect(await retryPendingRelease({ api, store: memoryStore(record(USER, false)) })).toBe('none');
  });

  it('is replaced when another account registers the device, so a taken-over token is not released', async () => {
    const { port, api, calls } = fakes('granted'); const store = memoryStore(record(USER, true));
    await registerDevice({ port, api, store, userId: OTHER, askPermission: false });
    expect(await retryPendingRelease({ api, store })).toBe('none');
    expect(calls.released).toEqual([]);
    expect(JSON.parse(store.value ?? 'null')).toEqual({ userId: OTHER, token: TOKEN, pendingRelease: false });
  });
});

describe('createSerialQueue', () => {
  it('runs a release ahead of the next registration and keeps going after a failure', async () => {
    const run = createSerialQueue(); const order: string[] = [];
    const first = run(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); order.push('release'); throw new Error('offline'); });
    const second = run(async () => { order.push('register'); return 'ok'; });
    await expect(first).rejects.toThrow('offline');
    expect(await second).toBe('ok');
    expect(order).toEqual(['release', 'register']);
  });
});
