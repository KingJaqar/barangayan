/**
 * Which account this device's push token belongs to, kept free of the native module, the network and storage so the
 * rules are tested directly. Adapters live in `push-notifications.ts`.
 *
 * The record also holds the retry marker: a removal the server could not confirm (offline sign-out, failed opt-out) is
 * kept as `pendingRelease` and completed the next time the app opens, signed in or not. The server releases a token for
 * whoever holds it, and the next account to register this device replaces the record, so a token that another account
 * has since taken over is never released by a stale marker.
 */

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export type PushPort = {
  permission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  /** The Expo push token of this device, or null when this build or device cannot get one. */
  token(): Promise<string | null>;
};

export type PushApi = {
  register(token: string): Promise<void>;
  release(token: string): Promise<void>;
};

export type PushRecord = { userId: string; token: string; pendingRelease: boolean };
export type RecordStore = { read(): Promise<string | null>; write(value: string | null): Promise<void> };

async function readRecord(store: RecordStore): Promise<PushRecord | null> {
  try {
    const raw = await store.read();
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { userId, token, pendingRelease } = value as Record<string, unknown>;
    if (typeof userId !== 'string' || typeof token !== 'string' || !token || token.length > 200 || typeof pendingRelease !== 'boolean') return null;
    return { userId, token, pendingRelease };
  } catch {
    return null;
  }
}

const writeRecord = (store: RecordStore, record: PushRecord | null) => store.write(record ? JSON.stringify(record) : null);

export type RegistrationResult =
  | { status: 'registered'; token: string }
  /** The OS has not been asked yet and this call was not allowed to ask. */
  | { status: 'needs-permission' }
  | { status: 'denied' }
  /** No token could be obtained: an emulator, Expo Go, a build without a push project, or no connection. */
  | { status: 'unavailable' }
  /** The server did not accept the registration. */
  | { status: 'failed' };

/**
 * Registers this device's token for the signed-in account. Safe to repeat. Only an explicit resident action (turning alerts
 * on) may show the OS permission prompt; a denied permission is a state to report, never an error.
 */
export async function registerDevice(options: { port: PushPort; api: PushApi; store: RecordStore; userId: string; askPermission: boolean }): Promise<RegistrationResult> {
  const { port, api, store, userId } = options;
  let permission = await port.permission();
  if (permission === 'undetermined' && options.askPermission) permission = await port.requestPermission();
  if (permission === 'denied') return { status: 'denied' };
  if (permission === 'undetermined') return { status: 'needs-permission' };
  let token: string | null;
  try { token = await port.token(); } catch { token = null; }
  if (!token) return { status: 'unavailable' };
  try {
    await api.register(token);
    await writeRecord(store, { userId, token, pendingRelease: false });
  } catch {
    return { status: 'failed' };
  }
  return { status: 'registered', token };
}

export type ReleaseResult = 'released' | 'pending' | 'none';

/**
 * Removes this device's token from the account that is signing out or opting out. The marker is written first so a removal
 * that cannot be confirmed is retried instead of forgotten. `port` is only a fallback for a device whose record predates
 * this storage.
 */
export async function releaseDevice(options: { api: PushApi; store: RecordStore; userId: string; port?: PushPort }): Promise<ReleaseResult> {
  const { api, store, userId } = options;
  const record = await readRecord(store);
  let token = record && record.userId === userId ? record.token : null;
  if (!token && !record && options.port) {
    try { token = (await options.port.permission()) === 'granted' ? await options.port.token() : null; } catch { token = null; }
  }
  if (!token) return 'none';
  try { await writeRecord(store, { userId, token, pendingRelease: true }); } catch { return 'pending'; }
  try {
    await api.release(token);
    await writeRecord(store, null);
    return 'released';
  } catch {
    return 'pending';
  }
}

/** Completes a removal that was not confirmed earlier. It needs no signed-in account. */
export async function retryPendingRelease(options: { api: PushApi; store: RecordStore }): Promise<ReleaseResult> {
  const record = await readRecord(options.store);
  if (!record || !record.pendingRelease) return 'none';
  try {
    await options.api.release(record.token);
    await writeRecord(options.store, null);
    return 'released';
  } catch {
    return 'pending';
  }
}

/** Runs push operations one after another, so a registration and a removal never interleave on one device. */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };
}
