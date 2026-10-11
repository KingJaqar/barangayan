// Disposable local Auth/Edge/PostgREST integration. No production sends.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const config = JSON.parse(execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(new URL(config.API_URL).hostname, '127.0.0.1');
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const auth = createClient(config.API_URL, config.ANON_KEY, options);
const must = result => { if (result.error) throw Error(`API failure: ${result.error.code ?? result.error.status ?? result.error.name}`); return result.data; };
const email = `verification-${randomUUID()}@local.test`, password = `Aa1!${randomUUID()}`;
let id;
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'postgres', '-XAt', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
try {
  id = must(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user.id;
  const session = must(await auth.auth.signInWithPassword({ email, password })).session;
  // Admin-created users without registration metadata intentionally lack a profile.
  const barangay = sql('select id from public.barangays limit 1;');
  assert.match(barangay, /^[a-f0-9-]{36}$/);
  must(await admin.from('profiles').insert({ id, barangay_id: barangay, role: 'resident', full_name: 'Local Verification', email }));
  const call = async (body, authorization = `Bearer ${session.access_token}`) => {
    const response = await fetch(`${config.API_URL}/functions/v1/verify-resident-email`, { method: 'POST', headers: { apikey: config.ANON_KEY, Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    return { status: response.status, data: await response.json() };
  };
  assert.equal((await call({ action: 'send' }, 'Bearer invalid')).status, 401);
  assert.equal((await call({ action: 'send', userId: randomUUID() })).status, 400);
  assert.equal((await call({ action: 'verify', code: '12' })).status, 400);
  assert.equal((await call({ action: 'verify', code: '000000' })).status, 400);
  assert.equal(must(await auth.from('profiles').select('email_verification_status').eq('id', id).single()).email_verification_status, 'unavailable');
  assert.deepEqual(await call({ action: 'send' }), { status: 200, data: { status: 'pending' } });
  assert.equal(must(await auth.from('profiles').select('email_verification_status').eq('id', id).single()).email_verification_status, 'pending');
  // Local admin generates a real Auth OTP; production tests must read actual mail.
  const link = must(await admin.auth.admin.generateLink({ type: 'magiclink', email }));
  assert.deepEqual(await call({ action: 'verify', code: link.properties.email_otp }), { status: 200, data: { status: 'verified' } });
  const profile = must(await auth.from('profiles').select('email_verification_status,email_verified_at').eq('id', id).single());
  assert.equal(profile.email_verification_status, 'verified'); assert.ok(profile.email_verified_at);
  assert.equal(must(await auth.auth.getUser()).user.id, id);
  const sessionCount = Number(sql(`select count(*) from auth.sessions where user_id='${id}';`));
  assert.equal(sessionCount, 1, 'Endpoint must retire only its ephemeral OTP session');
  const credential = createClient(config.API_URL, config.ANON_KEY, options);
  assert.equal(must(await credential.auth.signInWithPassword({ email, password })).user.id, id);
  await credential.auth.signOut({ scope: 'local' });
  assert.deepEqual(await call({ action: 'send' }), { status: 200, data: { status: 'verified' } });
  assert.ok((await auth.from('profiles').update({ email_verification_status: 'pending' }).eq('id', id)).error, 'Resident cannot forge verification fields');
  must(await auth.from('profiles').update({ email: `changed-${randomUUID()}@local.test` }).eq('id', id));
  assert.equal(must(await auth.from('profiles').select('email_verification_status').eq('id', id).single()).email_verification_status, 'unverified');
  assert.equal((await call({ action: 'send' })).status, 409);
  must(await auth.from('profiles').update({ email }).eq('id', id));
  sql(`update public.profiles set deleted_at=now() where id='${id}';`);
  assert.equal((await call({ action: 'send' })).status, 403);
  console.log('PASS local real Auth/Edge/REST: authenticated send, invalid codes, real OTP, protected badge, session/password preservation, idempotency, changed email and deleted caller');
} finally {
  await auth.auth.signOut({ scope: 'local' });
  if (id) must(await admin.auth.admin.deleteUser(id));
}
