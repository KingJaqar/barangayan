import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GOOGLE_ATTEMPT_KEY } from './google-auth-flow';

// The real Android adapter (google-auth.ts) over an in-memory store, browser and
// Auth client. Synthetic identifiers only; no network, URL code or token is stored.
type FakeUser = { id: string; identities: { provider: string }[]; app_metadata: Record<string, unknown>; last_sign_in_at: string };
const fake = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  session: null as null | { user: FakeUser; access_token: string },
  browser: async (): Promise<{ type: string; url?: string }> => ({ type: 'cancel' }),
  exchangeTo: 'a',
  storedDuringBrowser: null as string | null,
  calls: { oauth: 0, exchange: 0, signOut: 0, provision: 0 },
}));
const token = (sub: string, amr: { method: string; timestamp: number }[]) =>
  `h.${Buffer.from(JSON.stringify({ sub, session_id: `s-${sub}`, amr })).toString('base64url')}.sig`;
const user = (id: string, google = true): FakeUser => ({ id, identities: google ? [{ provider: 'google' }] : [], app_metadata: {}, last_sign_in_at: new Date().toISOString() });
const signedIn = (id: string, method = 'password', at = Date.now() - 3_600_000) => ({ user: user(id, method === 'oauth'), access_token: token(id, [{ method, timestamp: Math.floor(at / 1000) }]) });

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => fake.storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { fake.storage.set(key, value); },
  removeItem: async (key: string) => { fake.storage.delete(key); },
} }));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync: async () => {
  fake.storedDuringBrowser = fake.storage.get('resident-google-pkce-v2') ?? null;
  return fake.browser();
} }));
vi.mock('./supabase', () => ({ supabase: {
  auth: {
    getSession: async () => ({ data: { session: fake.session }, error: null }),
    getUser: async () => fake.session ? { data: { user: fake.session.user }, error: null } : { data: { user: null }, error: { name: 'AuthSessionMissingError' } },
    signInWithOAuth: async () => { fake.calls.oauth++; return { data: { url: 'https://auth.invalid/authorize' }, error: null }; },
    linkIdentity: async () => { fake.calls.oauth++; return { data: { url: 'https://auth.invalid/authorize' }, error: null }; },
    exchangeCodeForSession: async () => {
      fake.calls.exchange++;
      // The SDK installs the exchanged session before returning, whoever it belongs to.
      fake.session = { user: user(fake.exchangeTo), access_token: token(fake.exchangeTo, [{ method: 'oauth', timestamp: Math.floor(Date.now() / 1000) }]) };
      return { data: { user: fake.session.user, session: fake.session }, error: null };
    },
    signOut: async () => { fake.calls.signOut++; fake.session = null; return { error: null }; },
  },
  rpc: () => ({ abortSignal: async () => { fake.calls.provision++; return { data: true, error: null }; } }),
} }));

const { clearGoogleReauthentication, googleReauthentication, startGoogleAuth } = await import('./google-auth');
const success = async () => ({ type: 'success', url: 'barangayan://auth/callback?code=synthetic-only' });

beforeEach(() => {
  fake.storage.clear(); fake.session = signedIn('a'); fake.exchangeTo = 'a'; fake.storedDuringBrowser = null; fake.browser = async () => ({ type: 'cancel' });
  fake.calls = { oauth: 0, exchange: 0, signOut: 0, provision: 0 };
});

describe('Settings Google reauthentication adapter', () => {
  it('unlocks the final deletion dialog once; cancelling consumes it so refocus cannot reopen it', async () => {
    fake.browser = success;
    const attempt = await startGoogleAuth('reauthenticate', 'delete_account');
    expect(attempt).toMatchObject({ intent: 'reauthenticate', purpose: 'delete_account', expectedUserId: 'a', userId: 'a', phase: 'complete' });
    expect(fake.storedDuringBrowser).toContain('"purpose":"delete_account"');
    expect(fake.storedDuringBrowser).not.toContain('synthetic-only');
    expect(fake.storage.get(GOOGLE_ATTEMPT_KEY)).not.toContain('synthetic-only');
    expect(await googleReauthentication('delete_account')).toBe('fresh');
    // A deletion confirmation never unlocks first-password setup.
    expect(await googleReauthentication('set_password')).toBe('none');
    await clearGoogleReauthentication();
    expect(await googleReauthentication('delete_account')).toBe('none');
  });

  it('a closed browser leaves no attempt and nothing unlocked', async () => {
    await expect(startGoogleAuth('reauthenticate', 'set_password')).rejects.toThrow('Google sign-in cancelled');
    expect(fake.storage.has(GOOGLE_ATTEMPT_KEY)).toBe(false);
    expect(fake.calls.exchange).toBe(0);
    expect(await googleReauthentication('set_password')).toBe('none');
    expect(fake.session?.user.id).toBe('a');
  });

  it('a different Google account is signed out before provisioning and unlocks nothing', async () => {
    fake.browser = success; fake.exchangeTo = 'b';
    await expect(startGoogleAuth('reauthenticate', 'set_password')).rejects.toThrow('different Google account');
    expect(fake.calls.signOut).toBe(1);
    expect(fake.calls.provision).toBe(0);
    expect(fake.session).toBeNull();
    expect(await googleReauthentication('set_password')).not.toBe('fresh');
  });

  it('refuses purposeless reauthentication and mismatched signed-in state before any browser or storage write', async () => {
    await expect(startGoogleAuth('reauthenticate')).rejects.toThrow('Choose the account action');
    await expect(startGoogleAuth('sign_in')).rejects.toThrow('Sign out before');
    fake.session = null;
    await expect(startGoogleAuth('reauthenticate', 'delete_account')).rejects.toThrow('Sign in to your account first');
    expect(fake.calls.oauth).toBe(0);
    expect(fake.storage.has(GOOGLE_ATTEMPT_KEY)).toBe(false);
  });

  it('only clears reauthentication; a consumed sign-up checkpoint survives for provisioning retry', async () => {
    const signup = { id: 'x', intent: 'sign_up', purpose: null, started: Date.now(), expectedUserId: null, userId: 'a', phase: 'consumed' };
    fake.storage.set(GOOGLE_ATTEMPT_KEY, JSON.stringify(signup));
    await clearGoogleReauthentication();
    expect(fake.storage.get(GOOGLE_ATTEMPT_KEY)).toBe(JSON.stringify(signup));
  });

  it('an older Google session with a valid-looking local record is not fresh after the window', async () => {
    const old = Date.now() - 6 * 60_000;
    fake.session = signedIn('a', 'oauth', old);
    fake.storage.set(GOOGLE_ATTEMPT_KEY, JSON.stringify({ id: 'r', intent: 'reauthenticate', purpose: 'set_password', started: old, expectedUserId: 'a', userId: 'a', phase: 'complete' }));
    expect(await googleReauthentication('set_password')).toBe('expired');
  });
});
