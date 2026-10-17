// Run from repository root. Real Phase 2 components, adapter and host; synthetic services only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const output = path.resolve('plans/evidence/resident-web-toast-coverage/phase-2');
fs.mkdirSync(output, { recursive: true });
const mocks = {
  'next/link': `export default function Link({children,href,...props}){return <a href={href} {...props}>{children}</a>}`,
  'next/image': `export default function Image({priority,...props}){return <img {...props}/>}`,
  'next/font/local': `export default ()=>({className:''});`,
  '@/components/auth/registration-map': `export const RegistrationMap=()=>null;`,
  'next/navigation': `const fx=window.__authToast;const router={push:href=>history.pushState({},'',href),replace:href=>history.replaceState({},'',href),refresh:()=>{fx.refreshes++}};export const useRouter=()=>router;export const useSearchParams=()=>new URLSearchParams(location.search);`,
  './actions': `export async function syncResidentSignInEmail(){const fx=window.__authToast;fx.calls.push('sync');await fx.wait('sync');if(fx.syncThrows)throw new TypeError('lost read');return fx.syncResult??{ok:true,email:fx.ownerEmail,pendingEmail:'',status:'verified'};}`,
  '@/lib/supabase/client': `
    import {AuthApiError,AuthRetryableFetchError,FunctionsHttpError} from '@supabase/supabase-js';
    const fx=window.__authToast,listeners=new Set();
    const user=()=>({id:fx.owner??'resident-a',email:fx.ownerEmail,is_anonymous:false});
    fx.emit=(event,id=fx.owner)=>{for(const cb of listeners)cb(event,id?{user:{...user(),id}}:null)};
    fx.switchOwner=id=>{fx.owner=id;fx.emit(id?'SIGNED_IN':'SIGNED_OUT',id);fx.renderOwner?.(id)};
    async function authResult(action){fx.calls.push(action);await fx.wait(action);if(fx.authMode==='throw')throw new TypeError('synthetic lost reply');let error=fx.authMode==='rejected'?new AuthApiError('internal SQL 999',400,'invalid_credentials'):fx.authMode==='rate-limit'?new AuthApiError('internal rate',429,'over_request_rate_limit'):fx.authMode==='connection'?new AuthRetryableFetchError('synthetic loss',0):null;return{data:{user:user(),url:fx.oauthUrl??null,session:fx.noSession?null:{}},error}}
    const query=table=>{const q={select(){return q},eq(){return q},abortSignal(){return q},async single(){return{data:table==='barangay_localities'?{barangay_id:'11111111-1111-4111-8111-111111111111',display_name:'Fixture Barangay',city:'Fixture City',province:'Fixture Province'}:{id:'11111111-1111-4111-8111-111111111111',boundary:null},error:null}},async maybeSingle(){fx.calls.push('profile');await fx.wait('profile');return{data:{first_name:'Juan',last_name:'Dela Cruz'},error:null}}};return q};
    const client={from:query,auth:{onAuthStateChange(cb){listeners.add(cb);queueMicrotask(()=>{if(listeners.has(cb))cb('INITIAL_SESSION',fx.owner?{user:user()}:null)});return{data:{subscription:{unsubscribe:()=>listeners.delete(cb)}}}},getUser:async()=>({data:{user:user()},error:null}),signInWithPassword:()=>authResult('reauth'),signUp:()=>authResult('signup'),resetPasswordForEmail:()=>authResult('send-code'),verifyOtp:()=>authResult('verify-code'),updateUser:()=>authResult('auth-update'),signInWithOAuth:()=>authResult('google'),linkIdentity:()=>authResult('google-link'),async signOut(){fx.calls.push('sign-out');if(fx.logoutFails){document.cookie='sb-fixture-resident-web-auth-token=synthetic; path=/';return{error:new Error('synthetic revoke failure')}}document.cookie='sb-fixture-resident-web-auth-token=; max-age=0; path=/';fx.switchOwner(null);return{error:null}}},functions:{async invoke(name){fx.calls.push(name);await fx.wait(name);if(fx.functionMode==='throw')throw new TypeError('synthetic lost reply');if(fx.functionStatus)return{data:null,error:new FunctionsHttpError(new Response(JSON.stringify({error:'internal SQL 999'}),{status:fx.functionStatus}))};return{data:{status:fx.verificationStatus??'verified'},error:null}}}};
    export const createSupabaseBrowserClient=()=>client;
  `,
};
const bundle = await build({ entryPoints: [path.join(import.meta.dirname, 'auth-toast-fixture.jsx')], bundle: true, write: false, outdir: 'fixture', jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'),
  alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '"https://fixture.supabase.test"', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"public-fixture-key"' },
  plugins: [{ name: 'synthetic-auth', setup(builder) {
    builder.onResolve({ filter: /^(next\/|@\/|\.\/actions$)/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'fixture' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});
const globals = path.join(app, 'src/app/globals.css');
const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(globals, 'utf8'), { from: globals })).css + (bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '');
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
const report = { passed: false, checks: [], pageErrors: [], consoleErrors: [], warnings: [], limitations: ['Synthetic Auth, email, deletion and server-action responses; no real external operations.', 'AUTH-02/AUTH-21 have no safe client callback provenance. Standalone Settings pages are exercised as components, not through a live recovery cookie. Registration map excluded from this auth fixture.'] };
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 950 }, timezoneId: 'Asia/Manila' });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); if (message.type() === 'warning') report.warnings.push(message.text()); });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    assert.equal(url.hostname, 'auth-toast.test', 'No real external service may be called');
    if (url.pathname.endsWith('.js')) return route.fulfill({ contentType: 'text/javascript', body: js });
    if (url.pathname.endsWith('.css')) return route.fulfill({ contentType: 'text/css', body: css });
    if (url.pathname.endsWith('.png')) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a00kAAAAASUVORK5CYII=', 'base64') });
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><title>Auth toast fixture</title><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script></html>' });
  });
  async function open(screen, options = {}) {
    await page.addInitScript(config => {
      localStorage.clear(); sessionStorage.clear();
      const gates = new Map();
      window.__authToast = { screen: config.screen, owner: 'resident-a', ownerEmail: 'resident@example.test', calls: [], errors: [], refreshes: 0, ...config,
        wait: action => gates.has(action) ? new Promise(resolve => gates.get(action).push(resolve)) : Promise.resolve(),
        hold: action => gates.set(action, []), release: action => { const pending = gates.get(action) ?? []; gates.delete(action); pending.forEach(resolve => resolve()); } };
    }, { screen, ...options });
    await page.goto('http://auth-toast.test/fixture?email=resident%40example.test');
    await page.locator('main').waitFor();
  }
  const toasts = () => page.locator('[data-sonner-toast]');
  async function outcome(text, type) { const item = toasts().filter({ hasText: text }); await item.waitFor(); assert.equal(await item.getAttribute('data-type'), type); assert.equal(await toasts().count(), 1); assert.doesNotMatch(await item.innerText(), /internal|SQL|999/); }
  async function dismiss() { await page.locator('[data-sonner-toast] [data-close-button]').click(); await toasts().waitFor({ state: 'detached' }); }
  const mode = values => page.evaluate(value => Object.assign(window.__authToast, value), values);
  const click = name => page.getByRole('button', { name, exact: true }).click();
  async function passwords() { await page.getByLabel('New Password', { exact: true }).fill('Valid!Password123'); await page.getByLabel('Confirm New Password', { exact: true }).fill('Valid!Password123'); }
  async function dialogPassword() { await click('Forgot password?'); await click('Send reset code'); await dismiss(); await page.getByLabel('Six-digit reset code').fill('123456'); await click('Verify code'); await dismiss(); await passwords(); }
  async function deleteAttempt() { await page.getByRole('checkbox').check(); await click('Continue'); await page.getByLabel('Password', { exact: true }).fill('Valid!Password123'); await click('Delete Account'); }
  async function register() {
    await page.getByText('Fixture Barangay', { exact: true }).waitFor();
    for (const [id,value] of Object.entries({ firstName:'Juan',lastName:'Dela Cruz',birthDate:'1990-01-01',email:'new@example.test',mobileNumber:'09171234567',houseNo:'1',street:'Main',password:'Valid!Password123',confirmPassword:'Valid!Password123' })) await page.locator('#'+id).fill(value);
    await click('Male'); await click('Unemployed'); await click('Create Account');
    await page.waitForFunction(() => window.__authToast.calls.includes('signup'), { timeout: 5000 }).catch(async error => {
      report.registrationDiagnostic = await page.locator('main').innerText();
      throw error;
    });
  }

  await open('google', { owner: null, authMode: 'rejected' }); await click('Continue with Google');
  await outcome("Couldn't connect to Google. Please try again.", 'error');
  assert.equal(await page.getByRole('alert').count(), 0);
  await dismiss(); await click('Continue with Google'); await outcome("Couldn't connect to Google. Please try again.", 'error');
  await open('google', { authMode: 'rejected', link: true }); await click('Continue with Google');
  await outcome("Couldn't connect your Google account. Please try again.", 'error');
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  report.checks.push('AUTH-01: Google start rejection, intentional retry and identity linking have one distinct safe outcome, no welcome receipt');

  await open('register', { owner: null }); await register();
  await outcome('Account created. Log in to continue.', 'success');
  await page.getByRole('dialog', { name: 'Account Created Successfully' }).waitFor();
  await click('Proceed to Login'); assert.match(page.url(), /login/); await page.reload(); assert.equal(await toasts().count(), 0);
  await open('register', { owner: null, noSession: true }); await register();
  await outcome('Your account needs email confirmation.', 'warning');
  assert.equal(await page.evaluate(() => window.__authToast.calls.includes('sign-out')), false);
  report.checks.push('AUTH-03/04: actual registration form confirms account creation or warns on unsupported confirmation, preserves modal/navigation, no reload replay');

  await open('forgot', { owner: null }); await page.getByLabel('Email', { exact: true }).fill('unknown@example.test'); await click('Send Reset Code');
  await outcome('If this email has an account, a reset code has been sent.', 'success'); assert.match(page.url(), /verify-otp/);
  await page.reload(); assert.equal(await toasts().count(), 0);
  await open('forgot', { owner: null, authMode: 'throw' }); await page.getByLabel('Email', { exact: true }).fill('unknown@example.test'); await click('Send Reset Code'); await outcome("Couldn't confirm the code was sent", 'warning');
  await open('verify', { owner: null }); await page.getByLabel('6-digit reset code').fill('123456'); await click('Verify');
  await outcome('Code verified. Choose your new password.', 'success'); assert.match(page.url(), /reset-password/);
  report.checks.push('AUTH-05/06: public send privacy, lost-response warning and confirmed recovery verification; no ordinary login welcome or reload replay');

  await open('dialog', { recovery: 'unverified' }); await click('Forgot password?'); await click('Check again');
  await outcome('Verify your email before resetting your password.', 'warning'); await dismiss(); await mode({ recovery: null }); await click('Check again');
  await outcome('Your account is ready for password recovery.', 'success');
  await open('dialog'); await click('Forgot password?'); assert.equal(await toasts().count(), 0); await mode({ recovery: 'connection' }); await click('Send reset code');
  await outcome("We couldn't confirm the code was sent.", 'warning'); await dismiss(); await mode({ recovery: null }); await click('Send reset code');
  await outcome('Reset code sent. Check your email.', 'success'); await dismiss(); await page.getByLabel('Six-digit reset code').fill('123456');
  await mode({ recovery: 'rate-limit' }); await click('Verify code'); await outcome("Couldn't verify the code. Review the message below.", 'error');
  await dismiss(); await mode({ recovery: 'rejected' }); await click('Verify code'); await outcome('Code not accepted.', 'error');
  await dismiss(); await mode({ recovery: null }); await click('Verify code'); await outcome('Code verified.', 'success'); await dismiss(); await passwords(); await click('Update password');
  await outcome('Password updated. Log in with your new password.', 'success'); await dismiss(); await mode({ logoutFails: true }); await click('Continue to login');
  await outcome("Your password was updated, but we couldn't log you out.", 'error'); await dismiss(); await mode({ logoutFails: false, navigationFails: true }); await click('Continue to login');
  await outcome("You're logged out. Open Login to continue.", 'warning');
  report.checks.push('AUTH-07–11: automatic eligibility quiet; explicit eligibility, uncertain send, rate-limit vs code rejection, update, logout failure and navigation-only failure each have one truthful outcome');

  for (const recovery of ['rejected','connection','throw']) {
    await open('dialog'); await dialogPassword(); await mode({ recovery }); await click('Update password');
    await outcome(recovery === 'rejected' ? "Couldn't update your password." : "We couldn't confirm the password change.", recovery === 'rejected' ? 'error' : 'warning');
  }
  await open('dialog'); await dialogPassword(); await click('Update password'); await dismiss(); await click('Continue to login'); await outcome('Logged out.', 'success'); assert.match(page.url(), /login/);
  report.checks.push('AUTH-10/11: rejected and lost password writes stay distinct; later deliberate recovery logout survives the guest session');

  await open('verify', { settings: true, recovery: 'redirect' }); await page.getByLabel('6-digit reset code').fill('123456'); await click('Verify');
  await outcome('Code verified.', 'success'); await page.waitForURL(/reset-password/);
  for (const recovery of ['rejected','connection']) {
    await page.clock.install();
    await open('verify', { settings: true, recovery }); await page.clock.runFor(46000); await click('Resend Code');
    await outcome(recovery === 'rejected' ? "Couldn't send a new code." : "We couldn't confirm a new code was sent.", recovery === 'rejected' ? 'error' : 'warning');
  }
  await page.clock.resume();
  await open('reset', { settings: true, finishRedirect: true }); await passwords(); await click('Update Password');
  await outcome('Password updated. Log in with your new password.', 'success'); await page.waitForURL(/login/);
  assert.equal(await page.evaluate(() => window.__authToast.calls.filter(call => call === 'sign-out').length), 1);
  await open('reset', { settings: true, navigationFails: true }); await passwords(); await click('Update Password'); await outcome("You're logged out. Open Login to continue.", 'warning');
  for (const recovery of ['rejected','connection']) {
    await open('reset', { settings: true, recovery }); await passwords(); await click('Update Password');
    await outcome(recovery === 'rejected' ? "Couldn't update your password." : "We couldn't confirm the password change.", recovery === 'rejected' ? 'error' : 'warning');
    assert.equal(await page.evaluate(() => window.__authToast.calls.includes('sign-out')), false);
  }
  report.checks.push('AUTH-12–14/11: standalone Settings redirect control errors propagate to a synthetic Next boundary; resend rejection/uncertainty; update/logout emits one combined success or navigation warning');

  await open('reset', { settings: true }); await page.evaluate(() => window.__authToast.hold('update')); await passwords(); await click('Update Password');
  await page.evaluate(() => { window.__authToast.switchOwner('resident-b'); window.__authToast.release('update'); });
  await page.getByText(/Your recovery session changed or ended/).waitFor(); assert.equal(await toasts().count(), 0);
  await open('dialog'); await click('Forgot password?'); await page.evaluate(() => window.__authToast.hold('send')); await click('Send reset code');
  await page.evaluate(() => { document.querySelector('button#recovery-primary').click(); window.__authToast.switchOwner('resident-b'); window.__authToast.release('send'); });
  await page.getByText(/Your account changed/).waitFor(); assert.equal(await toasts().count(), 0);
  assert.equal(await page.evaluate(() => window.__authToast.calls.filter(call => call === 'send').length), 1);
  report.checks.push('Recovery double activation causes one write; pending outcomes suppressed on account switch');

  await open('reset', { settings: true }); await page.evaluate(() => window.__authToast.hold('finish')); await passwords(); await click('Update Password');
  await page.waitForFunction(() => window.__authToast.calls.includes('finish'));
  await page.evaluate(() => { window.__authToast.hide(); window.__authToast.switchOwner('resident-b'); window.__authToast.release('finish'); });
  assert.equal(await toasts().count(), 0);
  await open('dialog'); await dialogPassword(); await click('Update password'); await dismiss(); await page.evaluate(() => window.__authToast.hold('finish')); await click('Continue to login');
  await page.waitForFunction(() => window.__authToast.calls.includes('finish'));
  await page.evaluate(() => { window.__authToast.switchOwner('resident-b'); window.__authToast.release('finish'); });
  await page.getByText(/Your account changed/).waitFor(); assert.equal(await toasts().count(), 0);
  report.checks.push('Both recovery variants suppress delayed logout/navigation outcomes after a new account signs in');
  await open('reset', { settings: true }); await page.evaluate(() => window.__authToast.hold('finish')); await passwords(); await click('Update Password');
  await page.waitForFunction(() => window.__authToast.calls.includes('finish'));
  await page.evaluate(() => { window.__authToast.hide(); window.__authToast.release('finish'); });
  await outcome('Password updated. Log in with your new password.', 'success');
  report.checks.push('Legitimate same-session recovery completion still notifies after the form unmounts');

  await open('email', { emailStatus: 'unverified', verificationStatus: 'pending' }); await click('Send verification code'); await outcome('Verification code sent.', 'success'); await dismiss();
  await mode({ verificationStatus: 'verified' }); await page.getByLabel('Verification code', { exact: true }).fill('123456'); await click('Verify email'); await outcome('Email verified.', 'success');
  assert.equal(await page.locator('[role="status"]').filter({ hasText: 'Your email is verified.' }).count(), 0);
  await open('email', { functionStatus: 400 }); await page.getByLabel('Verification code', { exact: true }).fill('123456'); await click('Verify email'); await outcome('Code not accepted.', 'error');
  await open('email', { mismatch: true }); await click('Use current sign-in email'); await outcome('Profile email updated to your sign-in email.', 'success');
  await open('email', { emailStatus: 'unverified', functionMode: 'throw' }); await click('Send verification code'); await outcome("We couldn't confirm the code was sent.", 'warning');
  await open('email', { mismatch: true, syncResult: { ok: false, message: 'Unable to sync your confirmed email. Try again.' } }); await click('Use current sign-in email'); await outcome("Couldn't update your profile email.", 'error');
  report.checks.push('AUTH-15–17: controlled verification pending/verified/rejected and profile synchronization; one live announcement owner');

  await open('email'); await click('Change email address'); await page.getByLabel('New email address').fill('new@example.test'); await click('Send confirmation email'); await outcome('Confirmation instructions sent.', 'success'); await dismiss();
  await mode({ syncResult: { ok: true, email: 'resident@example.test', pendingEmail: 'new@example.test' } }); await click('Check confirmation'); await outcome('Your email change is still awaiting confirmation.', 'info'); await dismiss();
  await mode({ syncResult: { ok: true, email: 'resident@example.test', pendingEmail: '' } }); await click('Check confirmation'); await outcome('No completed email change was found.', 'info'); await dismiss();
  await mode({ syncResult: { ok: true, email: 'new@example.test', pendingEmail: '' } }); await click('Check confirmation'); await outcome('Email address changed.', 'success');
  for (const authMode of ['rejected','throw']) {
    await open('email', { pendingEmail: 'new@example.test', authMode }); await click('Resend confirmation'); await outcome(authMode === 'rejected' ? "Couldn't resend confirmation." : "We couldn't confirm the instructions were resent.", authMode === 'rejected' ? 'error' : 'warning');
  }
  await open('email', { pendingEmail: 'new@example.test' }); await click('Resend confirmation'); await outcome('Confirmation instructions resent.', 'success');
  await dismiss(); await mode({ syncThrows: true }); await click('Check confirmation'); await outcome("Couldn't check confirmation.", 'error');
  report.checks.push('AUTH-18–20: email request, resend rejection/uncertainty, pending, no-change and confirmed-change results distinguished without extra mutations');

  await open('delete', { authMode: 'rejected' }); await deleteAttempt(); await outcome("Incorrect password. Your account wasn't deleted.", 'error');
  assert.equal(await page.evaluate(() => window.__authToast.calls.includes('delete-my-account')), false);
  await open('delete', { authMode: 'rate-limit' }); await deleteAttempt(); await outcome('Too many attempts.', 'error');
  for (const functionStatus of [403,500]) {
    await open('delete', { functionStatus }); await deleteAttempt(); await outcome(functionStatus === 403 ? "Couldn't delete your account." : "We couldn't confirm account deletion.", functionStatus === 403 ? 'error' : 'warning');
    assert.doesNotMatch(await page.locator('main').innerText(), /internal SQL|999/);
  }
  await open('delete', { functionMode: 'throw' }); await deleteAttempt(); await outcome("We couldn't confirm account deletion.", 'warning');
  await open('delete', { missingEmail: true, ownerEmail: '' }); await deleteAttempt(); await outcome("We couldn't verify account ownership.", 'error');
  assert.equal(await page.evaluate(() => window.__authToast.calls.includes('reauth')), false);
  await open('delete'); await deleteAttempt(); await outcome('Your account has been deleted.', 'success'); assert.match(page.url(), /login/);
  report.checks.push('AUTH-22: synthetic deletion reauthentication/rate-limit, rejection, partial server failure, lost reply and success; no raw provider text or welcome/logout duplicate');

  await open('logout'); await click('Log out'); await outcome('Logged out', 'success'); assert.match(page.url(), /login/);
  await page.evaluate(() => window.__authToast.emit('SIGNED_OUT', null)); assert.equal(await toasts().count(), 1);
  await open('email'); await page.evaluate(() => { window.__authToast.emit('SIGNED_OUT', null); window.__authToast.emit('SIGNED_OUT', null); });
  await outcome("You've been logged out", 'info');
  report.checks.push('Ordinary logout persists once; repeated unexpected session events notify once');

  await open('dialog'); await click('Forgot password?'); await click('Send reset code'); await outcome('Reset code sent.', 'success');
  await page.waitForFunction(() => document.querySelector('[data-sonner-toast]').getBoundingClientRect().y >= 15);
  await page.screenshot({ path: path.join(output, 'recovery-dialog-light-wide.png') });
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.__authToast.setTheme('dark'));
  await page.waitForFunction(() => document.querySelector('[data-sonner-toaster]').dataset.theme === 'dark' && document.querySelector('[data-sonner-toast]').getBoundingClientRect().x >= 0);
  await page.screenshot({ path: path.join(output, 'recovery-dialog-dark-narrow.png') });
  await page.getByLabel('Six-digit reset code').fill('234567');
  const callsBefore = await page.evaluate(() => window.__authToast.calls.length); await dismiss();
  assert.equal(await page.getByRole('dialog').count(), 1);
  assert.equal(await page.getByLabel('Six-digit reset code').inputValue(), '234567');
  assert.equal(await page.evaluate(() => window.__authToast.calls.length), callsBefore);
  assert.deepEqual(await page.evaluate(() => window.__authToast.errors), []);
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.warnings, []);
  report.checks.push('Unchanged shared toast with open recovery dialog, light/wide and dark/narrow; dismissal causes no request; no runtime errors or console warnings');
  report.passed = true;
} finally { fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2)); await browser?.close(); }
console.log(JSON.stringify(report, null, 2));
