import { z } from 'zod';

/** The OS notification permission as the app reasons about it. */
export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** The device side of push, supplied by `native-push.ts` in the app and by a double in tests. */
export type PushPort = {
  permission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  /** The Expo push token of this device, or null when this build or device cannot get one. */
  token(): Promise<string | null>;
};

/** The server side: `residentApi` satisfies it. */
export type PushApi = {
  registerPushToken(token: string): Promise<void>;
  releasePushToken(token: string): Promise<void>;
};

/**
 * What this device last registered and for whom. `pendingRelease` is the retry marker (tombstone): the token must be
 * removed from the account but the removal has not been confirmed (offline logout, failed opt-out).
 */
const recordSchema = z.object({ userId: z.string().uuid(), token: z.string().min(1).max(200), pendingRelease: z.boolean() });
export type PushRecord = z.infer<typeof recordSchema>;
export type RecordStore = { read(): Promise<string | null>; write(value: string | null): Promise<void> };

export async function readRecord(store: RecordStore): Promise<PushRecord | null> {
  let raw: string | null;
  try { raw = await store.read(); } catch { return null; }
  if (!raw) return null;
  try {
    const parsed = recordSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
const writeRecord = (store: RecordStore, record: PushRecord | null) => store.write(record ? JSON.stringify(record) : null);

export type RegistrationResult =
  | { status: 'registered'; token: string }
  /** The resident's alert switch is off; nothing was requested or registered. */
  | { status: 'off' }
  /** The switch is on but the iPhone has not been asked yet and this call was not allowed to ask. */
  | { status: 'needs-permission' }
  | { status: 'denied' }
  /** No token could be obtained: a simulator, a build without a push project, or no connection to Expo. */
  | { status: 'unavailable' }
  /** The server did not accept the registration. */
  | { status: 'failed'; error: unknown };

export type RegisterOptions = {
  port: PushPort; api: PushApi; store: RecordStore; userId: string;
  /** The resident's saved global switch. */
  enabled: boolean;
  /** Only an explicit resident action (turning alerts on) may show the iPhone permission prompt. */
  askPermission: boolean;
};

/**
 * Registers this device's token for the signed-in account (A44-003…005). Safe to repeat: it runs whenever an eligible session
 * starts or returns to the foreground, which also refreshes the token's last-used time. A denied permission or a missing token
 * is a state to explain, never an error that blocks the app.
 */
export async function registerDevice(options: RegisterOptions): Promise<RegistrationResult> {
  const { port, api, store, userId } = options;
  if (!options.enabled) return { status: 'off' };
  let permission = await port.permission();
  if (permission === 'undetermined' && options.askPermission) permission = await port.requestPermission();
  if (permission === 'denied') return { status: 'denied' };
  if (permission === 'undetermined') return { status: 'needs-permission' };
  let token: string | null;
  try { token = await port.token(); } catch { token = null; }
  if (!token) return { status: 'unavailable' };
  try {
    await api.registerPushToken(token);
    await writeRecord(store, { userId, token, pendingRelease: false });
  } catch (error) {
    return { status: 'failed', error };
  }
  return { status: 'registered', token };
}

export type ReleaseOptions = { api: PushApi; store: RecordStore; userId: string; port?: PushPort };

/**
 * Removes this device's token from the account (opt-out, logout). The marker is written first, so a removal that cannot be
 * confirmed is retried later instead of forgotten; the server also stops sending to an opted-out account at send time.
 * Returns `released`, `pending` (retry marker kept) or `none` (this device had no token for the account).
 */
export async function releaseDevice(options: ReleaseOptions): Promise<'released' | 'pending' | 'none'> {
  const { api, store, userId } = options;
  const record = await readRecord(store);
  let token = record && record.userId === userId ? record.token : null;
  if (!token && options.port) {
    try { token = await options.port.token(); } catch { token = null; }
  }
  if (!token) return 'none';
  try { await writeRecord(store, { userId, token, pendingRelease: true }); } catch { return 'pending'; }
  try {
    await api.releasePushToken(token);
    await writeRecord(store, null);
    return 'released';
  } catch {
    return 'pending';
  }
}

/**
 * Completes a removal that could not be confirmed earlier (offline logout, failed opt-out). It needs no signed-in account:
 * the server accepts a release from whoever holds the token, and a marker still pending means the token must go. A marker is
 * replaced when any account registers this device again, so a token another account has since taken over is never released here.
 */
export async function retryPendingRelease(options: Pick<ReleaseOptions, 'api' | 'store'>): Promise<'released' | 'pending' | 'none'> {
  const record = await readRecord(options.store);
  if (!record || !record.pendingRelease) return 'none';
  try {
    await options.api.releasePushToken(record.token);
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

/** The one queue every registration and removal on this device goes through. */
export const pushQueue = createSerialQueue();
