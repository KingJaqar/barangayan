import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild'); const { chromium } = require('playwright');
const out = process.env.TEST_ARTIFACTS_DIR ?? path.resolve(app, '../../tmp/resident-notifications-phase4-20261028/ui');
fs.mkdirSync(out, { recursive: true });
// Real NotificationTapHandler, usePushRegistration and the tap/replay/intent rules. Synthetic: the native notification
// module (a controllable event bus with a cold-start "last response"), auth state, router and foreground state. This fixture
// does not qualify a real notification tap, channels, the OS permission prompt or a physical device (R08/R16 are I3).
const mocks = {
  '@/hooks/use-auth': 'export const useAuth=()=>window.fx.auth;',
  '@/hooks/use-app-foreground': 'export const useAppForeground=()=>window.fx.foreground;',
  'expo-router': 'export const router={push:r=>window.fx.routes.push(r)};export const useRouter=()=>router;export const usePathname=()=>window.fx.path;',
  '@/lib/push-notifications': `
    export const subscribeToNotificationTaps=onTap=>{const fx=window.fx;fx.native.subscribed++;fx.native.listeners.add(onTap);if(fx.native.last)onTap(fx.native.last);return()=>{fx.native.unsubscribed++;fx.native.listeners.delete(onTap)}};
    export const clearNotificationTap=()=>{window.fx.native.clears++;window.fx.native.last=null};
    export const registerPushToken=async(userId,options)=>{window.fx.push.push({op:'register',userId,asked:Boolean(options?.askPermission)})};
    export const unregisterPushToken=async userId=>{window.fx.push.push({op:'unregister',userId})};
    export const retryPendingPushRelease=async()=>{window.fx.push.push({op:'retry'})};
    export const onDeviceTokenChange=cb=>{const fx=window.fx;fx.native.tokenListeners.add(cb);return()=>fx.native.tokenListeners.delete(cb)};`,
};
await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {NotificationTapHandler} from '@/components/notification-tap-handler';import {usePushRegistration} from '@/hooks/use-push-registration';
function Harness(){const fx=window.fx;usePushRegistration(fx.auth.session?.user.id??null,fx.pushEnabled);return fx.handler?<NotificationTapHandler/>:null}
const r=createRoot(document.getElementById('root'));window.render=()=>r.render(<Harness key={window.fx.key}/>);`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"', __DEV__: 'false' },
  plugins: [{ name: 'adapters', setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (Object.hasOwn(mocks, args.path)) return { path: args.path, namespace: 'mock' };
      if (args.path.startsWith('@/')) { const p = path.join(app, 'src', args.path.slice(2)); return { path: p + (fs.existsSync(p + '.tsx') ? '.tsx' : '.ts') }; }
    });
    b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: app }));
  } }],
});
const options = { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE };
if (!options.executablePath && !fs.existsSync(chromium.executablePath())) options.channel = 'chrome';
const browser = await chromium.launch(options);
const errors = [], passed = [];
const INBOX = '33333333-3333-4333-8333-333333333333', INBOX2 = '55555555-5555-4555-8555-555555555555', RECORD = '44444444-4444-4444-8444-444444444444';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
  await page.setContent('<html><body><div id="root"></div></body></html>');
  const settle = () => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
  const setup = (patch = {}) => page.evaluate(patch => {
    window.fx = {
      key: Math.random(), handler: true, pushEnabled: true, foreground: true, path: '/home', routes: [], push: [],
      native: { last: null, listeners: new Set(), tokenListeners: new Set(), subscribed: 0, unsubscribed: 0, clears: 0 },
      auth: { session: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }, isLoading: false, isPasswordRecovery: false, setupRoute: { destination: 'home' }, setup: { state: 'ready', status: {} } },
    };
    Object.assign(window.fx, patch.fx ?? {});
    if (patch.last) window.fx.native.last = patch.last;
    if (patch.auth) Object.assign(window.fx.auth, patch.auth);
  }, patch);
  const emit = (id, data) => page.evaluate(({ id, data }) => [...window.fx.native.listeners].forEach(fn => fn({ id, data })), { id, data });
  const rerender = () => page.evaluate(() => window.render());
  const routes = () => page.evaluate(() => window.fx.routes);
  const push = () => page.evaluate(() => window.fx.push);
  const data = (inbox, extra = {}) => ({ v: 1, kind: 'request', id: RECORD, inbox, ...extra });
  const open = inbox => ({ pathname: '/announcements', params: { notificationId: inbox } });
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });

  // Cold start: the response exists before the handler mounts and the session is still being restored.
  await setup({ last: { id: 'cold-1', data: data(INBOX) }, auth: { isLoading: true, session: null } });
  await rerender(); await settle();
  assert.deepEqual(await routes(), [], 'a cold tap does not navigate while the session is restoring');
  await page.evaluate(() => { Object.assign(window.fx.auth, { isLoading: false, session: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } } }); window.fx.path = '/'; window.render(); });
  await settle();
  assert.deepEqual(await routes(), [], 'it keeps waiting until the root redirect has landed inside the app');
  await page.evaluate(() => { window.fx.path = '/home'; window.render(); }); await settle();
  assert.deepEqual(await routes(), [open(INBOX)]);
  for (let i = 0; i < 3; i++) { await rerender(); await settle(); }
  assert.deepEqual(await routes(), [open(INBOX)], 'repeated renders never navigate again');
  assert.equal(await page.evaluate(() => window.fx.native.clears), 1, 'the response is cleared once it is taken over');
  passed.push('cold tap waits for session restoration and the root redirect, then opens the inbox row exactly once');

  // Warm and foreground taps, replay, and unrelated payloads.
  await emit('warm-1', data(INBOX2, { kind: 'incident' })); await settle();
  assert.deepEqual(await routes(), [open(INBOX), open(INBOX2)]);
  await emit('warm-1', data(INBOX2, { kind: 'incident' })); await settle();
  assert.deepEqual(await routes(), [open(INBOX), open(INBOX2)], 'the same response delivered again is ignored');
  await emit('warm-2', { v: 2, kind: 'account', screen: 'valid_id', inbox: INBOX }); await settle();
  assert.equal((await routes()).length, 3, 'a new response opens, including an account-screen push');
  for (const [id, bad] of [['b1', undefined], ['b2', {}], ['b3', { url: 'https://example.com' }], ['b4', data(INBOX, { kind: 'route' })], ['b5', { v: 2, kind: 'account', screen: '/settings/profile', inbox: INBOX }], ['b6', data('nope')]]) { await emit(id, bad); }
  await settle();
  assert.equal((await routes()).length, 3, 'local alerts, forged and malformed payloads open nothing');
  passed.push('warm taps open once per response; replays, local alerts and forged payloads open nothing');

  // Identity: signed out, another account, setup incomplete, password recovery.
  await setup({ auth: { session: null } });
  await rerender(); await settle(); await emit('out-1', data(INBOX)); await settle();
  assert.deepEqual(await routes(), [], 'a tap received signed out opens nothing');
  await page.evaluate(() => { window.fx.auth.session = { user: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } }; window.render(); }); await settle();
  assert.deepEqual(await routes(), [], 'and is not inherited by the account that signs in next');
  await setup({ fx: { path: '/' } });
  await rerender(); await settle(); await emit('sw-1', data(INBOX)); await settle();
  assert.deepEqual(await routes(), [], 'a tap waits while the app is still redirecting');
  await page.evaluate(() => { window.fx.auth.session = { user: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } }; window.fx.path = '/home'; window.render(); }); await settle();
  assert.deepEqual(await routes(), [], 'a tap received for one account is dropped when the account changes before it opens');
  await setup({ auth: { setupRoute: { destination: 'account_setup' }, setup: { state: 'ready', status: {} } } });
  await rerender(); await settle(); await emit('su-1', data(INBOX)); await settle();
  await page.evaluate(() => { window.fx.auth.setupRoute = { destination: 'home' }; window.render(); }); await settle();
  assert.deepEqual(await routes(), [], 'a tap the app cannot open yet (setup incomplete) is dropped, not opened later');
  await setup({ auth: { isPasswordRecovery: true } });
  await rerender(); await settle(); await emit('pr-1', data(INBOX)); await settle();
  assert.deepEqual(await routes(), [], 'password recovery drops the tap');
  passed.push('signed-out, switched-account, incomplete-setup and recovery taps are dropped and never carried to another account');

  // Listener lifecycle.
  await setup(); await rerender(); await settle();
  assert.equal(await page.evaluate(() => window.fx.native.listeners.size), 1);
  await page.evaluate(() => { window.fx.handler = false; window.render(); }); await settle();
  assert.equal(await page.evaluate(() => window.fx.native.listeners.size), 0, 'unmounting removes the tap listener');
  assert.equal(await page.evaluate(() => window.fx.native.subscribed === window.fx.native.unsubscribed), true);
  passed.push('the tap listener is removed on unmount and subscribed once per mount');

  // Push registration lifecycle.
  await setup({ fx: { handler: false } });
  await rerender(); await settle();
  assert.deepEqual(await push(), [{ op: 'retry' }, { op: 'register', userId: USER_A, asked: false }], 'signed in with alerts on: one retry check and one registration, with no permission prompt');
  for (let i = 0; i < 3; i++) { await rerender(); await settle(); }
  assert.equal((await push()).length, 2, 'ordinary renders do not register again');
  await page.evaluate(() => [...window.fx.native.tokenListeners].forEach(fn => fn())); await settle();
  assert.equal((await push()).at(-1).op, 'register', 'a device-token change registers again');
  const afterToken = (await push()).length;
  await page.evaluate(() => { window.fx.foreground = false; window.render(); }); await settle();
  assert.equal(await page.evaluate(() => window.fx.native.tokenListeners.size), 0, 'the token listener is removed in the background');
  await page.evaluate(() => { window.fx.foreground = true; window.render(); }); await settle();
  assert.deepEqual((await push()).slice(afterToken).map(item => item.op), ['retry', 'register'], 'returning to the foreground heals once');
  await page.evaluate(() => { window.fx.pushEnabled = false; window.render(); }); await settle();
  const afterOff = (await push()).length;
  await page.evaluate(() => { window.fx.auth.session = null; window.render(); }); await settle();
  assert.deepEqual((await push()).slice(afterOff), [{ op: 'unregister', userId: USER_A }], 'signing out releases that resident\'s token, even with alerts already off');
  assert.equal(await page.evaluate(() => window.fx.native.tokenListeners.size), 0);
  await page.evaluate(() => { window.fx.pushEnabled = true; window.fx.auth.session = { user: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } }; window.render(); }); await settle();
  const afterB = (await push()).slice(afterOff + 1);
  assert.deepEqual(afterB, [{ op: 'register', userId: USER_B, asked: false }]);
  await page.evaluate(() => { window.fx.auth.session = { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }; window.render(); }); await settle();
  assert.deepEqual((await push()).slice(afterOff + 2), [{ op: 'unregister', userId: USER_B }, { op: 'register', userId: USER_A, asked: false }], 'an account switch queues the previous release ahead of the next registration');
  passed.push('registration runs once per account/foreground/token change; listeners are removed; sign-out and switch release the previous token first; no call asks for permission');

  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed, diagnostics: errors }, null, 2));
  console.log(JSON.stringify({ passed, errors }, null, 2));
} catch (error) {
  const pages = browser.contexts().flatMap(context => context.pages());
  if (pages[0]) fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ fx: await pages[0].evaluate(() => ({ routes: window.fx?.routes, push: window.fx?.push })).catch(() => null), errors }, null, 2));
  throw error;
} finally { await browser.close(); }
