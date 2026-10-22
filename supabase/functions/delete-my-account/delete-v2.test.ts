import { describe, expect, it } from 'vitest';
import { appleClientSecret, readAppleConfig, revokeAppleAuthorization, type AppleConfig, type Fetcher } from './apple-revocation';
import { deleteAccountV2, type DeleteDeps } from './delete-v2';

type Call = string;
function deps(overrides: Partial<DeleteDeps> = {}) {
  const calls: Call[] = [];
  const base: DeleteDeps = {
    hasAppleIdentity: false,
    appleAuthorizationCode: null,
    revokeApple: async () => { calls.push('apple'); return 'ok'; },
    erase: async () => { calls.push('erase'); return { ok: true, state: 'profile_erased' }; },
    setState: async (state, error) => { calls.push(`state:${state}${error ? `:${error}` : ''}`); return true; },
    cleanStorage: async () => { calls.push('storage'); return []; },
    revokeAuth: async () => { calls.push('auth'); return true; },
  };
  return { deps: { ...base, ...overrides }, calls };
}

describe('account deletion v2: order and truthful result', () => {
  it('runs every step in order and reports completed only at the end', async () => {
    const { deps: d, calls } = deps();
    const result = await deleteAccountV2(d);
    expect(result).toEqual({ status: 200, body: { contractVersion: 2, state: 'completed' } });
    expect(calls).toEqual(['erase', 'storage', 'state:storage_cleaned', 'auth', 'state:auth_revoked', 'state:completed']);
  });

  it('stops before changing anything when the confirmation is stale', async () => {
    const { deps: d, calls } = deps({ erase: async () => ({ ok: false, code: '42501' }) });
    expect(await deleteAccountV2(d)).toEqual({ status: 401, body: { error: 'fresh_authentication_required' } });
    expect(calls).toEqual([]);
  });

  it('reports a failed erase as partial and records that it needs attention', async () => {
    const { deps: d, calls } = deps({ erase: async () => ({ ok: false, code: '23503' }) });
    const result = await deleteAccountV2(d);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ error: 'erase_failed' });
    expect(calls).toEqual(['state:needs_attention:erase:23503']);
  });

  it('does not touch the sign-in or report success when storage cleanup is incomplete', async () => {
    const { deps: d, calls } = deps({ cleanStorage: async () => ['id-documents', 'incident-photos'] });
    const result = await deleteAccountV2(d);
    expect(result).toEqual({ status: 502, body: { error: 'storage_cleanup_incomplete' } });
    expect(calls).toEqual(['erase', 'state:needs_attention:storage:id-documents,incident-photos']);
  });

  it('reports a failed sign-in revocation as partial, never completed', async () => {
    const { deps: d, calls } = deps({ revokeAuth: async () => false });
    const result = await deleteAccountV2(d);
    expect(result.body).toEqual({ error: 'auth_revocation_failed' });
    expect(calls).toContain('state:needs_attention:auth_revocation');
    expect(calls).not.toContain('state:completed');
  });

  it('does not report completed when the final state cannot be recorded', async () => {
    const { deps: d } = deps({ setState: async (state) => state !== 'completed' });
    const result = await deleteAccountV2(d);
    expect(result).toEqual({ status: 502, body: { error: 'state_not_recorded' } });
  });

  it('answers a retry after completion without repeating anything', async () => {
    const { deps: d, calls } = deps({ erase: async () => { calls.push('erase'); return { ok: true, state: 'completed' }; } });
    expect(await deleteAccountV2(d)).toEqual({ status: 200, body: { contractVersion: 2, state: 'completed' } });
    expect(calls).toEqual(['erase']);
  });

  it('converges on a retry after a partial failure', async () => {
    let storageAttempts = 0;
    const first = deps({ cleanStorage: async () => { storageAttempts += 1; return storageAttempts === 1 ? ['request-attachments'] : []; } });
    expect((await deleteAccountV2(first.deps)).status).toBe(502);
    const second = deps({ cleanStorage: first.deps.cleanStorage, erase: async () => ({ ok: true, state: 'needs_attention' }) });
    expect((await deleteAccountV2(second.deps)).body).toEqual({ contractVersion: 2, state: 'completed' });
  });

  it('refuses an account that the old flow already anonymized without a record', async () => {
    const { deps: d } = deps({ erase: async () => ({ ok: false, code: 'P0002' }) });
    expect((await deleteAccountV2(d)).status).toBe(409);
  });
});

describe('account deletion v2: Apple sign-in', () => {
  it('needs the one-time Apple code, before anything is changed', async () => {
    const { deps: d, calls } = deps({ hasAppleIdentity: true, appleAuthorizationCode: null });
    expect(await deleteAccountV2(d)).toEqual({ status: 400, body: { error: 'apple_authorization_required' } });
    expect(calls).toEqual([]);
  });

  it('refuses to delete when Apple cannot be disconnected, leaving the account unchanged', async () => {
    const unavailable = deps({ hasAppleIdentity: true, appleAuthorizationCode: 'code', revokeApple: async () => 'unavailable' });
    expect(await deleteAccountV2(unavailable.deps)).toEqual({ status: 503, body: { error: 'apple_revocation_unavailable' } });
    expect(unavailable.calls).toEqual([]);
    const failed = deps({ hasAppleIdentity: true, appleAuthorizationCode: 'code', revokeApple: async () => 'failed' });
    expect(await deleteAccountV2(failed.deps)).toEqual({ status: 502, body: { error: 'apple_revocation_failed' } });
    expect(failed.calls).toEqual([]);
  });

  it('disconnects Apple first and then deletes', async () => {
    const { deps: d, calls } = deps({ hasAppleIdentity: true, appleAuthorizationCode: 'code' });
    expect((await deleteAccountV2(d)).status).toBe(200);
    expect(calls[0]).toBe('apple');
  });

  it('does not ask Apple for an account that has no Apple sign-in', async () => {
    const { deps: d, calls } = deps({ appleAuthorizationCode: 'unneeded' });
    await deleteAccountV2(d);
    expect(calls).not.toContain('apple');
  });
});

async function testKey(): Promise<{ config: AppleConfig; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8))}\n-----END PRIVATE KEY-----`;
  return { config: { clientId: 'com.example.app', teamId: 'TEAM123456', keyId: 'KEY1234567', privateKeyPem: pem }, publicKey: pair.publicKey };
}
const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

describe('Apple client secret and revocation', () => {
  it('signs an ES256 secret with the documented header and claims', async () => {
    const { config, publicKey } = await testKey();
    const secret = await appleClientSecret(config, 1_000_000);
    const [header, claims, signature] = secret.split('.');
    expect(decode(header)).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    expect(decode(claims)).toEqual({ iss: 'TEAM123456', iat: 1_000_000, exp: 1_000_300, aud: 'https://appleid.apple.com', sub: 'com.example.app' });
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, Buffer.from(signature, 'base64url'), new TextEncoder().encode(`${header}.${claims}`));
    expect(valid).toBe(true);
  });

  it('exchanges the code, then revokes the refresh token', async () => {
    const { config } = await testKey();
    const requests: { url: string; body: URLSearchParams }[] = [];
    const fetcher: Fetcher = async (url, init) => {
      requests.push({ url, body: new URLSearchParams(init.body) });
      return { ok: true, json: async () => ({ refresh_token: 'refresh-1' }) };
    };
    expect(await revokeAppleAuthorization(config, 'auth-code', 1_000_000, fetcher)).toBe('ok');
    expect(requests.map((request) => request.url)).toEqual(['https://appleid.apple.com/auth/token', 'https://appleid.apple.com/auth/revoke']);
    expect(requests[0].body.get('grant_type')).toBe('authorization_code');
    expect(requests[0].body.get('code')).toBe('auth-code');
    expect(requests[1].body.get('token')).toBe('refresh-1');
    expect(requests[1].body.get('token_type_hint')).toBe('refresh_token');
    expect(requests[1].body.get('client_id')).toBe('com.example.app');
  });

  it('fails closed when Apple refuses, returns no refresh token or cannot be reached', async () => {
    const { config } = await testKey();
    expect(await revokeAppleAuthorization(config, 'c', 1, async () => ({ ok: false, json: async () => ({}) }))).toBe('failed');
    expect(await revokeAppleAuthorization(config, 'c', 1, async () => ({ ok: true, json: async () => ({}) }))).toBe('failed');
    expect(await revokeAppleAuthorization(config, 'c', 1, async () => { throw new Error('offline'); })).toBe('failed');
    let calls = 0;
    expect(await revokeAppleAuthorization(config, 'c', 1, async () => { calls += 1; return { ok: calls === 1, json: async () => ({ refresh_token: 't' }) }; })).toBe('failed');
  });

  it('is unavailable unless all four settings are present', () => {
    const env = { APPLE_CLIENT_ID: 'a', APPLE_TEAM_ID: 'b', APPLE_KEY_ID: 'c', APPLE_PRIVATE_KEY: 'line1\\nline2' };
    expect(readAppleConfig((name) => env[name as keyof typeof env])).toMatchObject({ clientId: 'a', privateKeyPem: 'line1\nline2' });
    expect(readAppleConfig((name) => (name === 'APPLE_KEY_ID' ? undefined : env[name as keyof typeof env]))).toBeNull();
    expect(readAppleConfig(() => undefined)).toBeNull();
  });
});
