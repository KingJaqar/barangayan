// Explicitly authorized bounded hosted proof. No fault injection, admin key,
// original-account credential writes, or secret output. OTPs arrive via stdin.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

assert.equal(process.argv[2], '--authorized-phase1-production-test');
const environment = Object.fromEntries(readFileSync('apps/resident-android-mobile/.env', 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
  const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
}));
const url = environment.EXPO_PUBLIC_SUPABASE_URL;
const key = environment.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname, 'pwjbucnyqexiepoinoke.supabase.co');
const email = `lospollosmaestros+phase1-${randomUUID().slice(0, 8)}@gmail.com`;
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const auth = client();
const clients = [auth];
const must = result => { if (result.error) throw Object.assign(new Error('Auth/API check failed'), { code: result.error.code || result.error.status || result.error.name }); return result.data; };
const status = async () => must(await auth.rpc('get_resident_account_setup_status'));
const emit = (event, detail = {}) => console.log(JSON.stringify({ event, ...detail }));
const login = async password => { const instance = client(); clients.push(instance); return instance.auth.signInWithPassword({ email, password }); };
if (process.stdin.isTTY) process.stdin.setRawMode(true); // Prevent terminal echo.
const input = createInterface({ input: process.stdin, terminal: false });
const timeout = setTimeout(() => { emit('FAIL', { check: 'Input timeout' }); process.exit(2); }, 15 * 60 * 1000);
let lastSend = 0;
let identity;
let changedPassword;
let stage = 'first';
const health = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
const healthData = await health.json();
assert.equal(healthData.version, 'v2.197.0');
emit('HEALTH_PASS', { version: healthData.version });
const sent = must(await auth.auth.signInWithOtp({ email, options: { data: { resident_registration_origin: 'email_otp' } } }));
assert.equal(sent.user, null); assert.equal(sent.session, null);
lastSend = Date.now();
emit('OTP_SENT', { email, branch: 'new', stage });

try {
  for await (const line of input) {
    const command = JSON.parse(line);
    if (stage === 'first' || stage === 'resend') {
      assert.match(command.code, /^\d{6}$/);
      const verified = must(await auth.auth.verifyOtp({ email, token: command.code, type: 'email' }));
      assert.ok(verified.session); assert.equal(verified.user.email, email);
      if (identity) assert.equal(verified.user.id, identity); else identity = verified.user.id;
      assert.deepEqual(await status(), { registrationOrigin: 'email_otp', profileComplete: false, passwordSet: false, hasGoogleIdentity: false });
      emit('OTP_VERIFIED_PASS', { stage, passwordSet: false, sameIdentity: true });
      if (stage === 'first') {
        must(await auth.auth.updateUser({ data: { passwordSet: true, resident_registration_origin: 'google', provider: 'google' } }));
        must(await auth.auth.refreshSession());
        assert.deepEqual(await status(), { registrationOrigin: 'email_otp', profileComplete: false, passwordSet: false, hasGoogleIdentity: false });
        emit('METADATA_REFRESH_PASS');
        const remaining = Math.max(0, 61000 - (Date.now() - lastSend));
        if (remaining) { emit('WAIT_RESEND', { milliseconds: remaining }); await new Promise(resolve => setTimeout(resolve, remaining)); }
        const resent = must(await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }));
        assert.equal(resent.user, null); assert.equal(resent.session, null);
        assert.equal((await status()).passwordSet, false);
        stage = 'resend';
        emit('OTP_SENT', { email, branch: 'resend', stage });
        continue;
      }
      const details = { firstName: 'Phase', lastName: 'Resident', houseNo: '12', street: 'Main', sex: 'female', employmentStatus: 'student', mobileNumber: '09171234567', birthDate: '2000-01-01' };
      const completions = await Promise.all(Array.from({ length: 3 }, () => auth.rpc('complete_resident_profile', { p_input: details })));
      completions.forEach(must);
      assert.equal((await status()).profileComplete, true);
      assert.equal((await status()).passwordSet, false);
      emit('PROFILE_CONCURRENT_PASS');
      const firstPassword = `Chosen1!${randomUUID()}`;
      must(await auth.auth.updateUser({ password: firstPassword }));
      assert.equal((await status()).passwordSet, true);
      assert.equal(must(await login(firstPassword)).user.id, identity);
      emit('PASSWORD_SETUP_PASS');
      changedPassword = `Changed1!${randomUUID()}`;
      must(await auth.auth.updateUser({ password: changedPassword }));
      assert.equal((await status()).passwordSet, true);
      assert.ok((await login(firstPassword)).error);
      assert.equal(must(await login(changedPassword)).user.id, identity);
      emit('PASSWORD_CHANGE_PASS', { oldRejected: true, newAccepted: true });
      assert.ok((await auth.rpc('get_resident_account_setup_status', { user_id: randomUUID() })).error);
      const session = must(await auth.auth.getSession()).session;
      const anonymous = await client().rpc('get_resident_account_setup_status');
      assert.ok(anonymous.error);
      const privateResponse = await fetch(`${url}/rest/v1/resident_account_lifecycle?select=*`, { headers: { apikey: key, Authorization: `Bearer ${session.access_token}` } });
      assert.ok(privateResponse.status >= 400);
      emit('REST_PERMISSION_PASS');
      must(await auth.auth.resetPasswordForEmail(email));
      stage = 'recovery';
      emit('RECOVERY_SENT', { email });
    } else if (stage === 'recovery') {
      // Prefer the received code. Token-hash form supports the same issued OTP
      // without opening a provider tracking link; neither form is logged.
      if (command.code) assert.match(command.code, /^\d{6}$/);
      else assert.match(command.tokenHash, /^[a-f0-9]{56}$/);
      const verified = must(await auth.auth.verifyOtp(command.code
        ? { email, token: command.code, type: 'recovery' }
        : { token_hash: command.tokenHash, type: 'recovery' }));
      assert.equal(verified.user.id, identity);
      const recoveredPassword = `Recovered1!${randomUUID()}`;
      must(await auth.auth.updateUser({ password: recoveredPassword }));
      assert.equal((await status()).passwordSet, true);
      assert.ok((await login(changedPassword)).error);
      assert.equal(must(await login(recoveredPassword)).user.id, identity);
      emit('RECOVERY_PASS', { oldRejected: true, newAccepted: true });
      for (const instance of clients) { if ((await instance.auth.getSession()).data.session) must(await instance.auth.signOut({ scope: 'local' })); }
      emit('COMPLETE', { signOut: true, retainedTestAccount: true, email });
      break;
    }
  }
} catch (error) {
  emit('FAIL', { check: error.code || error.name || 'unknown' });
  process.exitCode = 1;
} finally {
  clearTimeout(timeout); input.close();
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
}
