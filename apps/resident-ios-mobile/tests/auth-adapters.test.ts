import type { Database } from '@barangayan/shared';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProviderAuth, watchAppleCredential } from '../src/auth/providers';

const native = vi.hoisted(() => ({
  store: new Map<string, string>(),
  available: vi.fn(async () => true),
  signIn: vi.fn(async (options: { state: string }) => ({ identityToken: 'apple-token', state: options.state, fullName: null })),
  credential: vi.fn(async () => 1),
  lifecycle: vi.fn(() => ({ remove: vi.fn() })),
  revoke: vi.fn(() => ({ remove: vi.fn() })),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => native.store.get(key) ?? null,
  setItem: async (key: string, value: string) => { native.store.set(key, value); },
  removeItem: async (key: string) => { native.store.delete(key); },
} }));
vi.mock('expo-linking', () => ({ createURL: () => 'resident-test://auth/callback' }));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync: vi.fn() }));
vi.mock('expo-crypto', () => ({
  randomUUID: () => 'attempt-id', getRandomBytes: (length: number) => new Uint8Array(length),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digest: async () => new Uint8Array(32).buffer,
}));
vi.mock('expo-apple-authentication', () => ({
  isAvailableAsync: native.available, signInAsync: native.signIn, getCredentialStateAsync: native.credential,
  addRevokeListener: native.revoke,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationCredentialState: { REVOKED: 0, AUTHORIZED: 1, NOT_FOUND: 2 },
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: native.lifecycle } }));

function fixture() {
  let signedIn = false;
  const user = { id: 'resident', identities: [{ provider: 'apple' }], last_sign_in_at: new Date().toISOString() };
  const exchange = vi.fn(async () => { signedIn = true; return { data: { user }, error: null }; });
  const client = {
    auth: {
      getUser: async () => ({ data: { user: signedIn ? user : null }, error: null }),
      getSession: async () => ({ data: { session: signedIn ? { user } : null }, error: null }),
      signInWithIdToken: exchange,
    },
    rpc: vi.fn(() => ({ abortSignal: async () => ({ data: user.id, error: null }) })),
  };
  return { exchange, client, providers: createProviderAuth(client as unknown as SupabaseClient<Database>) };
}

describe('native Apple adapter ownership (P04-T03/T08)', () => {
  beforeEach(() => { native.store.clear(); vi.clearAllMocks(); });
  afterEach(() => vi.restoreAllMocks());

  it('passes request state to Apple and exchanges only its matching response', async () => {
    const { providers, exchange, client } = fixture();
    const result = await providers.startApple();
    const options = native.signIn.mock.calls[0]?.[0];
    expect(options?.state).toBe(result.id);
    expect(exchange).toHaveBeenCalledOnce();
    expect(exchange.mock.calls[0]).toBeDefined();
    expect(client.rpc).toHaveBeenCalledWith('ensure_apple_resident_profile');
    expect(result).toMatchObject({ phase: 'complete', userId: 'resident' });
  });

  it('rejects a response from a different request before installing a session', async () => {
    native.signIn.mockResolvedValueOnce({ identityToken: 'foreign-token', state: 'foreign-request', fullName: null });
    const { providers, exchange } = fixture();
    await expect(providers.startApple()).rejects.toThrow(/does not match/);
    expect(exchange).not.toHaveBeenCalled();
    expect(native.store.size).toBe(0);
  });

  it('holds the concurrency lock while native availability is still loading', async () => {
    let resolve: ((value: boolean) => void) | undefined;
    native.available.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { providers, exchange } = fixture();
    const first = providers.startApple();
    await expect(providers.startApple()).rejects.toThrow(/still finishing/);
    resolve?.(true);
    await first;
    expect(native.signIn).toHaveBeenCalledOnce();
    expect(exchange).toHaveBeenCalledOnce();
  });

  it('clears a cancelled request and permits another attempt', async () => {
    native.signIn.mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });
    const { providers, exchange } = fixture();
    await expect(providers.startApple()).rejects.toThrow(/cancelled/);
    expect(native.store.size).toBe(0);
    await providers.startApple();
    expect(exchange).toHaveBeenCalledOnce();
  });

  it('removes native listeners and ignores a revoked result after cleanup', async () => {
    let resolve: ((state: number) => void) | undefined;
    native.credential.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const revoked = vi.fn();
    const session = { user: { identities: [{ provider: 'apple', identity_data: { sub: 'apple-subject' } }] } } as unknown as Session;
    const stop = watchAppleCredential(session, revoked);
    await Promise.resolve();
    stop();
    resolve?.(0);
    await Promise.resolve();
    expect(revoked).not.toHaveBeenCalled();
    expect(native.revoke.mock.results[0]?.value.remove).toHaveBeenCalledOnce();
    expect(native.lifecycle.mock.results[0]?.value.remove).toHaveBeenCalledOnce();
  });
});
