// Phase 4 isolated local Auth/Mailpit/PostgREST integration. Never points at a hosted
// backend. Codes are read from the local Mailpit capture of the actual Auth sends and
// are never printed; synthetic @local.test identities are removed in `finally`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { build } from 'esbuild';

const config = JSON.parse(execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }));
assert.equal(new URL(config.API_URL).hostname, '127.0.0.1');
const MAIL = (config.INBUCKET_URL || config.MAILPIT_URL || 'http://127.0.0.1:54324').replace(/\/$/, '');
assert.equal(new URL(MAIL).hostname, '127.0.0.1');
const boundedFetch = (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) });
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: boundedFetch } };
const client = () => createClient(config.API_URL, config.ANON_KEY, options);
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'postgres', '-XAt', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const must = result => { if (result.error) throw new Error(`Auth/API failure: ${result.error.code || result.error.status || result.error.name}`); return result.data; };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const bundle = await build({ entryPoints: ['packages/shared/src/lib/resident-account-setup.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { residentSetupFailure } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

// ── Local Mailpit capture of real Auth sends ────────────────────────────────
const mailIds = new Set();
async function messages(to) {
  const response = await boundedFetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=50`);
  assert.equal(response.status, 200, 'local mail capture reachable');
  const list = (await response.json()).messages ?? [];
  list.forEach(message => mailIds.add(message.ID));
  return list;
}
async function nextMessage(to, seen) {
  for (let i = 0; i < 40; i++) {
    const fresh = (await messages(to)).filter(message => !seen.has(message.ID));
    if (fresh.length) { seen.add(fresh[0].ID); const body = await (await boundedFetch(`${MAIL}/api/v1/message/${fresh[0].ID}`)).json(); return `${body.Text ?? ''}\n${body.HTML ?? ''}`; }
    await sleep(250);
  }
  throw new Error('Expected Auth email was not captured');
}
const tokenHashOf = body => { const match = body.match(/[?&](?:amp;)?token=([a-f0-9]{20,})/i); assert.ok(match, 'captured email contains a token hash'); return match[1]; };
// The local default template carries only the link (the hosted template also shows the
// code). Auth's link token is sha224(email + code), so recover the code this real send
// issued instead of regenerating one through the Admin API.
const codeOf = (body, email) => {
  const shown = body.match(/\b(\d{6})\b/);
  if (shown) return shown[1];
  const hash = tokenHashOf(body).toLowerCase();
  for (let n = 0; n < 1_000_000; n++) {
    const code = String(n).padStart(6, '0');
    if (createHash('sha224').update(email + code).digest('hex') === hash) return code;
  }
  throw new Error('No six-digit code matches the captured Auth token');
};
const otherCode = code => String((Number(code) + 1) % 1_000_000).padStart(6, '0');
const lifecycle = id => sql(`select registration_origin||'/'||coalesce(password_set::text,'null')||'/'||password_evidence from barangayan_private.resident_account_lifecycle where user_id='${id}'`);
const hashDigest = id => sql(`select md5(coalesce(encrypted_password,'')) from auth.users where id='${id}'`);
const created = new Set();
const pass = label => console.log(`PASS ${label}`);

const barangay = 'a6091000-0000-0000-0000-000000000001';
sql(`insert into public.barangays(id,name) values ('${barangay}','Phase Four Local') on conflict do nothing;
 update public.barangay_localities set resident_registration_enabled=false;
 insert into public.barangay_localities values ('${barangay}','Ampid 1','San Mateo','Rizal',true) on conflict(barangay_id) do update set resident_registration_enabled=true;
 insert into public.document_types(id,barangay_id,name) values ('a6091000-0000-0000-0000-0000000000d1','${barangay}','Phase Four Document') on conflict do nothing;
 insert into public.medical_drives(id,barangay_id,title,type,drive_date,time_start,time_end,eligible_criteria,stock_total,stock_remaining)
  values ('a6091000-0000-0000-0000-0000000000e1','${barangay}','Phase Four Drive','vaccination',current_date+1,'08:00','12:00','All',10,10) on conflict do nothing;`);
const details = { firstName: 'Phase', lastName: 'Four', houseNo: '12', street: 'Main', sex: 'female', employmentStatus: 'student', mobileNumber: '09171234567', birthDate: '2000-01-01' };

try {
  // ── OTP-* : new account, resend, previous/consumed/malformed/expired codes ──
  const email = `phase4-${randomUUID()}@local.test`, seen = new Set(), auth = client();
  must(await auth.auth.signInWithOtp({ email, options: { data: { resident_registration_origin: 'email_otp' } } }));
  // Immediately, inside the configured one-second send interval.
  const quick = await auth.auth.signInWithOtp({ email });
  const id = sql(`select id from auth.users where email='${email}'`); created.add(id);
  const code1 = codeOf(await nextMessage(email, seen), email);
  assert.equal(lifecycle(id), 'email_otp/false/absent');
  assert.equal(quick.error?.status, 429);
  assert.equal(quick.error?.code, 'over_email_send_rate_limit');
  assert.equal(residentSetupFailure(quick.error).kind, 'rate_limit');
  await sleep(1500);
  assert.equal((await messages(email)).length, 1, 'rejected resend sent no email');
  pass('P4-OTP-1/P4-ABUSE-1 send captured a real six-digit code; an immediate resend is rejected 429 by Auth (max_frequency), mapped to wait/retry, and sends nothing');

  for (const malformed of ['12345', '1234567', 'abcdef', '']) {
    const result = await client().auth.verifyOtp({ email, token: malformed, type: 'email' });
    assert.ok(result.error && !result.data.session, 'malformed code rejected without a session');
  }
  const wrong = await client().auth.verifyOtp({ email, token: otherCode(code1), type: 'email' });
  assert.ok(wrong.error && !wrong.data.session);
  assert.ok(['expired_code', 'invalid_code'].includes(residentSetupFailure(wrong.error).kind));
  const anonStatus = await client().rpc('get_resident_account_setup_status');
  assert.ok(anonStatus.error, 'no status without a verified session');
  pass('P4-OTP-2 malformed and wrong codes are rejected by Auth with no session or status access; mapped to correct-code/resend guidance');

  must(await auth.auth.signInWithOtp({ email }));
  const code2 = codeOf(await nextMessage(email, seen), email);
  if (code2 !== code1) {
    const previous = await client().auth.verifyOtp({ email, token: code1, type: 'email' });
    assert.ok(previous.error && !previous.data.session, 'previous code rejected after resend');
  }
  const verified = must(await auth.auth.verifyOtp({ email, token: code2, type: 'email' }));
  assert.equal(verified.user.id, id);
  assert.deepEqual(must(await auth.rpc('get_resident_account_setup_status')), { registrationOrigin: 'email_otp', profileComplete: false, passwordSet: false, hasGoogleIdentity: false });
  const replay = await client().auth.verifyOtp({ email, token: code2, type: 'email' });
  assert.ok(replay.error && !replay.data.session, 'consumed code cannot be reused');
  assert.equal(lifecycle(id), 'email_otp/false/absent');
  pass('P4-OTP-3 resend: previous code rejected, latest verifies the same user, consumed code cannot be replayed; verification does not invent a password');

  await sleep(1200);
  must(await client().auth.signInWithOtp({ email }));
  const code3 = codeOf(await nextMessage(email, seen), email);
  sql(`update auth.users set recovery_sent_at=now()-interval '2 hours', confirmation_sent_at=now()-interval '2 hours' where id='${id}'`);
  const expired = await client().auth.verifyOtp({ email, token: code3, type: 'email' });
  assert.ok(expired.error && !expired.data.session);
  assert.equal(expired.error.code, 'otp_expired');
  assert.equal(residentSetupFailure(expired.error).kind, 'expired_code');
  pass('P4-OTP-4 a code older than the configured expiry is rejected otp_expired and mapped to request-a-new-code');

  // ── DB-* : direct REST submissions from a real JWT with incomplete profiles ──
  const submissions = authClient => [
    ['incident', () => authClient.from('incidents').insert({ barangay_id: barangay, reporter_id: id, title: 'Phase Four', location: { lat: 1, lng: 1 } })],
    ['document request', () => authClient.from('service_requests').insert({ barangay_id: barangay, resident_id: id, document_type_id: 'a6091000-0000-0000-0000-0000000000d1' })],
    // The resident app registers through this RPC; direct table inserts have no resident policy.
    ['health registration', () => authClient.rpc('register_for_drive', { p_drive_id: 'a6091000-0000-0000-0000-0000000000e1', p_age: 26, p_is_pwd: false, p_comorbidities: [] })],
  ];
  const directDrive = authClient => authClient.from('drive_registrations').insert({ drive_id: 'a6091000-0000-0000-0000-0000000000e1', user_id: id, applicant_number: `P4-${randomUUID().slice(0, 8)}`, age: 26 });
  const counts = () => sql(`select (select count(*) from public.incidents where reporter_id='${id}')||'/'||(select count(*) from public.service_requests where resident_id='${id}')||'/'||(select count(*) from public.drive_registrations where user_id='${id}')`);
  for (const [label, submit] of submissions(auth)) assert.ok((await submit()).error, `no-profile ${label} rejected`);
  must(await admin.from('profiles').insert({ id, barangay_id: barangay, role: 'resident', full_name: 'Phase Four', email }));
  for (const [label, submit] of submissions(auth)) {
    const result = await submit();
    assert.ok(result.error, `partial-profile ${label} rejected`);
    assert.match(`${result.error.message} ${result.error.code}`, /resident_profile_completion_required|42501/);
  }
  assert.equal(counts(), '0/0/0');
  must(await auth.rpc('complete_resident_profile', { p_input: details }));
  assert.equal((await auth.rpc('get_resident_account_setup_status')).data.profileComplete, true);
  for (const [label, submit] of submissions(auth)) { const result = await submit(); assert.ok(!result.error, `completed ${label} accepted (${result.error?.code})`); }
  assert.equal(counts(), '1/1/1');
  assert.ok((await directDrive(auth)).error, 'direct drive_registrations insert stays rejected even when complete');
  assert.equal(counts(), '1/1/1');
  pass('P4-DB-1 real-JWT REST incident/document inserts and the register_for_drive RPC are rejected without a profile and with a partial profile (resident_profile_completion_required); the same requests succeed after completion; direct drive_registrations inserts are always rejected');

  // ── EMAIL/OTP-* : existing completed account keeps identity and credential ──
  const existing = `phase4-existing-${randomUUID()}@local.test`, first = `Aa1!${randomUUID()}`, chosen = `Bb2!${randomUUID()}`;
  const existingId = must(await admin.auth.admin.createUser({ email: existing, password: first, email_confirm: true })).user.id; created.add(existingId);
  assert.equal(lifecycle(existingId), 'legacy/null/unknown_initial_hash');
  const owner = client();
  must(await owner.auth.signInWithPassword({ email: existing, password: first }));
  must(await owner.auth.updateUser({ password: chosen }));
  must(await admin.from('profiles').insert({ id: existingId, barangay_id: barangay, role: 'resident', full_name: 'Phase Existing', email: existing }));
  must(await owner.rpc('complete_resident_profile', { p_input: details }));
  const before = { status: must(await owner.rpc('get_resident_account_setup_status')), hash: hashDigest(existingId) };
  assert.deepEqual(before.status, { registrationOrigin: 'legacy', profileComplete: true, passwordSet: true, hasGoogleIdentity: false });
  const existingSeen = new Set(), otp = client();
  must(await otp.auth.signInWithOtp({ email: existing, options: { data: { resident_registration_origin: 'email_otp' } } }));
  const existingOtp = must(await otp.auth.verifyOtp({ email: existing, token: codeOf(await nextMessage(existing, existingSeen), existing), type: 'email' }));
  assert.equal(existingOtp.user.id, existingId);
  assert.deepEqual(must(await otp.rpc('get_resident_account_setup_status')), before.status);
  assert.equal(hashDigest(existingId), before.hash, 'OTP sign-in leaves the chosen credential unchanged');
  assert.equal(sql(`select count(*) from auth.users where email='${existing}'`), '1');
  assert.ok(!(await client().auth.signInWithPassword({ email: existing, password: chosen })).error, 'chosen password still works');
  assert.ok((await client().auth.signInWithPassword({ email: existing, password: first })).error, 'superseded password stays rejected');
  pass('P4-EMAIL-1 OTP for an existing completed account reaches the same user/profile, cannot relabel origin by metadata, and preserves the chosen password');

  // ── Staff invitation contract (admin-web invite route's Auth/DB calls) ───────
  const staffEmail = `phase4-staff-${randomUUID()}@local.test`, staffSeen = new Set();
  const invited = must(await admin.auth.admin.inviteUserByEmail(staffEmail)).user; created.add(invited.id);
  must(await admin.from('profiles').upsert({ id: invited.id, barangay_id: barangay, role: 'admin', full_name: 'Phase Staff', email: staffEmail }, { onConflict: 'id' }));
  must(await admin.from('barangay_officials').upsert({ profile_id: invited.id, barangay_id: barangay, official_role: 'staff' }, { onConflict: 'profile_id' }).select('id').single());
  assert.equal(lifecycle(invited.id), 'legacy/false/absent');
  const staff = client();
  const accepted = must(await staff.auth.verifyOtp({ token_hash: tokenHashOf(await nextMessage(staffEmail, staffSeen)), type: 'invite' }));
  assert.equal(accepted.user.id, invited.id);
  assert.ok((await staff.rpc('get_resident_account_setup_status')).error, 'staff never receives resident setup status');
  const staffPassword = `Cc3!${randomUUID()}`;
  must(await staff.auth.updateUser({ password: staffPassword }));
  assert.equal(lifecycle(invited.id), 'legacy/true/auth_password_write');
  assert.ok(!(await client().auth.signInWithPassword({ email: staffEmail, password: staffPassword })).error);
  assert.equal(sql(`select role from public.profiles where id='${invited.id}'`), 'admin');
  const rollbackEmail = `phase4-rollback-${randomUUID()}@local.test`;
  const rollback = must(await admin.auth.admin.inviteUserByEmail(rollbackEmail)).user;
  must(await admin.auth.admin.deleteUser(rollback.id));
  assert.equal(sql(`select count(*) from auth.users where id='${rollback.id}'`) + sql(`select count(*) from barangayan_private.resident_account_lifecycle where user_id='${rollback.id}'`), '00');
  await messages(rollbackEmail);
  pass('P4-INV-1 staff invitation: invite creates a passwordless legacy record, acceptance + password write is observed, staff stays outside resident setup, and the route rollback (deleteUser) leaves no orphaned lifecycle row');

  // ── P4-ABUSE-2: repeated wrong verification attempts ─────────────────────────
  // GoTrue enforces its per-IP limits (token_verifications) only when a client-IP
  // header is configured; the local stack sets none, so throttling itself is a
  // hosted (Phase 5) check. Locally, prove repeated guesses never yield a session
  // and that a 429, where Auth returns one, maps to wait/retry.
  const target = `phase4-verify-${randomUUID()}@local.test`, outcomes = {};
  for (let attempt = 0; attempt < 35; attempt++) {
    const result = await client().auth.verifyOtp({ email: target, token: String(attempt).padStart(6, '0'), type: 'email' });
    assert.ok(result.error && !result.data.session, 'a guessed code never yields a session');
    outcomes[result.error.status] = (outcomes[result.error.status] ?? 0) + 1;
  }
  assert.equal(residentSetupFailure({ status: 429, code: 'over_request_rate_limit' }).kind, 'rate_limit');
  const limitHeader = execFileSync('docker', ['exec', 'supabase_auth_barangayan', 'printenv'], { encoding: 'utf8' }).split('\n').some(line => line.startsWith('GOTRUE_RATE_LIMIT_HEADER=') && line.length > 25);
  pass(`P4-ABUSE-2 35 guessed codes rejected without a session (statuses ${JSON.stringify(outcomes)}); local IP rate-limit header configured: ${limitHeader} — hosted verification throttling remains a Phase 5 check`);
} finally {
  for (const userId of created) {
    const removed = await admin.auth.admin.deleteUser(userId);
    if (removed.error) console.log(`NOTE local fixture retained (${removed.error.code || removed.error.status}); disposable local database only`);
  }
  if (mailIds.size) await boundedFetch(`${MAIL}/api/v1/messages`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ IDs: [...mailIds] }) }).catch(() => {});
}
console.log('PASS Phase 4 local Auth/Mailpit/REST integration complete; no codes, passwords, tokens or keys emitted');
