import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const fixture = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock('next/headers', () => ({ cookies: async () => ({
  getAll: () => Array.from(fixture.jar, ([name, value]) => ({ name, value })),
  set: (name: string, value: string) => value ? fixture.jar.set(name, value) : fixture.jar.delete(name),
}) }));
vi.mock('@barangayan/shared', () => ({ boundedAuthFetch: (...args: Parameters<typeof fetch>) => fetch(...args) }));

import { createSupabaseServerClient as adminServer } from '../../admin-web/src/lib/supabase/server';
import { getAuthCookieOptions as adminCookies } from '../../admin-web/src/lib/supabase/cookie-options';
import { proxy as adminProxy } from '../../admin-web/src/proxy';
import { createSupabaseServerClient as residentServer } from '../src/lib/supabase/server';
import { getAuthCookieOptions as residentCookies } from '../src/lib/supabase/cookie-options';
import { proxy as residentProxy } from '../src/proxy';

// Real Supabase SSR/Auth SDKs; only HTTP replies and Next's per-request cookie store
// are fixtures. No hosted accounts, tokens, or database records are used.
const calls: { url: URL; authorization: string | null }[] = [];
const sessions = new Map<string, string>();
const clients: Awaited<ReturnType<typeof adminServer>>[] = [];
const apps = [
  { name: 'admin', server: adminServer, cookies: adminCookies, proxy: adminProxy },
  { name: 'resident', server: residentServer, cookies: residentCookies, proxy: residentProxy },
];
function session(userId: string, id: string, expired = false) {
  const expires = Math.floor(Date.now() / 1000) + (expired ? -120 : 3600);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, session_id: id, exp: expires })}.${encode('synthetic')}`,
    refresh_token: id, token_type: 'bearer', expires_in: 3600, expires_at: expires,
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email: `${userId}@example.test` },
  };
}
function seed(name: string, userId: string, id: string, expired = false, chunked = false) {
  sessions.set(id, userId);
  const value = `base64-${Buffer.from(JSON.stringify(session(userId, id, expired))).toString('base64url')}`;
  if (chunked) {
    fixture.jar.set(`${name}.0`, value.slice(0, 120));
    fixture.jar.set(`${name}.1`, value.slice(120));
  } else fixture.jar.set(name, value);
}
async function client(app: typeof apps[number]) {
  const result = await app.server();
  clients.push(result);
  return result;
}
function cookiesHeader() {
  return Array.from(fixture.jar, ([name, value]) => `${name}=${value}`).join('; ');
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://isolation.supabase.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-fixture-key');
  fixture.jar.clear(); sessions.clear(); calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const authorization = new Headers(init?.headers).get('authorization');
    calls.push({ url, authorization });
    const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname.endsWith('/token')) {
      const body = JSON.parse(String(init?.body));
      if (url.searchParams.get('grant_type') === 'password') {
        const userId = body.email.split('@')[0];
        const id = `session-${sessions.size}`;
        sessions.set(id, userId);
        return reply(session(userId, id));
      }
      const userId = sessions.get(body.refresh_token);
      return userId ? reply(session(userId, body.refresh_token)) : reply({ message: 'Session revoked' }, 400);
    }
    const claims = JSON.parse(Buffer.from(authorization!.split('.')[1], 'base64url').toString());
    if (url.pathname.endsWith('/user')) return reply(session(claims.sub, claims.session_id).user);
    if (url.pathname.endsWith('/logout')) {
      if (url.searchParams.get('scope') === 'global') {
        for (const [id, userId] of sessions) if (userId === claims.sub) sessions.delete(id);
      } else sessions.delete(claims.session_id);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  }));
});
afterEach(async () => {
  await Promise.all(clients.splice(0).map(value => value.auth.dispose()));
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe('web session storage and server request isolation', () => {
  it('retains separate signed-in identities when server clients are recreated', async () => {
    for (const app of apps) {
      const signed = await (await client(app)).auth.signInWithPassword({ email: `${app.name}@example.test`, password: 'fixture' });
      expect(signed.error).toBeNull();
    }
    expect(adminCookies().name).not.toBe(residentCookies().name);
    expect([...fixture.jar.keys()].sort()).toEqual(apps.map(app => app.cookies().name).sort());
    for (const app of apps) expect((await (await client(app)).auth.getUser()).data.user?.id).toBe(app.name);
    expect(calls).toHaveLength(4); // Two logins and two authenticated user reads.
  });

  it.each(apps)('$name does not adopt or remove legacy/foreign cookies', async app => {
    const other = apps.find(value => value !== app)!;
    seed('sb-isolation-auth-token', 'legacy', 'legacy-session');
    seed(other.cookies().name, 'other', 'other-session', false, true);
    const before = new Map(fixture.jar);
    const result = await (await client(app)).auth.getUser();
    expect(result.data.user).toBeNull();
    await app.proxy(new NextRequest('http://localhost:3000/settings', { headers: { cookie: cookiesHeader() } }));
    expect(fixture.jar).toEqual(before);
    expect(calls).toHaveLength(0);
  });

  it.each(apps)('$name local logout preserves the same account in the other application', async app => {
    const other = apps.find(value => value !== app)!;
    seed(app.cookies().name, 'same-account', `${app.name}-session`, false, true);
    seed(other.cookies().name, 'same-account', `${other.name}-session`, true, true);
    const result = await (await client(app)).auth.signOut({ scope: 'local' });
    expect(result.error).toBeNull();
    expect(sessions.has(`${app.name}-session`)).toBe(false);
    expect(sessions.has(`${other.name}-session`)).toBe(true);
    // The other session can actually refresh after logout, rather than merely
    // continuing to use an access token whose refresh token was revoked.
    expect((await (await client(other)).auth.getUser()).data.user?.id).toBe('same-account');
    expect((await (await client(app)).auth.getUser()).data.user).toBeNull();
    expect(calls.filter(call => call.url.pathname.endsWith('/logout')).map(call => call.url.searchParams.get('scope'))).toEqual(['local']);
    expect([...fixture.jar.keys()].every(name => name.startsWith(other.cookies().name))).toBe(true);
  });

  it.each(apps)('$name proxy refreshes only its session and forwards the refreshed cookie to rendering', async app => {
    const other = apps.find(value => value !== app)!;
    seed(app.cookies().name, app.name, `${app.name}-session`, true, true);
    seed(other.cookies().name, other.name, `${other.name}-session`);
    const foreignValue = fixture.jar.get(other.cookies().name);
    const request = new NextRequest('http://localhost:3000/settings/profile', { headers: { cookie: cookiesHeader() } });
    const response = await app.proxy(request);
    const writes = response.cookies.getAll();
    expect(response.headers.get('location')).toBeNull();
    expect(writes.some(cookie => cookie.name === app.cookies().name && cookie.value)).toBe(true);
    expect(writes.every(cookie => cookie.name.startsWith(app.cookies().name))).toBe(true);
    expect(request.cookies.get(other.cookies().name)?.value).toBe(foreignValue);
    const forwarded = response.headers.get('x-middleware-request-cookie');
    expect(forwarded).toContain(`${app.cookies().name}=`);
    expect(forwarded).toContain(`${other.cookies().name}=${foreignValue}`);
    if (app.name === 'resident') expect(response.headers.get('x-middleware-request-x-pathname')).toBe('/settings/profile');
    expect(calls.map(call => call.url.pathname)).toEqual(['/auth/v1/token', '/auth/v1/user']);
  });
});
