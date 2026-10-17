// Run from the repository root: node apps/resident-web/tests/toast-coverage-browser.mjs
// Uses actual components/adapter/host and synthetic Auth, server-action and data replies.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const output = path.resolve('plans/evidence/resident-web-toast-coverage/phases-2-3');
fs.mkdirSync(output, { recursive: true });
const mocks = {
  'next/link': `import React from 'react'; export default function Link({children,href,...props}){return <a href={href} {...props}>{children}</a>}`,
  'next/image': `import React from 'react'; export default function Image(props){return <img {...props}/>}`,
  'next/font/local': `export default ()=>({className:''});`,
  'next/navigation': `const router={push:href=>history.pushState({},'',href),replace:href=>history.replaceState({},'',href),refresh:()=>{window.__fx.refreshes++}};export const useRouter=()=>router;export const useSearchParams=()=>new URLSearchParams(location.search);`,
  '@/app/(resident)/settings/email-verification/actions': `export async function syncResidentSignInEmail(){window.__fx.calls.push({action:'sync-email'});await window.__fx.wait('sync-email');return window.__fx.syncResult??{ok:true,email:window.__fx.ownerEmail,pendingEmail:'',status:'verified'};}`,
  './actions': `export async function syncResidentSignInEmail(){window.__fx.calls.push({action:'sync-email'});await window.__fx.wait('sync-email');return window.__fx.syncResult??{ok:true,email:window.__fx.ownerEmail,pendingEmail:'',status:'verified'};}`,
  '@/hooks/use-announcements': `export const useAnnouncements=()=>({announcements:[],isInitialLoading:false,isRefreshing:false,isReady:true,error:null,refetch(){}});`,
  '@/components/auth/registration-map': `export function RegistrationMap(){return null;}`,
  '@/lib/supabase/client': `
    import {createClient,AuthApiError,FunctionsHttpError} from '@supabase/supabase-js';
    const listeners=new Set(),fx=window.__fx;
    fx.switchOwner=id=>{fx.owner=id;fx.renderOwner?.(id);for(const cb of listeners)cb(id?'SIGNED_IN':'SIGNED_OUT',id?{user:{id,email:fx.ownerEmail}}:null)};
    const user=()=>({id:fx.owner??'resident-a',email:fx.ownerEmail,is_anonymous:false});
    async function authResult(action){fx.calls.push({action});await fx.wait(action);if(fx.authMode==='throw')throw new TypeError('synthetic connection loss');return {data:{user:user(),url:null},error:fx.authMode==='rejected'?new AuthApiError('internal provider detail',400,'invalid_credentials'):fx.authMode==='rate-limit'?new AuthApiError('internal rate detail',429,'over_request_rate_limit'):null}}
    const readClient=createClient('https://fixture.supabase.test','public-fixture-key',{accessToken:async()=>'synthetic',db:{retry:false},global:{fetch:async(input,init)=>{
      const url=new URL(String(input)),table=url.pathname.split('/').pop(),method=init?.method??'GET',write=method!=='GET';
      const operation=method==='POST'?'upsert':method==='PATCH'?'update':method==='DELETE'?'delete':'select';
      const payload=init?.body?JSON.parse(String(init.body)):undefined,headers=new Headers(init?.headers);
      fx.calls.push({table,operation,payload,prefer:headers.get('prefer'),select:url.searchParams.get('select'),filters:[...url.searchParams]});
      await fx.wait(write?'write':'read');
      if(write&&(fx.dbMode==='throw'||fx.dbMode==='uncertain'))throw new TypeError('synthetic lost reply');
      const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
      if(write&&fx.dbMode==='rejected')return reply({message:'internal SQL detail',code:'42501'},403);
      if(!write&&fx.readFails)return reply({message:'read failed'},503);
      if(!write)return reply(table==='announcements'?[{id:'announcement-a'}]:table==='announcement_reads'?fx.announcementRead?[{announcement_id:'announcement-a'}]:[]:[{id:'incident-a',status:'resolved',resolved_read_at:fx.incidentRead?'2026-10-15T00:00:00Z':null}]);
      if(fx.dbMode==='no-rows')return reply([]);
      let data;
      if(table==='announcement_reads'){
        if(operation==='delete'){data=fx.announcementRead?[{announcement_id:'announcement-a'}]:[];fx.announcementRead=false}
        else{data=(Array.isArray(payload)?payload:[payload]).map(row=>({announcement_id:row.announcement_id}));fx.announcementRead=true}
      }else{fx.incidentRead=payload.resolved_read_at!==null;data=[{id:'incident-a',status:'resolved',resolved_read_at:payload.resolved_read_at}]}
      if(fx.dbMode==='wrong-row')data=table==='announcement_reads'?[{announcement_id:'other'}]:[{id:'other',status:'resolved',resolved_read_at:null}];
      if(fx.dbMode==='missing-state'&&table==='incidents')data=[{id:'incident-a',status:'resolved'}];
      return reply(headers.get('prefer')?.includes('return=representation')?data:null);
    }}});
    function query(table){let write=false,operation='select',payload;const q={select(){return q},eq(){return q},is(){return q},abortSignal(){return q},single(){return Promise.resolve(table==='barangay_localities'?{data:{barangay_id:'b1180000-0000-4000-8000-000000000001',display_name:'Fixture barangay',city:'Fixture city',province:'Fixture province'},error:null}:{data:{id:'b1180000-0000-4000-8000-000000000001',boundary:null},error:null})},update(value){write=true;operation='update';payload=value;return q},upsert(value){write=true;operation='upsert';payload=value;return q},delete(){write=true;operation='delete';return q},then(resolve,reject){return (async()=>{fx.calls.push({table,operation,payload});await fx.wait(write?'write':'read');if(write&&fx.dbMode==='throw')throw new TypeError('synthetic lost reply');if(write&&fx.dbMode==='rejected')return{data:null,error:{message:'internal SQL detail'},status:403};if(write&&fx.dbMode==='uncertain')return{data:null,error:{message:'transport detail'},status:0};if(!write&&fx.readFails)return{data:null,error:{message:'read failed'},status:503};if(write&&table==='announcement_reads')fx.announcementRead=operation!=='delete';return{data:write?null:table==='announcements'?[{id:'announcement-a'}]:table==='announcement_reads'?fx.announcementRead?[{announcement_id:'announcement-a'}]:[]:table==='incidents'?[{status:'resolved',resolved_read_at:null}]:[],error:null,status:write?204:200}})().then(resolve,reject)}};return q}
    const client={auth:{onAuthStateChange(cb){listeners.add(cb);queueMicrotask(()=>{if(listeners.has(cb))cb('INITIAL_SESSION',fx.owner?{user:user()}:null)});return{data:{subscription:{unsubscribe:()=>listeners.delete(cb)}}}},getUser:async()=>({data:{user:user()},error:null}),async signUp(){fx.calls.push({action:'sign-up'});await fx.wait('sign-up');const result={data:{user:user(),session:fx.confirmationRequired?null:{user:user()}},error:null};if(!fx.confirmationRequired)fx.switchOwner(user().id);return result;},signInWithOAuth:()=>authResult('google'),linkIdentity:()=>authResult('google-link'),signInWithPassword:()=>authResult('reauth'),resetPasswordForEmail:()=>authResult('send-code'),verifyOtp:()=>authResult('verify-code'),updateUser:()=>authResult('auth-update'),async signOut(){fx.calls.push({action:'sign-out'});if(fx.logoutFails){document.cookie='sb-fixture-resident-web-auth-token=synthetic; path=/';return{error:new Error('synthetic revoke failure')}}document.cookie='sb-fixture-resident-web-auth-token=; max-age=0; path=/';fx.switchOwner(null);return{error:null}}},from:table=>fx.screen==='reads'||fx.screen==='bulk'?readClient.from(table):query(table),functions:{async invoke(name,{body}={}){fx.calls.push({action:name,body});await fx.wait(name);if(fx.functionMode==='throw')throw new TypeError('synthetic lost reply');if(fx.functionMode==='rejected')return{data:null,error:new FunctionsHttpError(new Response(JSON.stringify({error:'This code is invalid or expired.'}),{status:400}))};return{data:{status:body?.action==='send'?'pending':'verified'},error:null}}},channel(){const q={on(){return q},subscribe(){return q}};return q},removeChannel(){}};
    export const createSupabaseBrowserClient=()=>client;
  `,
};
const bundle = await build({ entryPoints: [path.join(import.meta.dirname, 'toast-coverage-fixture.jsx')], bundle: true, write: false, outdir: 'fixture', jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'),
  alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '"https://fixture.supabase.test"', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"public-fixture-key"' },
  plugins: [{ name: 'synthetic-boundaries', setup(builder) {
    builder.onResolve({ filter: /^(next\/|@\/|\.\/actions$)/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'fixture' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});
const callbackMocks = {
  '@/lib/supabase/server': `export const createSupabaseServerClient=async()=>({auth:{getUser:async()=>({data:{user:globalThis.__callbackFx.before},error:null}),exchangeCodeForSession:async()=>({data:{user:globalThis.__callbackFx.exchanged??globalThis.__callbackFx.before},error:globalThis.__callbackFx.exchangeError?new Error('synthetic exchange failure'):null})}});`,
  '@/app/(resident)/settings/email-verification/actions': `export const syncResidentSignInEmail=async()=>globalThis.__callbackFx.synced;`,
  '@barangayan/shared': `export const ensureGoogleResidentProfile=async()=>{};export const needsResidentProfile=async()=>false;export const residentActionNeedsProfile=()=>false;export const residentCompletionDestination=()=>'/complete-profile';export const safeResidentRedirect=()=>'/home';`,
};
const callbackBundle = await build({ stdin: { contents: "export {GET as google} from './src/app/auth/callback/route';export {GET as email} from './src/app/auth/email-change/route';", resolveDir: app }, bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', tsconfig: path.join(app, 'tsconfig.json'), plugins: [{ name: 'callback-services', setup(builder) {
  builder.onResolve({ filter: /^(?:@\/|@barangayan\/shared$)/ }, args => Object.hasOwn(callbackMocks, args.path) ? { path: args.path, namespace: 'callback' } : undefined);
  builder.onLoad({ filter: /.*/, namespace: 'callback' }, args => ({ contents: callbackMocks[args.path], loader: 'js', resolveDir: app }));
} }] });
const callbackPath = path.resolve('tmp/toast-phases23-completion/callback-fixture.cjs');
fs.mkdirSync(path.dirname(callbackPath), { recursive: true });
fs.writeFileSync(callbackPath, callbackBundle.outputFiles[0].text);
const callbacks = require(callbackPath);
const globals = path.join(app, 'src/app/globals.css');
const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(globals, 'utf8'), { from: globals })).css + (bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '');
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
const report = { passed: false, checks: [], pageErrors: [], consoleErrors: [], warnings: [], limitations: ['Actual callback handlers, client components, Supabase/PostgREST writes, adapter and host with synthetic Auth/database/server-action outcomes. No live provider, real email, deletion or hosted integration was exercised.', 'Account appearance writes retain the permitted information fallback; real screen-reader and hosted integration checks remain manual.'] };
const server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url, origin);
    if (url.pathname === '/auth/callback' || url.pathname === '/auth/email-change') {
      const result = await (url.pathname === '/auth/callback' ? callbacks.google : callbacks.email)(new Request(url.href));
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(await result.text());
      return;
    }
    if (url.pathname.endsWith('.js')) { response.writeHead(200, { 'Content-Type': 'text/javascript' }).end(js); return; }
    if (url.pathname.endsWith('.css')) { response.writeHead(200, { 'Content-Type': 'text/css' }).end(css); return; }
    if (url.pathname.endsWith('.png')) { response.writeHead(200, { 'Content-Type': 'image/png' }).end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a00kAAAAASUVORK5CYII=', 'base64')); return; }
    response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><html lang="en"><title>Toast coverage fixture</title><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script></html>');
  })().catch(error => { report.pageErrors.push(error.message); response.writeHead(500).end(); });
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 950 }, timezoneId: 'Asia/Manila' });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); if (message.type() === 'warning') report.warnings.push(message.text()); });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).hostname !== '127.0.0.1') {
      report.pageErrors.push('Unexpected external network request');
      return route.abort();
    }
    return route.continue();
  });
  await page.addInitScript(() => {
      const config = JSON.parse(new URL(location.href).searchParams.get('fixture') ?? JSON.stringify({ screen: location.pathname === '/auth/error' ? 'callback-error' : 'email' }));
      localStorage.clear(); sessionStorage.clear();
      const gates = new Map();
      window.__fx = { screen: config.screen, owner: 'resident-a', ownerEmail: 'resident@example.test', calls: [], refreshes: 0, ...config,
        wait: action => gates.has(action) ? new Promise(resolve => gates.get(action).push(resolve)) : Promise.resolve(),
        hold: action => gates.set(action, []), release: action => { const pending = gates.get(action) ?? []; gates.delete(action); pending.forEach(resolve => resolve()); } };
    });
  async function open(screen, options = {}) {
    await page.goto(`${origin}/fixture?email=resident%40example.test&fixture=${encodeURIComponent(JSON.stringify({ screen, ...options }))}`);
    await page.locator('main').waitFor();
  }
  const toast = () => page.locator('[data-sonner-toast]');
  async function outcome(text, type) { const item = toast().filter({ hasText: text }); try { await item.waitFor(); } catch (error) { report.failedOutcome = { expected: text, url: page.url(), state: await page.evaluate(() => ({ cookie: document.cookie, owner: window.__fx.owner, screen: window.__fx.screen, body: document.body.innerText })) }; throw error; } assert.equal(await item.getAttribute('data-type'), type); assert.equal(await toast().count(), 1); await page.waitForFunction(() => [...document.querySelectorAll('[data-sonner-toast]')].every(item => item.dataset.mounted === 'true')); }
  async function dismiss() { await page.evaluate(() => { for (const button of document.querySelectorAll('[data-sonner-toast] [data-close-button]')) button.click(); }); await toast().waitFor({ state: 'detached' }); }
  async function mode(values) { await page.evaluate(value => Object.assign(window.__fx, value), values); }

  await open('theme', { owner: null });
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await outcome('Theme updated on this device.', 'success');
  assert.equal(await page.evaluate(() => localStorage.getItem('barangayan-resident-web-theme')), 'dark');
  await dismiss();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'SecurityError'); }; });
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await outcome("Preference updated for this session. Your browser couldn't save it.", 'warning');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
  report.checks.push('Guest theme persists successfully, or remains applied with exactly one storage warning');

  await open('theme');
  await page.evaluate(() => window.__fx.hold('write'));
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.evaluate(() => window.__fx.release('write'));
  await outcome("Preference applied. We couldn't confirm it was saved to your account.", 'info');
  await dismiss();
  await mode({ dbMode: 'rejected' });
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await outcome("Couldn't save your preference. Please try again.", 'error');
  report.checks.push('Rapid account preferences suppress obsolete responses; no false saved success; rejection stays an error');

  await open('theme');
  await page.getByRole('textbox', { name: 'Custom accent color hex code' }).fill('123abc');
  await page.getByRole('button', { name: 'Save color', exact: true }).click();
  await outcome('Custom color added.', 'success');
  assert.equal(await page.evaluate(() => window.__fx.calls.filter(call => call.operation === 'update').length), 2);
  await dismiss();
  await page.getByRole('button', { name: 'Remove #123abc', exact: true }).click();
  await outcome('Custom color removed.', 'success');
  assert.equal(await page.getByRole('button', { name: 'Use accent color #123abc', exact: true }).count(), 0);
  report.checks.push('Custom add/select retains two existing writes with one toast; removal succeeds under StrictMode');

  await open('reads', { dbMode: 'rejected' });
  await page.waitForFunction(() => window.__readCounts?.announcementsUnreadCount === 1);
  await page.getByRole('button', { name: 'Mark as read', exact: true }).first().click();
  await outcome("Couldn't mark the announcement as read. Please try again.", 'error');
  assert.equal(await page.evaluate(() => window.__readCounts.announcementsUnreadCount), 1);
  await dismiss();
  await mode({ dbMode: 'throw' });
  await page.getByRole('button', { name: 'Mark as read', exact: true }).last().click();
  await outcome("We couldn't confirm the read-status change. Refresh before trying again.", 'warning');
  await dismiss();
  await mode({ dbMode: null, readFails: true });
  await page.getByRole('button', { name: 'Mark as read', exact: true }).first().click();
  await outcome('Announcement marked as read.', 'success');
  assert.equal(await page.evaluate(() => window.__readCounts.announcementsUnreadCount), 1);
  report.checks.push('Read helpers surface returned and thrown failures; failed count refresh preserves last counts and confirmed success');

  await open('forgot', { owner: null });
  await page.getByLabel('Email', { exact: true }).fill('unknown@example.test');
  await page.getByRole('button', { name: 'Send Reset Code', exact: true }).click();
  await outcome('If this email has an account, a reset code has been sent.', 'success');
  assert.match(page.url(), /verify-otp/);
  await page.reload();
  assert.equal(await toast().count(), 0);
  report.checks.push('Public reset success preserves account privacy and does not replay after reload');

  await open('verify', { owner: null });
  await page.getByRole('textbox', { name: '6-digit reset code' }).fill('123456');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await outcome('Code verified. Choose your new password.', 'success');
  assert.match(page.url(), /reset-password/);
  report.checks.push('Public recovery verification uses its confirmed session without a login welcome');

  await open('verify', { owner: null });
  await page.evaluate(() => window.__fx.hold('verify-code'));
  await page.getByRole('textbox', { name: '6-digit reset code' }).fill('123456');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await page.evaluate(() => { window.__fx.ownerEmail = 'other@example.test'; window.__fx.switchOwner('resident-b'); window.__fx.release('verify-code'); });
  await page.getByRole('alert').waitFor();
  assert.equal(await toast().count(), 0);
  assert.equal(new URL(page.url()).pathname, '/fixture');
  report.checks.push('A delayed public verification result cannot restore another account or show stale success');

  await open('dialog');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByRole('button', { name: 'Send reset code', exact: true }).waitFor();
  assert.equal(await toast().count(), 0);
  await page.getByRole('button', { name: 'Send reset code', exact: true }).click();
  await outcome('Reset code sent. Check your email.', 'success');
  await page.waitForFunction(() => document.querySelector('[data-sonner-toast]').getBoundingClientRect().top >= 15);
  await page.screenshot({ path: path.join(output, 'light-recovery-dialog.png') });
  await dismiss();
  await page.getByLabel('Six-digit reset code').fill('123456');
  await page.getByRole('button', { name: 'Verify code', exact: true }).click();
  await outcome('Code verified. Choose your new password.', 'success');
  await dismiss();
  await page.getByLabel('New Password', { exact: true }).fill('Valid!Password123');
  await page.getByLabel('Confirm New Password', { exact: true }).fill('Valid!Password123');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await outcome('Password updated. Log in with your new password.', 'success');
  await dismiss();
  await page.getByRole('button', { name: 'Continue to login', exact: true }).click();
  await outcome('Logged out.', 'success');
  assert.match(page.url(), /login/);
  report.checks.push('Dialog opening stays quiet; send/verify/update and deliberate later logout each notify once without unexpected-session feedback');

  await open('reset', { settings: true });
  await page.getByLabel('New Password', { exact: true }).fill('Valid!Password123');
  await page.getByLabel('Confirm New Password', { exact: true }).fill('Valid!Password123');
  await page.getByRole('button', { name: 'Update Password', exact: true }).click();
  await outcome('Password updated. Log in with your new password.', 'success');
  assert.match(page.url(), /login/);
  assert.equal(await page.evaluate(() => window.__fx.calls.filter(call => call.action === 'sign-out').length), 1);
  report.checks.push('Standalone Settings update/logout chain emits one combined outcome');

  await open('email');
  await page.getByRole('textbox', { name: 'Verification code', exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await outcome('Email verified.', 'success');
  assert.equal(await page.locator('[role="status"]').filter({ hasText: 'Your email is verified.' }).count(), 0);
  await dismiss();
  await page.getByRole('button', { name: 'Change email address', exact: true }).click();
  await page.getByLabel('New email address').fill('new@example.test');
  await page.getByRole('button', { name: 'Send confirmation email', exact: true }).click();
  await outcome('Confirmation instructions sent. Check your inboxes.', 'success');
  await dismiss();
  await mode({ syncResult: { ok: true, email: 'resident@example.test', pendingEmail: 'new@example.test' } });
  await page.getByRole('button', { name: 'Check confirmation', exact: true }).click();
  await outcome('Your email change is still awaiting confirmation.', 'info');
  await dismiss();
  await mode({ syncResult: { ok: true, email: 'new@example.test', pendingEmail: '' } });
  await page.getByRole('button', { name: 'Check confirmation', exact: true }).click();
  await outcome('Email address changed.', 'success');
  report.checks.push('Email verification and request/check-confirmation use confirmed status; pending is information; duplicate inline live announcements removed');

  await open('google', { authMode: 'rejected', owner: null });
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await outcome("Couldn't connect to Google. Please try again.", 'error');
  assert.equal(await page.getByRole('alert').count(), 0);
  report.checks.push('Google startup failure uses safe copy and one announcement');

  await open('delete', { authMode: 'rejected' });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Password', { exact: true }).fill('incorrect');
  await page.getByRole('button', { name: 'Delete Account', exact: true }).click();
  await outcome("Incorrect password. Your account wasn't deleted.", 'error');
  assert.equal(await page.evaluate(() => window.__fx.calls.some(call => call.action === 'delete-my-account')), false);
  report.checks.push('Synthetic deletion reauthentication rejection cannot invoke deletion');

  await open('theme');
  await page.evaluate(() => window.__fx.hold('write'));
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.evaluate(() => { window.__fx.switchOwner('resident-b'); window.__fx.release('write'); });
  await page.waitForFunction(() => window.__fx.owner === 'resident-b');
  assert.equal(await toast().count(), 0);
  report.checks.push('Pending preference response is suppressed after account switch');

  await open('theme');
  await page.evaluate(() => window.__fx.hold('write'));
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.evaluate(() => { window.__fx.hide(); window.__fx.release('write'); });
  await outcome("Preference applied. We couldn't confirm it was saved to your account.", 'info');
  report.checks.push('A legitimate same-account preference completion still notifies after the form unmounts');

  await open('theme', { owner: null });
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'SecurityError'); }; });
  await page.getByRole('textbox', { name: 'Custom accent color hex code' }).fill('123abc');
  await page.getByRole('button', { name: 'Save color', exact: true }).click();
  await outcome("Color added for this session. Your browser couldn't save it.", 'warning');
  await dismiss();
  await page.getByRole('button', { name: 'Remove #123abc', exact: true }).click();
  await outcome("Color removed for this session. Your browser couldn't save the change.", 'warning');
  report.checks.push('Custom add/remove keeps in-memory state on unavailable storage, with one warning per action');

  await open('theme', { owner: null });
  await page.locator('button[aria-label^="Use accent color"]').first().click();
  await outcome('Accent color updated on this device.', 'success');
  await dismiss();
  // Choose through the real picker without assuming display labels from another version.
  await page.locator('button[style*="font-family"]').first().click();
  await outcome('Font updated on this device.', 'success');
  report.checks.push('Guest accent and font controls report their own local persistence outcomes');

  await open('bulk');
  await page.getByRole('button', { name: 'Mark all as read', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('button[disabled]'));
  await page.getByRole('button', { name: 'Mark all as read', exact: true }).click();
  await outcome('All announcements marked as read.', 'success');
  assert.equal(await page.evaluate(() => window.__fx.calls.filter(call => call.operation === 'upsert').length), 1);
  report.checks.push('Bulk read uses the real action owner, sends one existing write, and confirms the returned row IDs');

  await open('reads');
  await page.waitForFunction(() => window.__readCounts?.announcementsUnreadCount === 1);
  await page.evaluate(() => window.__fx.hold('write'));
  await page.getByRole('button', { name: 'Mark as read', exact: true }).first().evaluate(button => { button.click(); button.click(); });
  await page.waitForFunction(() => window.__fx.calls.filter(call => call.operation === 'upsert').length === 1);
  await page.evaluate(() => window.__fx.release('write'));
  await outcome('Announcement marked as read.', 'success');
  await page.waitForFunction(() => window.__readCounts.announcementsUnreadCount === 0);
  await dismiss();
  await page.getByRole('button', { name: 'Mark as read', exact: true }).first().click();
  assert.equal(await toast().count(), 0);
  await page.getByRole('button', { name: 'Mark as unread', exact: true }).first().click();
  await outcome('Announcement marked as unread.', 'success');
  report.checks.push('Double read activation is one write/outcome; unchanged read is quiet; later unread can notify again');

  await open('dialog', { recovery: 'unverified' });
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByRole('button', { name: 'Check again', exact: true }).waitFor();
  assert.equal(await toast().count(), 0);
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await outcome('Verify your email before resetting your password.', 'warning');
  await dismiss();
  await mode({ recovery: 'success' });
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await outcome('Your account is ready for password recovery.', 'success');
  await dismiss();
  await mode({ recovery: 'connection' });
  await page.getByRole('button', { name: 'Send reset code', exact: true }).click();
  await outcome("We couldn't confirm the code was sent. Check your email before trying again.", 'warning');
  report.checks.push('Eligibility automatic check stays quiet; explicit checks notify; a lost code-send response is uncertain');

  await open('reset', { settings: true, logoutFails: true });
  await page.getByLabel('New Password', { exact: true }).fill('Valid!Password123');
  await page.getByLabel('Confirm New Password', { exact: true }).fill('Valid!Password123');
  await page.getByRole('button', { name: 'Update Password', exact: true }).click();
  await outcome("Your password was updated, but we couldn't log you out. Please try again.", 'error');
  await dismiss();
  await mode({ logoutFails: false, navigationFails: true });
  await page.getByRole('button', { name: 'Sign out and continue to login', exact: true }).click();
  await outcome("You're logged out. Open Login to continue.", 'warning');
  await page.getByText('Your password was updated and you are signed out. Please open Login to continue.', { exact: true }).waitFor();
  report.checks.push('Recovery logout rejection differs from post-logout navigation failure; password success is not contradicted');

  await open('email', { functionMode: 'rejected' });
  await page.getByRole('textbox', { name: 'Verification code', exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await outcome('Code not accepted. Check the code or request a new one.', 'error');
  await dismiss();
  await mode({ functionMode: 'throw' });
  await page.getByRole('button', { name: 'Resend code', exact: true }).click();
  await outcome("We couldn't confirm the code was sent. Check your email before trying again.", 'warning');
  report.checks.push('Email invalid-code rejection and uncertain send stay distinct and retain inline guidance');

  await open('email', { pendingEmail: 'new@example.test', syncResult: { ok: true, email: 'resident@example.test', pendingEmail: '' } });
  await page.getByRole('button', { name: 'Check confirmation', exact: true }).click();
  await outcome('No completed email change was found. Check your confirmation emails.', 'info');
  await dismiss();
  await page.getByRole('button', { name: 'Resend confirmation', exact: true }).click();
  await outcome('Confirmation instructions resent. Check your inboxes.', 'success');
  report.checks.push('Email check distinguishes no completed change, and resend uses separate truthful copy');

  await open('delete');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: 'Delete Account', exact: true }).click();
  await outcome('Your account has been deleted.', 'success');
  assert.match(page.url(), /login/);
  report.checks.push('Synthetic deletion success survives intentional sign-out without a second unexpected-session toast');

  async function register(options = {}) {
    await open('register', { owner: null, ...options });
    await page.getByLabel('First Name', { exact: false }).fill('Fixture');
    await page.getByLabel('Last Name', { exact: false }).fill('Resident');
    await page.getByRole('button', { name: 'Female', exact: true }).click();
    await page.getByLabel('Date of Birth', { exact: false }).fill('2000-01-01');
    await page.getByLabel('Email Address', { exact: false }).fill('resident@example.test');
    await page.getByLabel('Mobile Number', { exact: false }).fill('09171234567');
    await page.getByLabel('House No.', { exact: false }).fill('1');
    await page.getByLabel('Street', { exact: false }).fill('Fixture Street');
    await page.getByRole('button', { name: 'Student', exact: true }).click();
    await page.locator('#password').fill('Valid!Password123');
    await page.locator('#confirmPassword').fill('Valid!Password123');
    await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  }
  await register();
  await outcome('Account created. Log in to continue.', 'success');
  await page.getByRole('dialog', { name: 'Account Created Successfully' }).waitFor();
  assert.equal(await page.evaluate(() => window.__fx.calls.filter(call => call.action === 'sign-up').length), 1);
  report.checks.push('Registration account-created toast survives its intentional session transition and keeps the existing modal');
  await register({ confirmationRequired: true });
  await outcome('Your account needs email confirmation. Contact barangay support for help.', 'warning');
  assert.equal(await page.getByRole('dialog').count(), 0);
  report.checks.push('Unsupported confirmation branch warns without claiming normal registration completion');
  await register({ logoutFails: true });
  await outcome('Account created. Log in to continue.', 'success');
  assert.equal(await page.locator('[data-sonner-toast]').filter({ hasText: 'Logged out' }).count(), 0);
  report.checks.push('Registration still reports confirmed account creation when local sign-out fails, without claiming logout');

  globalThis.__callbackFx = { before: { id: 'resident-a', email: 'resident@example.test', is_anonymous: false }, exchangeError: true };
  await page.goto(`${origin}/auth/callback?error=access_denied`);
  await outcome("Google sign-in couldn't be completed. Please start again.", 'error');
  assert.equal(new URL(page.url()).pathname, '/auth/error');
  assert.equal(await page.evaluate(() => document.cookie.includes('resident-web-callback-notice')), false);
  await page.reload();
  await page.getByRole('heading', { name: 'Google sign-in could not be completed' }).waitFor();
  await page.waitForFunction(() => typeof window.__fx.hide === 'function');
  assert.equal(await toast().count(), 0);
  await page.goto(`${origin}/auth/callback?error=access_denied`);
  await outcome("Google sign-in couldn't be completed. Please start again.", 'error');
  report.checks.push('Actual Google callback handler redirects with one consumed error receipt; reload stays quiet and a later callback can notify again');

  globalThis.__callbackFx = {
    before: { id: 'resident-a', email: 'resident@example.test', new_email: 'new@example.test', is_anonymous: false },
    exchanged: { id: 'resident-a', email: 'new@example.test' },
    synced: { ok: true, email: 'new@example.test', pendingEmail: '' },
  };
  await page.goto(`${origin}/auth/email-change?code=synthetic-code`);
  await outcome('Email address changed.', 'success');
  assert.equal(new URL(page.url()).pathname, '/settings/email-verification');
  await page.reload();
  await page.getByRole('button', { name: 'Verify email', exact: true }).waitFor();
  await page.waitForFunction(() => typeof window.__fx.hide === 'function');
  assert.equal(await toast().count(), 0);
  globalThis.__callbackFx.synced = { ok: true, email: 'resident@example.test', pendingEmail: 'new@example.test' };
  await page.goto(`${origin}/auth/email-change?message=check-other-inbox`);
  await outcome('One more confirmation may be needed. Check both inboxes.', 'info');
  globalThis.__callbackFx.exchangeError = true;
  await page.goto(`${origin}/auth/email-change?code=expired-code`);
  await outcome("Couldn't complete email confirmation. Request a new confirmation email.", 'error');
  report.checks.push('Actual email callback handler delivers confirmed change, two-inbox pending and error once; destination reload does not replay');

  await context.addCookies([{ name: 'resident-web-callback-notice', value: encodeURIComponent(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', createdAt: Date.now(), userId: 'resident-b', kind: 'email-changed' })), domain: '127.0.0.1', path: '/settings/email-verification' }]);
  await page.goto(`${origin}/settings/email-verification`);
  await page.getByRole('button', { name: 'Verify email', exact: true }).waitFor();
  await page.waitForFunction(() => typeof window.__fx.hide === 'function');
  assert.equal(await toast().count(), 0);
  assert.equal(await page.evaluate(() => document.cookie.includes('resident-web-callback-notice')), false);
  report.checks.push('A callback receipt owned by another account is consumed without stale success');

  await open('reads', { dbMode: 'no-rows' });
  await page.waitForFunction(() => window.__readCounts?.announcementsUnreadCount === 1);
  await page.getByRole('button', { name: 'Mark as read', exact: true }).first().click();
  await outcome('Read-status update sent. Refresh to confirm.', 'info');
  await dismiss();
  await mode({ dbMode: 'wrong-row' });
  await page.getByRole('button', { name: 'Mark as read', exact: true }).last().click();
  await outcome('Read-status update sent. Refresh to confirm.', 'info');
  await open('reads', { dbMode: 'missing-state' });
  await page.waitForFunction(() => window.__readCounts?.resolvedUnreadCount === 1);
  await page.getByRole('button', { name: 'Mark as read', exact: true }).last().click();
  await outcome('Read-status update sent. Refresh to confirm.', 'info');
  report.checks.push('Empty, mismatched and incomplete returned write rows cannot produce a read-state success');

  await open('reads');
  await page.waitForFunction(() => window.__readCounts?.resolvedUnreadCount === 1);
  await page.getByRole('button', { name: 'Mark as read', exact: true }).last().click();
  await outcome('Report marked as read.', 'success');
  await dismiss();
  await page.getByRole('button', { name: 'Mark as unread', exact: true }).last().click();
  await outcome('Report marked as unread.', 'success');
  const requestProof = await page.evaluate(() => window.__fx.calls.filter(call => call.operation === 'update').map(call => ({ prefer: call.prefer, select: call.select, filters: call.filters })));
  assert.equal(requestProof.length, 2);
  assert.ok(requestProof.every(call => call.prefer.includes('return=representation') && call.select === 'id,status,resolved_read_at' && call.filters.some(([key, value]) => key === 'reporter_id' && value === 'eq.resident-a')));
  report.checks.push('Real Supabase/PostgREST write builder requests affected-row representation once per action and preserves ownership predicates; report read/unread successes use those rows');

  await open('theme', { owner: null });
  await page.locator('button[style*="font-family"]').first().click();
  await outcome('Font updated on this device.', 'success');
  await page.waitForFunction(() => document.querySelector('[data-sonner-toast]').getBoundingClientRect().top >= 15);
  await page.screenshot({ path: path.join(output, 'light-wide.png') });

  await open('theme', { owner: null });
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await outcome('Theme updated on this device.', 'success');
  await page.waitForFunction(() => document.querySelector('[data-sonner-toast]').getBoundingClientRect().top >= 15);
  await page.screenshot({ path: path.join(output, 'dark-wide.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => { const rect = document.querySelector('[data-sonner-toast]').getBoundingClientRect(); return rect.left >= 15 && rect.right <= innerWidth - 15; });
  await page.screenshot({ path: path.join(output, 'dark-narrow.png') });
  const callsBefore = await page.evaluate(() => window.__fx.calls.length);
  await dismiss();
  assert.equal(await page.evaluate(() => window.__fx.calls.length), callsBefore);
  report.checks.push('Shared host renders dark wide/narrow; dismissal causes no new request');
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await outcome('Theme updated on this device.', 'success');
  const callsAtIdle = await page.evaluate(() => window.__fx.calls.length);
  await toast().waitFor({ state: 'detached', timeout: 6000 });
  assert.equal(await page.evaluate(() => window.__fx.calls.length), callsAtIdle);
  assert.equal(await toast().count(), 0);
  report.checks.push('Light/dark and open-dialog captures use the unchanged host; idle expiry triggers no work or repeated notification');
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.warnings, []);
  report.passed = true;
} finally {
  fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify(report, null, 2));
