// Real browser + production Supabase browser factories and resident logout helper.
// HTTP Auth replies are synthetic; this does not verify a hosted Supabase deployment.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../../..');
const output = path.join(root, 'tmp/auth-session-isolation');
const sessions = new Map();
const calls = [];
const bundles = {};
let sequence = 0;
const report = { checks: [], errors: [], limitations: ['Synthetic Auth HTTP replies; no hosted Auth, database RLS execution, or external OAuth provider.'] };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function makeSession(userId, id) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, session_id: id, exp: expires })}.${encode('synthetic')}`,
    refresh_token: id, expires_at: expires, expires_in: 3600, token_type: 'bearer',
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email: `${userId}@example.test`, user_metadata: userId.startsWith('chunk') ? { padding: 'x'.repeat(2600) } : {} },
  };
}
async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', request.headers.origin ?? '*');
  response.setHeader('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-client-info,x-supabase-api-version');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('X-Supabase-Api-Version', '2024-01-01');
  response.setHeader('Access-Control-Expose-Headers', 'X-Supabase-Api-Version');
  if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
  const url = new URL(request.url, 'http://fixture.test');
  const send = (value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
  if (url.pathname.startsWith('/auth/v1/')) {
    calls.push({ path: url.pathname, grant: url.searchParams.get('grant_type'), scope: url.searchParams.get('scope') });
    let body = '';
    for await (const chunk of request) body += chunk;
    const payload = body ? JSON.parse(body) : {};
    if (url.pathname.endsWith('/token')) {
      if (url.searchParams.get('grant_type') === 'password') {
        if (payload.password !== 'fixture-password') return send({ msg: 'Invalid login credentials', code: 'invalid_credentials' }, 400);
        const userId = payload.email.split('@')[0], id = `synthetic-${++sequence}`;
        sessions.set(id, userId); return send(makeSession(userId, id));
      }
      const userId = sessions.get(payload.refresh_token);
      return userId ? send(makeSession(userId, payload.refresh_token)) : send({ msg: 'Refresh token revoked', code: 'refresh_token_not_found' }, 400);
    }
    const claims = JSON.parse(Buffer.from(request.headers.authorization.split('.')[1], 'base64url').toString());
    if (url.pathname.endsWith('/user')) return send(makeSession(claims.sub, claims.session_id).user);
    if (url.pathname.endsWith('/logout')) {
      if (url.searchParams.get('scope') === 'global') {
        for (const [id, userId] of sessions) if (userId === claims.sub) sessions.delete(id);
      } else sessions.delete(claims.session_id);
      response.writeHead(204).end(); return;
    }
    throw new Error(`Unexpected Auth request: ${url.pathname}`);
  }
  if (url.pathname.endsWith('.js')) {
    response.writeHead(200, { 'Content-Type': 'text/javascript' }).end(bundles[url.pathname.includes('admin') ? 'admin' : 'resident']); return;
  }
  const app = url.pathname.includes('admin') ? 'admin' : 'resident';
  response.writeHead(200, { 'Content-Type': 'text/html' }).end(`<!doctype html><title>${app} session fixture</title><script src="/${app}.js"></script>`);
}
const servers = [createServer((req, res) => { handler(req, res).catch(error => { report.errors.push(error.message); res.writeHead(500).end(); }); }), createServer((req, res) => { handler(req, res).catch(error => { report.errors.push(error.message); res.writeHead(500).end(); }); })];
let browser;
try {
  for (const server of servers) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); }
  const origins = servers.map(server => `http://127.0.0.1:${server.address().port}`);
  for (const app of ['admin', 'resident']) {
    const appPath = path.join(root, `apps/${app === 'admin' ? 'admin' : 'resident'}-web`);
    const contents = `
      import { createSupabaseBrowserClient } from './src/lib/supabase/client';
      ${app === 'resident' ? "import { signOutBrowser } from './src/lib/auth/sign-out';" : ''}
      const client = createSupabaseBrowserClient();
      const events = [];
      client.auth.onAuthStateChange((event, session) => events.push({ event, user: session?.user.id ?? null }));
      window.sessionFixture = {
        events, client,
        login: (email, password = 'fixture-password') => client.auth.signInWithPassword({ email, password }),
        logout: () => ${app === 'resident' ? 'signOutBrowser()' : "client.auth.signOut({ scope: 'local' })"},
        read: async () => { const { data, error } = await client.auth.getSession(); if(error) throw error; return data.session ? { user: data.session.user.id, id: data.session.refresh_token } : null; },
        refresh: () => client.auth.refreshSession(),
        oauth: () => client.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true, redirectTo: location.origin + '/auth/callback' } }),
        singleton: () => client === createSupabaseBrowserClient(),
      };
    `;
    const result = await build({ stdin: { contents, resolveDir: appPath, loader: 'ts' }, bundle: true, write: false, platform: 'browser', format: 'iife', tsconfig: path.join(appPath, 'tsconfig.json'),
      define: { 'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(origins[0]), 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"public-fixture-key"', 'process.env.NODE_ENV': '"test"' },
    });
    bundles[app] = result.outputFiles[0].text;
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  report.browser = browser.version();
  for (const topology of ['same-origin', 'different-ports']) {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.authChannels = [];
      const Native = window.BroadcastChannel;
      window.BroadcastChannel = class extends Native { constructor(name) { super(name); window.authChannels.push(name); } };
    });
    const pages = {};
    const legacy = `base64-${encode(makeSession('legacy', 'legacy-session'))}`;
    await context.addCookies([{ name: 'sb-127-auth-token', value: legacy, url: origins[0] }]);
    for (const name of ['adminA', 'adminB', 'residentA', 'residentB']) {
      const page = await context.newPage(); pages[name] = page;
      page.on('pageerror', error => report.errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && !message.text().includes('400 (Bad Request)')) report.errors.push(message.text()); });
      const app = name.startsWith('admin') ? 'admin' : 'resident';
      await page.goto(`${topology === 'different-ports' && app === 'resident' ? origins[1] : origins[0]}/${app}`);
      await page.waitForFunction(() => Boolean(window.sessionFixture));
      assert.equal(await page.evaluate(() => window.sessionFixture.singleton()), true);
      assert.equal(await page.evaluate(() => window.sessionFixture.read()), null);
    }
    const read = name => pages[name].evaluate(() => window.sessionFixture.read());
    const login = async (name, userId) => assert.equal((await pages[name].evaluate(userId => window.sessionFixture.login(`${userId}@example.test`), userId)).error, null);
    const tabsHave = async (app, userId) => {
      for (const suffix of ['A', 'B']) {
        await pages[app + suffix].waitForFunction(async userId => (await window.sessionFixture.read())?.user === userId || (!userId && await window.sessionFixture.read() === null), userId);
      }
    };
    const refresh = async name => assert.equal((await pages[name].evaluate(() => window.sessionFixture.refresh())).error, null);
    const residentEventCount = await pages.residentB.evaluate(() => window.sessionFixture.events.length);
    await login('adminA', 'alpha'); await tabsHave('admin', 'alpha'); await tabsHave('resident', null);
    await pages.adminB.waitForFunction(() => window.sessionFixture.events.some(item => item.event === 'SIGNED_IN' && item.user === 'alpha'));
    assert.equal(await pages.residentB.evaluate(() => window.sessionFixture.events.length), residentEventCount);
    await login('residentA', 'bravo'); await tabsHave('resident', 'bravo'); await tabsHave('admin', 'alpha');
    await pages.residentB.waitForFunction(() => window.sessionFixture.events.some(item => item.event === 'SIGNED_IN' && item.user === 'bravo'));
    const adminSession = await read('adminA'), residentSession = await read('residentA');
    assert.notEqual(adminSession.id, residentSession.id);
    for (const page of Object.values(pages)) { await page.reload(); await page.waitForFunction(() => Boolean(window.sessionFixture)); }
    await tabsHave('admin', 'alpha'); await tabsHave('resident', 'bravo');
    assert.deepEqual(await read('adminB'), adminSession); assert.deepEqual(await read('residentB'), residentSession);
    assert.equal(await pages.residentA.evaluate(() => window.sessionFixture.logout()), 'signed-out');
    await pages.residentB.waitForFunction(() => window.sessionFixture.events.some(item => item.event === 'SIGNED_OUT'));
    await tabsHave('resident', null); await tabsHave('admin', 'alpha'); await refresh('adminA');
    await login('residentA', 'alpha'); await tabsHave('resident', 'alpha');
    const sharedAccountResident = await read('residentA');
    assert.notEqual(sharedAccountResident.id, (await read('adminA')).id);
    assert.equal((await pages.adminA.evaluate(() => window.sessionFixture.logout())).error, null);
    await tabsHave('admin', null); await tabsHave('resident', 'alpha'); await refresh('residentA');
    await login('adminA', 'alpha'); await tabsHave('admin', 'alpha');
    assert.equal(await pages.residentA.evaluate(() => window.sessionFixture.logout()), 'signed-out');
    await tabsHave('resident', null); await refresh('adminA');
    const failed = await pages.residentA.evaluate(async () => {
      const result = await window.sessionFixture.login('alpha@example.test', 'wrong');
      return { error: result.error && { code: result.error.code, message: result.error.message } };
    });
    assert.equal(failed.error.code, 'invalid_credentials'); await tabsHave('resident', null); await tabsHave('admin', 'alpha');
    // PKCE verifier cookies and broadcasts use the same app-specific storage key.
    for (const app of ['admin', 'resident']) assert.equal((await pages[app + 'A'].evaluate(() => window.sessionFixture.oauth())).error, null);
    const cookies = await context.cookies();
    for (const app of ['admin', 'resident']) {
      assert(cookies.some(cookie => cookie.name.startsWith(`sb-127-${app}-web-auth-token`) && cookie.name.endsWith('-code-verifier')));
      assert.deepEqual(await pages[app + 'A'].evaluate(() => window.authChannels), [`sb-127-${app}-web-auth-token`]);
    }
    await login('adminA', 'chunk-admin'); await login('residentA', 'chunk-resident');
    await tabsHave('admin', 'chunk-admin'); await tabsHave('resident', 'chunk-resident');
    assert((await context.cookies()).some(cookie => cookie.name === 'sb-127-admin-web-auth-token.1'));
    assert((await context.cookies()).some(cookie => cookie.name === 'sb-127-resident-web-auth-token.1'));
    await pages.adminA.evaluate(() => window.sessionFixture.logout());
    await tabsHave('admin', null); await tabsHave('resident', 'chunk-resident');
    for (const page of Object.values(pages)) { await page.reload(); await page.waitForFunction(() => Boolean(window.sessionFixture)); }
    await tabsHave('admin', null); await tabsHave('resident', 'chunk-resident'); await refresh('residentB');
    assert.equal((await context.cookies()).find(cookie => cookie.name === 'sb-127-auth-token')?.value, legacy);
    report.checks.push(`${topology}: independent login/logout, distinct and same accounts, four tabs, reloads, refresh after peer logout, failed login, PKCE storage, scoped broadcasts, chunked cookies, legacy cookie ignored`);
    await context.close();
  }
  assert(calls.filter(call => call.path.endsWith('/logout')).every(call => call.scope === 'local'));
  assert(calls.length < 80, `Unexpected Auth request count: ${calls.length}`);
  assert.deepEqual(report.errors, []);
  report.authRequests = calls.length;
  report.logoutRequests = calls.filter(call => call.path.endsWith('/logout')).length;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await browser?.close();
  for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2));
}
