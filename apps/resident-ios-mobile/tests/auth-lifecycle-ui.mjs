import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild');
const { chromium } = require('playwright');
const src = path.join(app, 'src').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? path.resolve(app, '../../tmp/resident-ios-phase4-auth-ui');
fs.mkdirSync(out, { recursive: true });

const ui = `import React from 'react';
export const Screen=({children})=><main>{children}</main>, Card=({children})=><section>{children}</section>, Body=({children})=><p>{children}</p>;
export const Action=({label,onPress,disabled})=><button disabled={disabled} onClick={onPress}>{label}</button>;
export const Field=({label,value,onChangeText,editable=true,error})=><label>{label}<input aria-label={label} value={value} disabled={!editable} onChange={e=>onChangeText?.(e.target.value)}/>{error&&<span role="alert">{error}</span>}</label>;
export const Notice=({message})=><p role="status">{message}</p>,StatusBadge=({label})=><p>{label}</p>,Loading=({label})=><p>{label}</p>;
export const useDiscardGuard=()=>{};`;
const fixtures = {
  'expo-router': `export const useRouter=()=>window.fx.router;export const useFocusEffect=()=>{};`,
  'react-native': `export const AppState={currentState:'active',addEventListener:(event,callback)=>{window.fx.lifecycle.add(callback);return{remove:()=>window.fx.lifecycle.delete(callback)}}};`,
};

async function bundle(name, entry, mocks) {
  const outfile = path.join(out, `${name}.js`);
  await build({ stdin: { contents: entry, resolveDir: app, loader: 'tsx' }, bundle: true, format: 'iife', outfile, jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'controlled-auth-boundaries', setup(builder) {
      const values = { ...fixtures, ...mocks };
      builder.onResolve({ filter: /.*/ }, (args) => args.path in values ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ contents: values[args.path], loader: 'tsx', resolveDir: app }));
    } }] });
  return outfile;
}
const runtimeBundle = await bundle('runtime', `import React from 'react';import{createRoot}from'react-dom/client';import{ResidentProvider,useResident}from'${src}/lib/runtime.tsx';
function Probe(){window.fx.runtime=useResident();return <div id="account">{window.fx.runtime.session?.user.id??'guest'}:{window.fx.runtime.notice??''}</div>}
const root=createRoot(document.getElementById('root'));root.render(<ResidentProvider config={window.fx.config} fallback={({error})=><div id="fallback">{error?'error':'loading'}</div>}><Probe/></ResidentProvider>);window.fx.unmount=()=>root.unmount();`, {
  '@supabase/supabase-js': `export const createClient=()=>window.fx.client;`,
  '@react-native-async-storage/async-storage': `export default{getItem:async key=>window.fx.storage.get(key)??null,setItem:async(key,value)=>{window.fx.storage.set(key,value);window.fx.logs.push('store:'+value)},removeItem:async key=>{window.fx.storage.delete(key)},multiSet:async pairs=>pairs.forEach(([key,value])=>window.fx.storage.set(key,value))};`,
  '../auth/native-pkce-crypto': '',
  '../auth/auth-flow': `export const AuthFlowProvider=({children})=>children;`,
  '../auth/apple-authorization': `export const clearAppleAuthorizationCode=()=>window.fx.logs.push('apple-clear');`,
  '../auth/hints': `export const clearAuthHints=async()=>window.fx.logs.push('auth-clear');`,
  '../auth/recovery-flow': `export const RECOVERY_HINT_MS=3600000;`,
  '../features/notifications/logout': `export const releaseDeviceForLogout=async()=>{window.fx.logs.push('release-device');await window.fx.releaseDevice()};`,
  './drafts': `export const finishPendingDraftPurge=async()=>{},purgeAllDrafts=async()=>window.fx.logs.push('purge-all'),purgeOtherAccountDrafts=async()=>{};`,
  './private-files': `export const purgePrivateFiles=()=>window.fx.logs.push('purge-files');`,
  './secure-storage': `export const newSessionStorage=()=>({disable:()=>{},removeItem:async()=>{},getItem:async()=>null,setItem:async()=>{}});`,
});
const screenMocks = {
  '../../../auth/auth-flow': `export const useAuthFlow=()=>window.fx.flow;`,
  '../../components/require-resident': `export const RequireResident=({children})=>children;`,
  '../../../components/require-resident': `export const RequireResident=({children})=>children;`,
  '../../../components/ui': ui,
  '../../components/ui': ui,
  '../../../features/auth/password-step': `export const emptyPasswordDraft={password:'',confirmPassword:'',uncertain:false};export const PasswordStep=()=>null;`,
  '../../../features/auth/parts': `export const ReauthenticateButtons=()=>null;`,
  './parts': `export const EmergencyEntry=()=>null;`,
  '../../../lib/runtime': `export const useResident=()=>window.fx.runtime;`,
  '../../lib/runtime': `export const useResident=()=>window.fx.runtime;`,
};
const screenBundle = await bundle('screens', `import React,{useState} from'react';import{createRoot}from'react-dom/client';import Password from'${src}/app/(tabs)/settings/change-password.tsx';import Email from'${src}/features/auth/email-verification-screen.tsx';import{PasswordStep,emptyPasswordDraft}from'${src}/features/auth/password-step.tsx';
function Setup(){const[draft,setDraft]=useState(emptyPasswordDraft);return <PasswordStep required draft={draft} onDraftChange={setDraft} onSaved={async()=>{}} onRecover={()=>{}}/>}
const root=createRoot(document.getElementById('root'));window.fx.render=()=>root.render(window.fx.screen==='email'?<Email/>:window.fx.screen==='setup'?<Setup/>:<Password/>);window.fx.render();window.fx.unmount=()=>root.unmount();`, screenMocks);

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
const passed = [];
try {
  // Real React providers/screens with controlled adapters. No request can reach a hosted service.
  await page.route('**/*', (route) => route.abort());
  await page.setContent('<div id="root"></div>');
  await page.evaluate(() => {
    window.fx = { config: { url: 'https://auth.test', anonKey: 'sb_publishable_fixture', barangayId: 'tenant', environment: 'development' },
      storage: new Map(), logs: [], lifecycle: new Set(), session: null, callbacks: new Set(), hold: false, pending: [], releaseDevice: async () => {} };
    const fx = window.fx;
    fx.user = (id) => ({ id, email: `${id}@example.test` });
    fx.profile = (id) => ({ id, role: 'resident', deleted_at: null, barangay_id: 'tenant' });
    fx.profileRead = (id) => fx.hold ? new Promise((resolve, reject) => fx.pending.push({ id, resolve, reject })) : Promise.resolve({ data: fx.profile(id), error: null });
    fx.client = { auth: {
      getSession: async () => ({ data: { session: fx.session }, error: null }),
      getUser: async () => ({ data: { user: fx.session?.user }, error: null }),
      onAuthStateChange: (callback) => { fx.callbacks.add(callback); return { data: { subscription: { unsubscribe: () => fx.callbacks.delete(callback) } } }; },
      startAutoRefresh: async () => {}, stopAutoRefresh: async () => {},
    }, from: () => ({ select: () => ({ eq: (column, id) => ({ maybeSingle: () => fx.profileRead(id) }) }) }), removeAllChannels: async () => {} };
    fx.emit = (id) => { fx.session = id ? { user: fx.user(id), access_token: 'fixture' } : null; fx.callbacks.forEach((cb) => cb(id ? 'SIGNED_IN' : 'SIGNED_OUT', fx.session)); };
    window.fetch = async () => new Response('{}', { status: 200 });
  });
  await page.addScriptTag({ path: runtimeBundle });
  await page.locator('#account').filter({ hasText: 'guest' }).waitFor();
  await page.evaluate(() => window.fx.emit('a'));
  await page.waitForFunction(() => document.getElementById('account')?.textContent === 'a:');
  for (const failure of ['denied', 'network', 'refresh']) {
    await page.evaluate((kind) => {
      window.fx.hold = true;
      if (kind === 'refresh') void window.fx.runtime.refreshProfile(); else window.fx.emit('a');
    }, failure);
    await page.waitForFunction(() => window.fx.pending.length === 1);
    await page.evaluate(() => { window.fx.hold = false; window.fx.emit('b'); });
    await page.waitForFunction(() => document.getElementById('account')?.textContent === 'b:');
    await page.evaluate((kind) => {
      const pending = window.fx.pending.shift();
      if (kind === 'network') pending.reject(new Error('old transport failed'));
      else pending.resolve({ data: { ...window.fx.profile('a'), role: 'admin' }, error: null });
    }, failure);
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 30)));
    assert.equal(await page.locator('#account').textContent(), 'b:');
    await page.evaluate(() => window.fx.emit('a'));
    await page.waitForFunction(() => document.getElementById('account')?.textContent === 'a:');
    passed.push(`new account survives stale ${failure} result`);
  }
  const beforePurge = await page.evaluate(() => window.fx.logs.filter((entry) => entry === 'purge-all').length);
  await page.evaluate(() => window.fx.emit(null));
  await page.waitForFunction(() => document.getElementById('account')?.textContent === 'guest:session-ended');
  assert.ok(await page.evaluate((count) => window.fx.logs.filter((entry) => entry === 'purge-all').length > count, beforePurge));
  assert.ok(await page.evaluate(() => window.fx.logs.includes('auth-clear') && window.fx.logs.includes('apple-clear') && window.fx.logs.includes('store:closed')));
  passed.push('unexpected sign-out performs tombstoned private cleanup and displays session-ended notice');
  await page.evaluate(() => window.fx.unmount());
  assert.equal(await page.evaluate(() => window.fx.callbacks.size + window.fx.lifecycle.size), 0);
  passed.push('provider removes auth and AppState subscriptions on unmount');

  await page.evaluate(() => {
    const fx = window.fx;
    fx.router = { replace: () => {}, back: () => {} };
    fx.updates = 0; fx.reauths = 0;
    fx.runtime = { session: { user: fx.user('a') }, profile: { ...fx.profile('a'), email: 'a@example.test', email_verification_status: 'unverified' }, setRecovery: async () => {},
      client: { auth: { signInWithPassword: async () => { fx.reauths++; return { data: { user: fx.user('a') }, error: null }; },
        getSession: async () => ({ data: { session: fx.runtime.session }, error: null }),
        getUser: async () => ({ data: { user: fx.runtime.session.user }, error: null }),
        updateUser: async () => { fx.updates++; throw new TypeError('response lost'); } },
        functions: { invoke: async () => ({ data: { status: 'verified' }, error: null }) } },
      refreshProfile: async () => { throw new Error('status unavailable'); },
    };
    fx.flow = { setup: { state: 'ready', status: { passwordSet: true } }, refreshSetup: async () => {}, refreshError: null };
  });
  await page.addScriptTag({ path: screenBundle });
  await page.getByRole('textbox', { name: 'Current password', exact: true }).fill('OldPass1!');
  await page.getByRole('textbox', { name: 'New password', exact: true }).fill('NewPass2!');
  await page.getByRole('textbox', { name: 'Confirm new password', exact: true }).fill('NewPass2!');
  await page.getByRole('button', { name: 'Change password', exact: true }).dblclick();
  await page.getByText('The password change could not be confirmed.', { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => window.fx.updates), 1);
  assert.equal(await page.getByRole('button', { name: 'Change password', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Confirm access through password recovery', exact: true }).waitFor();
  passed.push('Settings password double activation writes once; unknown result disables repeat write and offers recovery');

  await page.evaluate(() => { window.fx.screen = 'email'; window.fx.render(); });
  await page.getByRole('button', { name: 'Send code', exact: true }).click();
  await page.getByText('The code was accepted, but your saved status could not be refreshed.', { exact: false }).waitFor();
  await page.evaluate(() => { window.fx.runtime.refreshProfile = async () => {}; window.fx.render(); });
  await page.getByRole('button', { name: 'Check saved verification status', exact: true }).click();
  await page.getByRole('button', { name: 'Check saved verification status', exact: true }).waitFor({ state: 'detached' });
  assert.equal(await page.getByText('The code was accepted, but your saved status could not be refreshed.', { exact: false }).count(), 0);
  passed.push('accepted email code exposes status refresh failure and its retry');
  await page.evaluate(() => { window.fx.runtime.session.user.email = 'changed@example.test'; window.fx.render(); });
  await page.getByText('Save your sign-in email in your profile before verifying it.').waitFor();
  assert.equal(await page.getByText('Email verified', { exact: true }).count(), 0);
  passed.push('Auth email change invalidates the old email form and verification display');
  await page.evaluate(() => {
    window.fx.screen = 'setup';
    window.fx.runtime.client.rpc = () => ({ abortSignal: async () => ({ data: { contractVersion: 2, registrationOrigin: 'email_otp', profileComplete: true, passwordSet: false,
      identityProviders: ['email'], hasGoogleIdentity: false, hasAppleIdentity: false, emailIsPrivateRelay: false }, error: null }) });
    window.fx.runtime.client.auth.updateUser = async () => ({ data: {}, error: { name: 'AuthApiError', status: 503, code: 'unexpected_failure' } });
    window.fx.render();
  });
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('NewPass2!');
  await page.getByRole('textbox', { name: 'Confirm password', exact: true }).fill('NewPass2!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('button', { name: 'Check whether this password was saved', exact: true }).waitFor();
  passed.push('first-password HTTP 503 enters exact-password reconciliation instead of repeating a write');
  await page.evaluate(() => window.fx.unmount());
  assert.deepEqual(errors, []);
  const result = { passed, errors, evidence: 'Real React components; deterministic local adapters. No hosted Auth/provider or native device evidence.' };
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
