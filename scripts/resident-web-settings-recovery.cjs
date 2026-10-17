// Local-only recovery acceptance. Credentials and delivered codes stay in memory.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'apps/resident-web');
const output = path.join(root, 'dist/settings-recovery');
const api = 'http://127.0.0.1:54321', base = 'http://127.0.0.1:3138', mail = 'http://127.0.0.1:54324';
const dist = '.next-settings-recovery';
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const sql = query => docker(['exec', '-i', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'postgres', '-XAt', '-v', 'ON_ERROR_STOP=1'], query);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = text => text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]');
const must = result => { if (result.error) throw new Error(`Local Auth/API failed: ${result.error.code || result.error.status || result.error.name}`); return result.data; };

function localConfig() {
  const ports = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', 'supabase_kong_barangayan']));
  assert.ok(ports['8000/tcp']?.every(port => port.HostPort === '54321'), 'Only the local Supabase API is allowed');
  const env = JSON.parse(docker(['inspect', '--format', '{{json .Config.Env}}', 'supabase_kong_barangayan']));
  const configPath = env.find(value => value.startsWith('KONG_DECLARATIVE_CONFIG=')).split('=').slice(1).join('=');
  const content = docker(['exec', 'supabase_kong_barangayan', 'cat', configPath]);
  const tokens = [...new Set(content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g))];
  const key = role => tokens.find(token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).role === role);
  return { anon: key('anon'), service: key('service_role') };
}
const keys = localConfig();
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon, BARANGAYAN_PREVIEW_DIST_DIR: dist, NEXT_TELEMETRY_DISABLED: '1' };
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const auth = () => createClient(api, keys.anon, options);
const admin = createClient(api, keys.service, options);
const checks = [];
const pass = label => { checks.push(label); console.log(`PASS: ${label}`); };

function build() {
  fs.mkdirSync(output, { recursive: true });
  const configPath = path.join(app, 'tsconfig.json'), previous = fs.readFileSync(configPath);
  let result;
  try {
    result = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], { cwd: app, env, encoding: 'utf8', timeout: 900000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  } finally {
    if (!fs.readFileSync(configPath).equals(previous)) fs.writeFileSync(configPath, previous);
  }
  const log = clean(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  fs.writeFileSync(path.join(output, 'build.txt'), log);
  console.log(log.split('\n').slice(-55).join('\n'));
  assert.equal(result.status, 0, 'Production build passes');
}

async function deliveredCode(email, seen = new Set()) {
  for (let i = 0; i < 40; i++) {
    const response = await fetch(`${mail}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=50`);
    const messages = (await response.json()).messages ?? [];
    const fresh = messages.find(message => !seen.has(message.ID));
    if (fresh) {
      seen.add(fresh.ID);
      const body = await (await fetch(`${mail}/api/v1/message/${fresh.ID}`)).json();
      const text = `${body.Text ?? ''}\n${body.HTML ?? ''}`;
      const shown = text.match(/\b(\d{6})\b/);
      if (shown) return shown[1];
      // Local Auth's default template sends a link; recover its actual issued OTP.
      const hash = text.match(/[?&](?:amp;)?token=(?:pkce_)?([a-f0-9]{20,})/i)?.[1].toLowerCase();
      assert.ok(hash, 'Real local Auth email has a recovery token');
      for (let n = 0; n < 1000000; n++) {
        const code = String(n).padStart(6, '0');
        if (createHash('sha224').update(email + code).digest('hex') === hash) return code;
      }
      throw new Error('Delivered recovery token has no matching OTP');
    }
    await sleep(250);
  }
  throw new Error('Real local recovery email was not captured');
}

async function test() {
  fs.mkdirSync(output, { recursive: true });
  const tenant = randomUUID(), accounts = [], contexts = [];
  let server, browser, page, serverLog = '';
  async function resident(label, verified) {
    const email = `settings-recovery-${label}-${randomUUID()}@local.test`, password = `Aa1!${randomUUID()}`;
    const created = must(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
    const account = { id: created.id, email, password }; accounts.push(account);
    sql(`insert into public.profiles(id,role,barangay_id,full_name,first_name,last_name,house_no,street,sex,employment_status,birth_date,mobile_number,email,email_verification_status,email_verified_at)
      values ('${account.id}','resident','${tenant}','Recovery Test','Recovery','Test','12','Synthetic Street','female','student','2000-01-01','09171234567','${email}','${verified ? 'verified' : 'unverified'}',${verified ? 'now()' : 'null'});`);
    return account;
  }
  async function login(page, account) {
    await page.goto(`${base}/login?next=/settings/change-password`);
    await page.locator('input[type=email]').fill(account.email);
    await page.locator('input[type=password]').fill(account.password);
    await page.getByRole('button', { name: 'Log In', exact: true }).click();
    await page.waitForURL('**/settings/change-password', { timeout: 30000 });
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).waitFor();
  }
  try {
    sql(`insert into public.barangays(id,name) values ('${tenant}','Settings Recovery Local'); insert into public.barangay_localities(barangay_id,display_name,city,province) values ('${tenant}','Settings Recovery Local','Synthetic City','Synthetic Province');`);
    const verified = await resident('verified', true), unverified = await resident('unverified', false), other = await resident('other', true);
    server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3138'], { cwd: app, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', data => { serverLog += data; }); server.stderr.on('data', data => { serverLog += data; });
    for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/login`)).ok) break; } catch {} await sleep(500); }
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }); contexts.push(context);
    page = await context.newPage();
    await login(page, verified);
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.ok((await page.getByRole('dialog').innerText()).includes('se••••@local.test'));
    await page.waitForTimeout(400); // Let the existing dialog entrance animation finish.
    await page.screenshot({ path: path.join(output, 'settings-confirmation.png') });
    await page.getByRole('button', { name: 'Send reset code', exact: true }).click();
    await page.getByRole('heading', { name: 'Enter reset code', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/settings/change-password');
    const intent = (await context.cookies()).find(value => value.name === 'barangayan-settings-recovery');
    assert.ok(intent?.httpOnly, 'Recovery intent is HttpOnly');
    pass('Settings sends an actual Auth recovery email and opens code entry in the same dialog');
    const seen = new Set(), firstCode = await deliveredCode(verified.email, seen);
    await page.getByLabel('Six-digit reset code', { exact: true }).fill(String((Number(firstCode) + 1) % 1000000).padStart(6, '0'));
    await page.getByRole('button', { name: 'Verify code', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'invalid or has expired' }).waitFor();
    pass('Incorrect codes do not open password reset');
    await page.getByRole('button', { name: 'Resend code', exact: true }).waitFor({ timeout: 50000 });
    await page.getByRole('button', { name: 'Resend code', exact: true }).click();
    await page.getByRole('button', { name: 'Resend code in 45s', exact: true }).waitFor();
    const code = await deliveredCode(verified.email, seen);
    pass('Resend respects the 45-second cooldown and delivers a fresh recovery code');
    await page.getByLabel('Six-digit reset code', { exact: true }).fill(code);
    await page.getByLabel('Six-digit reset code', { exact: true }).press('Enter');
    await page.getByRole('heading', { name: 'Choose a new password', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/settings/change-password');
    await page.waitForTimeout(400); // Capture the rendered form, rather than its route fade.
    assert.equal(await page.getByRole('dialog').getByLabel('Current Password', { exact: true }).count(), 0);
    await page.getByText('Use at least 8 characters, including one capital letter, one number, and one special character.', { exact: true }).waitFor();
    await page.locator('#recovery-password').fill('password');
    await page.locator('#recovery-confirm-password').fill('password');
    await page.getByRole('button', { name: 'Update password', exact: true }).click();
    await page.getByText('Password must include a capital letter, a number, and a special character', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/settings/change-password');
    pass('Dialog shows all password-format requirements and rejects weak passwords before updating');
    await page.screenshot({ path: path.join(output, 'settings-reset-password.png') });
    const next = `Aa1!${randomUUID()}`;
    await page.locator('#recovery-password').fill(next); await page.locator('#recovery-confirm-password').fill('different');
    await page.getByRole('button', { name: 'Update password', exact: true }).click();
    await page.getByText("Passwords don't match", { exact: true }).waitFor();
    await page.locator('#recovery-confirm-password').fill(next);
    await page.getByRole('button', { name: 'Update password', exact: true }).click();
    await page.getByRole('heading', { name: 'Password updated', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/settings/change-password');
    await page.getByRole('button', { name: 'Continue to login', exact: true }).click();
    await page.waitForURL('**/login?passwordReset=success', { timeout: 30000 });
    await page.getByRole('status').filter({ hasText: 'Password updated. Sign in with your new password.' }).waitFor();
    assert.ok(!(await context.cookies()).some(value => value.name === 'barangayan-settings-recovery'));
    assert.ok((await auth().auth.signInWithPassword({ email: verified.email, password: verified.password })).error);
    must(await auth().auth.signInWithPassword({ email: verified.email, password: next }));
    pass('Verification, password entry and success stay in the dialog; Continue to login signs out and clears recovery state');
    pass('New password authenticates and old password is rejected');

    // Resident-web accepts admin accounts too. The recovery check must report
    // their actual verification status rather than hiding the profile by role.
    sql(`update public.profiles set role='admin' where id='${unverified.id}';`);
    await login(page, unverified);
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
    await page.getByRole('link', { name: 'Verify email', exact: true }).waitFor();
    await page.getByText('Your email is not yet verified. Verify your email to receive a password reset code.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Send reset code', exact: true }).count(), 0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(output, 'settings-unverified-email.png') });
    pass('Unverified admin email shows Email not verified instead of a false ended-session error');
    sql(`update public.profiles set email_verification_status='verified',email_verified_at=now() where id='${unverified.id}';`);
    await page.getByRole('button', { name: 'Check again', exact: true }).click();
    await page.getByRole('button', { name: 'Send reset code', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Send reset code', exact: true }).isEnabled(), true);
    pass('Checking again enables the verified admin account recovery without reloading Settings');
    await context.clearCookies();
    sql(`update public.profiles set email='mismatch@local.test' where id='${unverified.id}';`);
    await login(page, unverified);
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
    await page.getByRole('link', { name: 'Open Profile', exact: true }).waitFor();
    pass('Mismatched profile email cannot send and offers Profile');
    await context.clearCookies();
    await login(page, { ...verified, password: next });
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
    const otherContext = await browser.newContext(); contexts.push(otherContext);
    const secondPage = await otherContext.newPage();
    await login(secondPage, other);
    await context.clearCookies();
    await context.addCookies(await otherContext.cookies());
    await page.getByRole('button', { name: 'Send reset code', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: /session changed or ended/ }).waitFor();
    pass('A stale Settings action cannot send after another account signs in');
    await context.clearCookies();

    // Existing public web recovery still uses the original routes and /home destination.
    // Use a fresh signed-out context, independent of the deliberate account-switch test.
    const publicContext = await browser.newContext(); contexts.push(publicContext);
    page = await publicContext.newPage();
    await page.goto(`${base}/login`); await page.getByRole('link', { name: 'Forgot password?', exact: true }).click();
    // Both routes have #email. Wait for navigation before filling it, otherwise
    // the test can fill Login's field just before Forgot Password replaces it.
    await page.waitForURL('**/forgot-password', { timeout: 30000 });
    await page.locator('#email').fill(other.email);
    await page.getByRole('button', { name: 'Send Reset Code', exact: true }).click();
    await page.waitForURL('**/verify-otp?email=*', { timeout: 30000 });
    const loginCode = await deliveredCode(other.email);
    await page.getByRole('textbox', { name: '6-digit reset code' }).fill(loginCode);
    await page.getByRole('button', { name: 'Verify', exact: true }).click();
    await page.waitForURL('**/reset-password', { timeout: 30000 });
    const publicNext = `Aa1!${randomUUID()}`;
    await page.locator('#password').fill(publicNext); await page.locator('#confirmPassword').fill(publicNext);
    await page.getByRole('button', { name: 'Update Password', exact: true }).click();
    await page.waitForURL('**/home', { timeout: 30000 });
    pass('Existing web login code recovery still completes and returns to Home');
    must(await auth().auth.signInWithPassword({ email: other.email, password: publicNext }));

    // The unchanged Android flow uses these exact Auth operations.
    const native = auth(); must(await native.auth.resetPasswordForEmail(unverified.email));
    const nativeCode = await deliveredCode(unverified.email);
    const recovered = must(await native.auth.verifyOtp({ type: 'recovery', email: unverified.email, token: nativeCode }));
    assert.equal(recovered.user.id, unverified.id);
    const nativeNext = `Aa1!${randomUUID()}`; must(await native.auth.updateUser({ password: nativeNext }));
    must(await auth().auth.signInWithPassword({ email: unverified.email, password: nativeNext }));
    assert.ok((await auth().auth.signInWithPassword({ email: unverified.email, password: unverified.password })).error);
    pass('Unchanged Android recovery Auth sequence verifies a delivered code and updates the password');
  } catch (error) {
    if (page) {
      console.error(JSON.stringify({ path: new URL(page.url()).pathname, messages: await page.locator('.text-destructive').allTextContents().catch(() => []) }));
      await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    }
    throw error;
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    if (browser) await browser.close();
    if (server) { server.kill(); fs.writeFileSync(path.join(output, 'server.txt'), clean(serverLog)); }
    for (const account of accounts) {
      sql(`delete from public.profiles where id='${account.id}';`);
      must(await admin.auth.admin.deleteUser(account.id));
    }
    sql(`delete from public.barangay_localities where barangay_id='${tenant}'; delete from public.barangays where id='${tenant}';`);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, disposableAccountsRemoved: accounts.length }, null, 2));
  }
}

(async () => {
  if (process.argv[2] !== 'test') build();
  if (process.argv[2] !== 'build') await test();
})().catch(error => { console.error(clean(error.stack || String(error))); process.exitCode = 1; });
