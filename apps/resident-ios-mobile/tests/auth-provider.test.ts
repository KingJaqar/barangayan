import { describe, expect, it } from 'vitest';
import { appleNamesFrom, createAppleNonce, toHex } from '../src/auth/apple-nonce';
import { buildCallbackUrl, callbackFailureMessage, isCallbackUrl, parseCallback } from '../src/auth/callback-url';
import { FRESH_AUTH_WINDOW_MS, reauthenticationState, sessionClaims } from '../src/auth/fresh-authentication';
import {
  ProviderAuthFlow, parseAttempt, type FlowDependencies, type Provider, type ProviderAttempt, type SessionIdentity,
} from '../src/auth/provider-flow';
import { RequestGate } from '../src/auth/request-gate';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const now = 1_800_000_000_000;
const attempt = (patch: Partial<ProviderAttempt> = {}): ProviderAttempt => ({
  id: 'a1', provider: 'google', intent: 'sign_in', purpose: null, started: now, expectedUserId: null, userId: null, phase: 'issued', ...patch,
});

describe('OAuth callback validation (P04-T03, A05-010/011)', () => {
  it('builds the callback only from a configured custom scheme', () => {
    expect(buildCallbackUrl('Barangayan-Resident')).toBe('barangayan-resident://auth/callback');
    for (const scheme of [null, undefined, '', 'https', 'http', 'exp', 'exp+barangayan', 'javascript', 'has space', '1abc']) expect(buildCallbackUrl(scheme)).toBeNull();
  });

  it('accepts only the exact callback with exactly one code', () => {
    const expected = 'app://auth/callback';
    expect(parseCallback('app://auth/callback?code=abc', expected)).toEqual({ ok: true, code: 'abc' });
    expect(parseCallback('app://auth/callback?code=a&code=b', expected)).toMatchObject({ ok: false, reason: 'incomplete' });
    expect(parseCallback('app://auth/callback', expected)).toMatchObject({ ok: false, reason: 'incomplete' });
    expect(parseCallback('app://auth/callback?code=', expected)).toMatchObject({ ok: false, reason: 'incomplete' });
    expect(parseCallback('app://auth/callback?error=access_denied', expected)).toMatchObject({ ok: false, reason: 'declined' });
    for (const bad of ['other://auth/callback?code=a', 'app://evil/callback?code=a', 'app://auth/other?code=a', 'app://auth/callback?code=a#x', 'app://u:p@auth/callback?code=a', 'not a url']) {
      expect(parseCallback(bad, expected)).toMatchObject({ ok: false, reason: 'invalid' });
    }
    expect(callbackFailureMessage('declined')).toMatch(/cancelled/);
    expect(isCallbackUrl('app://auth/callback?code=a', expected)).toBe(true);
    expect(isCallbackUrl('app://auth/callback?code=a', null)).toBe(false);
    expect(isCallbackUrl('app://other', expected)).toBe(false);
  });
});

describe('Apple nonce (P04-T03)', () => {
  it('hands Apple the digest and keeps the raw value for the token exchange', async () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, index) => index);
    const nonce = await createAppleNonce(() => bytes, async (value) => Uint8Array.from({ length: 32 }, (_, index) => value.charCodeAt(index % value.length) & 0xff));
    expect(nonce.raw).toBe(toHex(bytes));
    expect(nonce.raw).toHaveLength(64);
    expect(nonce.hashed).toHaveLength(64);
    expect(nonce.hashed).not.toBe(nonce.raw);
  });

  it('fails closed without secure entropy or hashing', async () => {
    await expect(createAppleNonce(() => new Uint8Array(8), async () => new Uint8Array(32))).rejects.toThrow(/random/);
    await expect(createAppleNonce(() => new Uint8Array(32), async () => new Uint8Array(4))).rejects.toThrow(/hashing/);
  });

  it('uses the supplied name only as a suggestion and tolerates its absence on later sign-ins', () => {
    expect(appleNamesFrom({ givenName: ' Ana ', familyName: 'Reyes' })).toEqual({ firstName: 'Ana', lastName: 'Reyes' });
    expect(appleNamesFrom(null)).toEqual({ firstName: '', lastName: '' });
    expect(appleNamesFrom({ givenName: null, familyName: null })).toEqual({ firstName: '', lastName: '' });
  });
});

describe('provider attempt record', () => {
  it('parses a valid record and rejects expired, future, malformed and incomplete ones', () => {
    expect(parseAttempt(JSON.stringify(attempt()), now + 1000)).toMatchObject({ id: 'a1', phase: 'issued' });
    expect(parseAttempt(JSON.stringify(attempt()), now + 11 * 60_000)).toBeNull();
    expect(parseAttempt(JSON.stringify(attempt()), now - 1)).toBeNull();
    expect(parseAttempt('{', now)).toBeNull();
    expect(parseAttempt(null, now)).toBeNull();
    expect(parseAttempt(JSON.stringify(attempt({ provider: 'facebook' as Provider })), now)).toBeNull();
    expect(parseAttempt(JSON.stringify(attempt({ intent: 'link', expectedUserId: null })), now)).toBeNull();
    expect(parseAttempt(JSON.stringify(attempt({ phase: 'consumed', userId: null })), now)).toBeNull();
    expect(parseAttempt(JSON.stringify(attempt({ intent: 'reauthenticate', expectedUserId: U1, purpose: null })), now)).toBeNull();
    expect(parseAttempt(JSON.stringify(attempt({ intent: 'reauthenticate', expectedUserId: U1, purpose: 'set_password' })), now)).toMatchObject({ purpose: 'set_password' });
  });
});

type World = {
  stored: string | null;
  session: SessionIdentity | null;
  exchanged: string[];
  discarded: string[];
  provisioned: number;
  exchangeResult: string | null;
  exchangeProviders: string[];
};
function harness(provider: Provider, world: World) {
  const deps: FlowDependencies<string> = {
    read: async () => world.stored,
    write: async (value) => { world.stored = JSON.stringify(value); },
    current: async () => world.session,
    exchange: async (credential) => {
      world.exchanged.push(credential);
      if (world.exchangeResult === null) throw new Error('exchange failed');
      world.session = { id: world.exchangeResult, providers: world.exchangeProviders, lastSignIn: Date.now() };
      return world.exchangeResult;
    },
    discardUnexpectedSession: async (userId) => { world.discarded.push(userId); world.session = null; },
    provision: async () => { world.provisioned++; },
    gate: new RequestGate(),
  };
  return new ProviderAuthFlow<string>(provider, deps, (credential) => credential);
}
const world = (patch: Partial<World> = {}): World => ({
  stored: JSON.stringify({ ...attempt({ started: Date.now() }) }), session: null, exchanged: [], discarded: [], provisioned: 0,
  exchangeResult: U1, exchangeProviders: ['google'], ...patch,
});

describe('provider authentication flow (P04-T03/T08, F03/F04)', () => {
  it('exchanges once, provisions the verified account and records completion', async () => {
    const w = world();
    const flow = harness('google', w);
    const result = await flow.finish('code-1');
    expect(result).toMatchObject({ phase: 'complete', userId: U1 });
    expect(w.exchanged).toEqual(['code-1']);
    expect(w.provisioned).toBe(1);
    expect(JSON.parse(w.stored as string).phase).toBe('complete');
  });

  it('does not exchange again on a retry of a completed attempt and rejects a different credential for a consumed one', async () => {
    const w = world();
    const flow = harness('google', w);
    await flow.finish('code-1');
    await flow.finish('code-1');
    expect(w.exchanged).toEqual(['code-1']);
    expect(w.provisioned).toBe(1);
    await expect(flow.finish('code-2')).rejects.toThrow(/different sign-in attempt/);
    expect(w.exchanged).toEqual(['code-1']);
  });

  it('coalesces concurrent completions and refuses a different credential in flight', async () => {
    const w = world();
    const flow = harness('google', w);
    const first = flow.finish('code-1');
    const same = flow.finish('code-1');
    await expect(flow.finish('code-2')).rejects.toThrow(/already being processed/);
    await expect(Promise.all([first, same])).resolves.toHaveLength(2);
    expect(w.exchanged).toEqual(['code-1']);
  });

  it('rejects expired or foreign-provider attempts before any exchange (replay, unsolicited callback)', async () => {
    const expired = world({ stored: JSON.stringify(attempt({ started: Date.now() - 11 * 60_000 })) });
    await expect(harness('google', expired).finish('code')).rejects.toThrow(/expired/);
    expect(expired.exchanged).toEqual([]);
    const none = world({ stored: null });
    await expect(harness('google', none).finish('code')).rejects.toThrow(/expired/);
    const foreign = world({ stored: JSON.stringify(attempt({ provider: 'apple', started: Date.now() })) });
    await expect(harness('google', foreign).finish('code')).rejects.toThrow(/expired/);
    expect(foreign.exchanged).toEqual([]);
  });

  it('needs an actual credential unless the exchange already happened', async () => {
    const w = world();
    await expect(harness('google', w).finish()).rejects.toThrow(/No verified Google response/);
    expect(w.exchanged).toEqual([]);
  });

  it('discards the session when a different account answers a link or reauthentication (wrong account)', async () => {
    const w = world({
      stored: JSON.stringify(attempt({ intent: 'reauthenticate', purpose: 'set_password', expectedUserId: U1, started: Date.now() })),
      session: { id: U1, providers: ['google'], lastSignIn: Date.now() },
      exchangeResult: U2,
    });
    await expect(harness('google', w).finish('code')).rejects.toThrow(/different Google account/);
    expect(w.discarded).toEqual([U2]);
    expect(w.provisioned).toBe(0);
  });

  it('refuses to start from a session that is not the expected account', async () => {
    const w = world({
      stored: JSON.stringify(attempt({ intent: 'link', expectedUserId: U1, started: Date.now() })),
      session: { id: U2, providers: ['google'], lastSignIn: Date.now() },
    });
    await expect(harness('google', w).finish('code')).rejects.toThrow(/account changed/);
    expect(w.exchanged).toEqual([]);
  });

  it('does not count an exchange that lacks the provider identity', async () => {
    const w = world({ exchangeProviders: ['email'] });
    await expect(harness('google', w).finish('code')).rejects.toThrow(/did not confirm/);
    expect(w.provisioned).toBe(0);
  });

  it('reconciles a crash after exchange without presenting the credential again', async () => {
    const started = Date.now() - 1000;
    const w = world({
      stored: JSON.stringify(attempt({ phase: 'exchanging', started })),
      session: { id: U1, providers: ['google'], lastSignIn: started + 500 },
    });
    const result = await harness('google', w).finish();
    expect(result).toMatchObject({ phase: 'complete', userId: U1 });
    expect(w.exchanged).toEqual([]);
    expect(w.provisioned).toBe(1);
  });

  it('works for Apple with the identity token as the credential', async () => {
    const w = world({
      stored: JSON.stringify(attempt({ provider: 'apple', intent: 'sign_up', started: Date.now() })),
      exchangeProviders: ['apple'],
    });
    const result = await harness('apple', w).finish('identity-token');
    expect(result).toMatchObject({ provider: 'apple', phase: 'complete', userId: U1 });
    expect(w.exchanged).toEqual(['identity-token']);
  });
});

function token(claims: Record<string, unknown>) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.signature`;
}
describe('fresh same-account authentication (P04-T05/T06, A42-013)', () => {
  const secs = (ms: number) => Math.floor(ms / 1000);
  const completed = (patch: Partial<ProviderAttempt> = {}) => attempt({
    provider: 'google', intent: 'reauthenticate', purpose: 'set_password', expectedUserId: U1, userId: U1, phase: 'complete', started: now, ...patch,
  });

  it('reads claims only from a well-formed Auth token', () => {
    expect(sessionClaims(token({ sub: U1, amr: [{ method: 'oauth', timestamp: 1 }] }))).toMatchObject({ sub: U1 });
    expect(sessionClaims('nope')).toBeNull();
    expect(sessionClaims(token({ sub: U1 }))).toBeNull();
    expect(sessionClaims(null)).toBeNull();
  });

  it('is fresh only with a completed same-user attempt and an Auth timestamp after it started', () => {
    const at = now + 30_000;
    const good = token({ sub: U1, amr: [{ method: 'oauth', timestamp: secs(now + 5000) }] });
    expect(reauthenticationState({ attempt: completed(), purpose: 'set_password', accessToken: good, userId: U1, now: at })).toBe('fresh');
    expect(reauthenticationState({ attempt: completed(), purpose: 'delete_account', accessToken: good, userId: U1, now: at })).toBe('none');
    expect(reauthenticationState({ attempt: completed({ phase: 'consumed' }), purpose: 'set_password', accessToken: good, userId: U1, now: at })).toBe('none');
    expect(reauthenticationState({ attempt: completed(), purpose: 'set_password', accessToken: good, userId: U2, now: at })).toBe('mismatch');
    expect(reauthenticationState({ attempt: completed(), purpose: 'set_password', accessToken: token({ sub: U2, amr: [] }), userId: U1, now: at })).toBe('mismatch');
    expect(reauthenticationState({ attempt: null, purpose: 'set_password', accessToken: good, userId: U1, now: at })).toBe('none');
  });

  it('expires after the application window and rejects a stale or wrong-method record', () => {
    const good = token({ sub: U1, amr: [{ method: 'oauth', timestamp: secs(now + 1000) }] });
    expect(reauthenticationState({ attempt: completed(), purpose: 'set_password', accessToken: good, userId: U1, now: now + FRESH_AUTH_WINDOW_MS + 1 })).toBe('expired');
    const old = token({ sub: U1, amr: [{ method: 'oauth', timestamp: secs(now - 20 * 60_000) }] });
    expect(reauthenticationState({ attempt: completed(), purpose: 'set_password', accessToken: old, userId: U1, now: now + 1000 })).toBe('expired');
    const password = token({ sub: U1, amr: [{ method: 'password', timestamp: secs(now + 1000) }] });
    expect(reauthenticationState({ attempt: completed(), purpose: 'set_password', accessToken: password, userId: U1, now: now + 2000 })).toBe('expired');
  });

  it('accepts a fresh Auth timestamp for a completed Apple attempt', () => {
    const apple = completed({ provider: 'apple' });
    const claims = token({ sub: U1, amr: [{ method: 'id_token', timestamp: secs(now + 1000) }] });
    expect(reauthenticationState({ attempt: apple, purpose: 'set_password', accessToken: claims, userId: U1, now: now + 2000 })).toBe('fresh');
  });
});
