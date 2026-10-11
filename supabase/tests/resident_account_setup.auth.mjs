// Isolated Auth HTTP integration only. Never points at a hosted backend.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { build } from 'esbuild';

const config = JSON.parse(readFileSync('.env.phase1.local', 'utf8').replace(/^\uFEFF/, ''));
assert.equal(new URL(config.API_URL).hostname, '127.0.0.1');
const client = () => createClient(config.API_URL, config.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'postgres', '-XAt', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const must = result => { if (result.error) throw new Error(`Auth/API error: ${result.error.code || result.error.status || result.error.name}`); return result.data; };
const setup = async auth => must(await auth.rpc('get_resident_account_setup_status'));
const email = `phase1-${randomUUID()}@local.test`;
const auth = client();
sql("insert into public.barangays(id,name) values ('a6071000-0000-0000-0000-000000000001','Phase One Local') on conflict do nothing; update public.barangay_localities set resident_registration_enabled=false; insert into public.barangay_localities values ('a6071000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',true) on conflict(barangay_id) do update set resident_registration_enabled=true;");
must(await auth.auth.signInWithOtp({ email, options: { data: { resident_registration_origin: 'email_otp' } } }));
const id = sql(`select id from auth.users where email='${email}'`);
assert.equal(sql(`select password_set from barangayan_private.resident_account_lifecycle where user_id='${id}'`), 'f');
assert.equal(sql(`select (encrypted_password<>'') from auth.users where id='${id}'`), 't');
console.log('PASS actual OTP creation has a nonempty generated hash and passwordSet=false');
await new Promise(resolve => setTimeout(resolve, 1100));
must(await auth.auth.signInWithOtp({ email }));
assert.equal(sql(`select password_set from barangayan_private.resident_account_lifecycle where user_id='${id}'`), 'f');
console.log('PASS actual OTP resend preserves unset state');

// generateLink gives the real server-issued six-digit token for this isolated
// mailbox; OTP delivery itself was qualified in Phase 0. No token is logged.
const link = must(await admin.auth.admin.generateLink({ type: 'magiclink', email }));
must(await auth.auth.verifyOtp({ email, token: link.properties.email_otp, type: 'email' }));
assert.deepEqual(await setup(auth), { registrationOrigin: 'email_otp', profileComplete: false, passwordSet: false, hasGoogleIdentity: false });
must(await auth.auth.updateUser({ data: { passwordSet: true, resident_registration_origin: 'google', provider: 'google' } }));
must(await auth.auth.refreshSession());
assert.equal((await setup(auth)).passwordSet, false);
assert.equal((await setup(auth)).registrationOrigin, 'email_otp');
assert.equal((await setup(auth)).hasGoogleIdentity, false);
console.log('PASS verification/metadata spoofing/refresh do not invent credential or Google evidence');
const details = { firstName: 'Phase', lastName: 'Resident', houseNo: '12', street: 'Main', sex: 'female', employmentStatus: 'student', mobileNumber: '09171234567', birthDate: '2000-01-01' };
const schemaBundle = await build({ entryPoints: ['packages/shared/src/schemas/service-foundations.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { profileCompletionSchema } = await import(`data:text/javascript;base64,${Buffer.from(schemaBundle.outputFiles[0].text).toString('base64')}`);
const fixtures = [details, ...[
  { firstName: '' }, { firstName: 'Juan3' }, { firstName: ' José ' }, { firstName: ' Mary\tAnn ' },
  { houseNo: ' '.repeat(20) }, { houseNo: '\u00a0' }, { street: '😀'.repeat(251) },
  { middleName: 'x'.repeat(201) }, { suffix: null }, { occupation: '' },
  { mobileNumber: ' 09171234567' }, { sex: 'other' }, { employmentStatus: 'invalid' },
  { birthDate: '2001-02-29' }, { birthDate: '2000-02-29' }, { birthDate: '9999-01-01' }, { birthDate: '0000-01-01' },
].map(change => ({ ...details, ...change }))];
for (const fixture of fixtures) {
  const value = JSON.stringify(fixture).replaceAll("'", "''");
  assert.equal(sql(`select barangayan_private.resident_details_complete('${value}'::jsonb)`), profileCompletionSchema.safeParse(fixture).success ? 't' : 'f', 'Shared/SQL completeness fixture mismatch');
}
console.log(`PASS ${fixtures.length} shared-schema/SQL completeness parity fixtures`);
must(await auth.rpc('complete_resident_profile', { p_input: details }));
assert.equal((await setup(auth)).profileComplete, true);
const completions = await Promise.all(Array.from({ length: 5 }, () => auth.rpc('complete_resident_profile', { p_input: details })));
completions.forEach(must);
assert.equal(sql(`select count(*) from public.profiles where id='${id}'`), '1');
console.log('PASS profile-less account completion and concurrent same-user retries create one profile');
const password = `Chosen1!${randomUUID()}`;
const simultaneous = await Promise.all([auth.auth.updateUser({ password }), auth.rpc('complete_resident_profile', { p_input: details })]);
simultaneous.forEach(must);
assert.equal((await setup(auth)).passwordSet, true);
must(await client().auth.signInWithPassword({ email, password }));
const changed = `Changed1!${randomUUID()}`;
must(await auth.auth.updateUser({ password: changed }));
assert.equal((await setup(auth)).passwordSet, true);
assert.ok((await client().auth.signInWithPassword({ email, password })).error);
must(await client().auth.signInWithPassword({ email, password: changed }));
console.log('PASS actual setup/change, old credential rejection and new credential sign-in');
const recovery = must(await admin.auth.admin.generateLink({ type: 'recovery', email }));
const recovering = client();
must(await recovering.auth.verifyOtp({ token_hash: recovery.properties.hashed_token, type: 'recovery' }));
const recovered = `Recovered1!${randomUUID()}`;
must(await recovering.auth.updateUser({ password: recovered }));
assert.equal((await setup(recovering)).passwordSet, true);
assert.ok((await client().auth.signInWithPassword({ email, password: changed })).error);
must(await client().auth.signInWithPassword({ email, password: recovered }));
console.log('PASS actual recovery credential update and sign-in');
sql(`alter table barangayan_private.resident_account_lifecycle add constraint phase1_fail_password_write check(user_id<>'${id}' or password_evidence<>'auth_password_write') not valid;`);
try {
  const failedPassword = `Rejected1!${randomUUID()}`;
  assert.ok((await recovering.auth.updateUser({ password: failedPassword })).error);
  must(await client().auth.signInWithPassword({ email, password: recovered }));
  assert.ok((await client().auth.signInWithPassword({ email, password: failedPassword })).error);
  assert.equal((await setup(recovering)).passwordSet, true);
  console.log('PASS lifecycle observer failure rolls back password write and preserves working credential');
} finally { sql('alter table barangayan_private.resident_account_lifecycle drop constraint phase1_fail_password_write;'); }
const saved = sql(`select to_jsonb(p) from public.profiles p where id='${id}'`);
const googleId = randomUUID();
sql(`insert into auth.identities(id,user_id,provider_id,provider,identity_data) values ('${googleId}','${id}','${googleId}','google','{"given_name":"Provider","family_name":"Name"}');`);
assert.equal((await setup(recovering)).hasGoogleIdentity, true);
assert.equal((await setup(recovering)).registrationOrigin, 'email_otp');
must(await recovering.rpc('ensure_google_resident_profile'));
assert.equal(sql(`select to_jsonb(p) from public.profiles p where id='${id}'`), saved);
sql(`delete from auth.identities where id='${googleId}'`);
assert.equal((await setup(recovering)).hasGoogleIdentity, false);
assert.equal((await setup(recovering)).passwordSet, true);
console.log('PASS Auth-managed Google identity linking/unlinking and provisioning preserve profile/origin/password');
const legacyEmail = `phase1-legacy-${randomUUID()}@local.test`;
const legacyPassword = `Legacy1!${randomUUID()}`;
must(await admin.auth.admin.createUser({ email: legacyEmail, password: legacyPassword, email_confirm: true }));
const legacy = client();
must(await legacy.auth.signInWithPassword({ email: legacyEmail, password: legacyPassword }));
assert.equal((await setup(legacy)).passwordSet, null);
assert.equal((await setup(legacy)).registrationOrigin, 'legacy');
console.log('PASS legacy initial credential remains usable with unknown provenance');
const anonResponse = await fetch(`${config.API_URL}/rest/v1/rpc/get_resident_account_setup_status`, { method: 'POST', headers: { apikey: config.ANON_KEY, Authorization: `Bearer ${config.ANON_KEY}`, 'Content-Type': 'application/json' }, body: '{}' });
assert.ok(anonResponse.status >= 400);
const forged = await recovering.rpc('get_resident_account_setup_status', { user_id: randomUUID() });
assert.ok(forged.error);
const privateResponse = await fetch(`${config.API_URL}/rest/v1/resident_account_lifecycle?select=*`, { headers: { apikey: config.ANON_KEY, Authorization: `Bearer ${must(await recovering.auth.getSession()).session.access_token}` } });
assert.ok(privateResponse.status >= 400);
console.log('PASS actual REST rejects anonymous/other-user status arguments/private table exposure');
sql(`update public.profiles set deleted_at=now() where id='${id}'`);
try {
  assert.equal((await recovering.rpc('get_resident_account_setup_status')).error?.code, '42501');
  assert.equal((await recovering.rpc('complete_resident_profile', { p_input: details })).error?.code, '42501');
  const rejected = await recovering.from('incidents').insert({ barangay_id: 'a6071000-0000-0000-0000-000000000001', reporter_id: id, title: 'Earlier JWT', location: { lat: 1, lng: 1 } });
  assert.equal(rejected.error?.code, '42501');
  console.log('PASS earlier access JWT cannot resume deleted profile setup or submit an incident');
} finally { sql(`update public.profiles set deleted_at=null where id='${id}'`); }

// Force a private lifecycle insertion failure only for an isolated test email.
// This constraint is removed in finally, even if the assertion fails.
const failing = `phase1-fail-${randomUUID()}@local.test`;
sql(`alter table barangayan_private.resident_account_lifecycle add constraint phase1_injected_failure check(user_id not in ('00000000-0000-0000-0000-000000000000')); create function barangayan_private.phase1_fail_creation() returns trigger language plpgsql as $$ begin if new.email='${failing}' then new.id:='00000000-0000-0000-0000-000000000000'; end if; return new; end $$; create trigger phase1_fail_creation before insert on auth.users for each row execute function barangayan_private.phase1_fail_creation();`);
try {
  assert.ok((await client().auth.signInWithOtp({ email: failing, options: { data: { resident_registration_origin: 'email_otp' } } })).error);
  assert.equal(sql(`select count(*) from auth.users where email='${failing}'`), '0');
  console.log('PASS Auth trigger failure rolls back account creation');
} finally {
  sql('drop trigger phase1_fail_creation on auth.users; drop function barangayan_private.phase1_fail_creation(); alter table barangayan_private.resident_account_lifecycle drop constraint phase1_injected_failure;');
}
console.log('PASS isolated Auth lifecycle integration complete; no passwords/tokens/keys emitted');
