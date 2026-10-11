// Phase 4 upgrade rehearsal on the disposable LOCAL stack only: replay migrations up to
// 0106, create representative pre-feature accounts through the real Auth Admin API,
// apply the pending feature migrations with the CLI, then verify backfill categories,
// unchanged credentials, caller status, observer behavior and backfill replay. Finally
// restores the full local replay. Never targets a linked/hosted project.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const cli = (...args) => execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000 });
const config = JSON.parse(cli('status', '-o', 'json'));
assert.equal(new URL(config.API_URL).hostname, '127.0.0.1');
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'postgres', '-XAt', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } };
const client = () => createClient(config.API_URL, config.ANON_KEY, options);
const admin = () => createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const must = result => { if (result.error) throw new Error(`Auth/API failure: ${result.error.code || result.error.status || result.error.name}`); return result.data; };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const pass = label => console.log(`PASS ${label}`);
const pending = ['0107', '0108', '0109'];
const applied = () => sql('select version from supabase_migrations.schema_migrations order by version').split('\n');
async function authReady() {
  for (let i = 0; i < 60; i++) {
    try { if (!(await admin().auth.admin.listUsers({ perPage: 1 })).error) return; } catch { /* restarting */ }
    await sleep(1000);
  }
  throw new Error('Local Auth did not become ready after reset');
}

let restored = false;
try {
  cli('db', 'reset', '--local', '--no-seed', '--version', '0106', '--yes');
  await authReady();
  const before = applied();
  assert.equal(before.at(-1), '0106');
  for (const version of pending) assert.ok(!before.includes(version));
  assert.equal(sql("select to_regclass('barangayan_private.resident_account_lifecycle') is null"), 't');
  pass('P4-UPG-1 local database replayed to 0106; 0107-0109 pending and no lifecycle table exists');

  // ── Representative existing state, created through the real Auth Admin API ──
  const barangay = 'a6092000-0000-0000-0000-000000000001';
  sql(`insert into public.barangays(id,name) values ('${barangay}','Upgrade Local') on conflict do nothing;
   update public.barangay_localities set resident_registration_enabled=false;
   insert into public.barangay_localities values ('${barangay}','Ampid 1','San Mateo','Rizal',true) on conflict(barangay_id) do update set resident_registration_enabled=true;`);
  const svc = admin(), accounts = {}, secrets = {};
  async function account(key, { password = true, google = false, emailIdentity = true } = {}) {
    const email = `upgrade-${key}-${randomUUID()}@local.test`;
    secrets[key] = password ? `Aa1!${randomUUID()}` : null;
    const user = must(await svc.auth.admin.createUser({ email, ...(password ? { password: secrets[key] } : {}), email_confirm: true })).user;
    // Admin createUser stores a generated hash even without a password; accounts
    // created by Google OAuth have none (the hosted Google-only residents).
    if (!password) sql(`update auth.users set encrypted_password='' where id='${user.id}'`);
    if (google) {
      sql(`insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at,last_sign_in_at)
        values (gen_random_uuid(),'${randomUUID()}','${user.id}',jsonb_build_object('sub','${randomUUID()}','email','${email}'),'google',now(),now(),now());
       update auth.users set raw_app_meta_data=raw_app_meta_data||'{"provider":"${emailIdentity ? 'email' : 'google'}","providers":${emailIdentity ? '["email","google"]' : '["google"]'}}' where id='${user.id}';`);
      if (!emailIdentity) sql(`delete from auth.identities where user_id='${user.id}' and provider='email'`);
    }
    accounts[key] = { id: user.id, email };
    return accounts[key];
  }
  const profile = (key, extra = '') => sql(`insert into public.profiles(id,barangay_id,role,full_name,email${extra ? ',' + extra.split('=')[0] : ''})
    values ('${accounts[key].id}','${barangay}','${key === 'staff' ? 'admin' : 'resident'}','Upgrade ${key}','${accounts[key].email}'${extra ? ',' + extra.split('=')[1] : ''})
    on conflict (id) do nothing`); // keep a profile an existing pre-feature trigger already created
  await account('complete'); profile('complete');
  await account('partial'); profile('partial');
  await account('googleOnly', { password: false, google: true, emailIdentity: false }); profile('googleOnly');
  await account('linked', { google: true }); profile('linked');
  await account('staff'); profile('staff');
  await account('noProfile');
  await account('deleted'); profile('deleted', "deleted_at=now()");
  const invitedEmail = `upgrade-invited-${randomUUID()}@local.test`;
  accounts.invited = { id: must(await svc.auth.admin.inviteUserByEmail(invitedEmail)).user.id, email: invitedEmail };
  // Pre-feature completion path and a pre-existing verified badge.
  const old = client();
  must(await old.auth.signInWithPassword({ email: accounts.complete.email, password: secrets.complete }));
  must(await old.rpc('complete_resident_profile', { p_input: { firstName: 'Upgrade', lastName: 'Complete', houseNo: '12', street: 'Main', sex: 'female', employmentStatus: 'student', mobileNumber: '09171234567', birthDate: '2000-01-01' } }));
  sql(`update public.profiles set email_verification_status='verified', email_verified_at=now() where id='${accounts.complete.id}'`);
  const digests = () => Object.fromEntries(sql(`select id||'='||md5(coalesce(encrypted_password,'')) from auth.users`).split('\n').map(line => line.split('=')));
  const hashesBefore = digests();
  const userCount = sql('select count(*) from auth.users');
  pass(`P4-UPG-2 representative pre-feature state: ${userCount} Auth users incl. complete/partial/no-profile residents, Google-only, linked, staff, deleted and pending invitation`);

  // ── Apply the pending feature migrations with the CLI ─────────────────────
  const output = cli('migration', 'up', '--local');
  const after = applied();
  for (const version of pending) assert.ok(after.includes(version), `${version} applied`);
  assert.match(output, /0107|Applying/i);
  pass('P4-UPG-3 `migration up --local` applied 0107, 0108 and 0109 over existing data without error');

  const category = key => sql(`select registration_origin||'/'||coalesce(password_set::text,'null')||'/'||password_evidence from barangayan_private.resident_account_lifecycle where user_id='${accounts[key].id}'`);
  assert.equal(sql('select count(*) from barangayan_private.resident_account_lifecycle'), userCount);
  const expected = { complete: 'legacy/null/unknown_initial_hash', partial: 'legacy/null/unknown_initial_hash', googleOnly: 'legacy/false/absent', linked: 'legacy/null/unknown_initial_hash',
    staff: 'legacy/null/unknown_initial_hash', noProfile: 'legacy/null/unknown_initial_hash', deleted: 'legacy/null/unknown_initial_hash', invited: 'legacy/false/absent' };
  for (const [key, value] of Object.entries(expected)) assert.equal(category(key), value, key);
  assert.equal(sql("select count(*) from barangayan_private.resident_account_lifecycle where password_set is true"), '0');
  assert.deepEqual(digests(), hashesBefore);
  const counts = sql("select password_evidence||':'||count(*) from barangayan_private.resident_account_lifecycle group by password_evidence order by password_evidence").replace(/\n/g, ', ');
  pass(`P4-UPG-4 backfill: one record per Auth user (${counts}); hash present → unknown, absent → false, none assumed chosen; every credential hash unchanged`);

  // ── Caller status and existing logins after upgrade ────────────────────────
  const signIn = async key => { const auth = client(); must(await auth.auth.signInWithPassword({ email: accounts[key].email, password: secrets[key] })); return auth; };
  const status = async auth => must(await auth.rpc('get_resident_account_setup_status'));
  const complete = await signIn('complete');
  assert.deepEqual(await status(complete), { registrationOrigin: 'legacy', profileComplete: true, passwordSet: null, hasGoogleIdentity: false });
  assert.deepEqual(await status(await signIn('partial')), { registrationOrigin: 'legacy', profileComplete: false, passwordSet: null, hasGoogleIdentity: false });
  assert.deepEqual(await status(await signIn('linked')), { registrationOrigin: 'legacy', profileComplete: false, passwordSet: null, hasGoogleIdentity: true });
  const google = client(), link = must(await svc.auth.admin.generateLink({ type: 'magiclink', email: accounts.googleOnly.email }));
  must(await google.auth.verifyOtp({ email: accounts.googleOnly.email, token: link.properties.email_otp, type: 'email' }));
  assert.deepEqual(await status(google), { registrationOrigin: 'legacy', profileComplete: false, passwordSet: false, hasGoogleIdentity: true });
  assert.ok((await (await signIn('staff')).rpc('get_resident_account_setup_status')).error, 'staff fails closed');
  assert.ok((await (await signIn('deleted')).rpc('get_resident_account_setup_status')).error, 'deleted profile fails closed');
  const noProfile = await (await signIn('noProfile')).rpc('get_resident_account_setup_status');
  assert.ok(noProfile.error || (noProfile.data.passwordSet === null && noProfile.data.profileComplete === false), 'no invented state without a profile');
  assert.equal(sql(`select email_verification_status from public.profiles where id='${accounts.complete.id}'`), 'verified');
  pass('P4-UPG-5 existing password logins work; status is legacy/unknown (never "not set") for hashed accounts, false for Google-only, Google from identities, staff/deleted fail closed; pre-existing completion and verified badge preserved');

  // ── Observer, 0109 trigger and backfill replay after upgrade ───────────────
  const chosen = `Bb2!${randomUUID()}`;
  must(await complete.auth.updateUser({ password: chosen }));
  assert.equal(category('complete'), 'legacy/true/auth_password_write');
  assert.equal((await status(complete)).passwordSet, true);
  const backfill = readFileSync('supabase/migrations/0107_resident_account_setup_lifecycle.sql', 'utf8').match(/insert into barangayan_private\.resident_account_lifecycle\(user_id,registration_origin,password_set,password_evidence\)\s*select[\s\S]*?on conflict\(user_id\) do nothing;/)?.[0];
  assert.ok(backfill, 'backfill statement located in 0107');
  const snapshot = () => sql('select string_agg(user_id||registration_origin||coalesce(password_set::text,\'n\')||password_evidence, \',\' order by user_id) from barangayan_private.resident_account_lifecycle');
  const beforeReplay = snapshot();
  sql(backfill);
  assert.equal(snapshot(), beforeReplay);
  sql(`update public.profiles set email='changed-${randomUUID()}@local.test' where id='${accounts.complete.id}'`);
  assert.equal(sql(`select email_verification_status from public.profiles where id='${accounts.complete.id}'`), 'unverified');
  pass('P4-UPG-6 a real post-upgrade password write is observed; replaying the 0107 backfill statement changes nothing (known chosen password kept); 0109 clears the badge only when the email changes');

  cli('db', 'reset', '--local', '--no-seed', '--yes');
  await authReady();
  assert.ok(applied().includes('0109'));
  restored = true;
  pass('P4-UPG-7 local database restored by a full fresh replay through 0109');
} finally {
  if (!restored) {
    try { cli('db', 'reset', '--local', '--no-seed', '--yes'); console.log('NOTE local database restored after failure'); }
    catch { console.log('NOTE local restore failed; run `supabase db reset --local --no-seed --yes`'); }
  }
}
console.log('PASS upgrade rehearsal complete; no passwords, tokens or keys emitted');
