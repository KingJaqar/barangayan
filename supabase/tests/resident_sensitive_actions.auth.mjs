// Phase 3 sensitive-action boundary. Isolated local Auth/Edge/REST only: it records
// what the SERVER enforces for direct password-update and account-deletion requests,
// separately from the Android application's own fresh-authentication checks.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const config = JSON.parse(readFileSync('.env.phase1.local', 'utf8').replace(/^﻿/, ''));
assert.equal(new URL(config.API_URL).hostname, '127.0.0.1');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = () => createClient(config.API_URL, config.ANON_KEY, options);
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'postgres', '-XAt', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const must = result => { if (result.error) throw new Error(`Auth/API error: ${result.error.code || result.error.status || result.error.name}`); return result.data; };
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const details = { firstName: 'Phase', lastName: 'Three', houseNo: '3', street: 'Main', sex: 'female', employmentStatus: 'student', mobileNumber: '09171234567', birthDate: '2000-01-01' };
const remove = async (authorization, body) => {
  const headers = { apikey: config.ANON_KEY, 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) };
  const response = await fetch(`${config.API_URL}/functions/v1/delete-my-account`, { method: 'POST', headers, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(60000) });
  return response.status;
};
sql("insert into public.barangays(id,name) values ('a6071000-0000-0000-0000-000000000001','Phase One Local') on conflict do nothing; update public.barangay_localities set resident_registration_enabled=false; insert into public.barangay_localities values ('a6071000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',true) on conflict(barangay_id) do update set resident_registration_enabled=true;");

async function resident(label) {
  const email = `phase3-${label}-${randomUUID()}@local.test`, password = `Aa1!${randomUUID()}`;
  const created = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  const auth = client();
  const signedIn = must(await auth.auth.signInWithPassword({ email, password }));
  must(await auth.rpc('complete_resident_profile', { p_input: details }));
  return { id: created.user.id, email, password, auth, session: signedIn.session };
}
const passwordWorks = async (email, password) => !(await client().auth.signInWithPassword({ email, password })).error;

// SA-1: Auth-issued authentication evidence used by the Android freshness check.
const a = await resident('amr');
const first = claims(a.session.access_token);
assert.equal(first.sub, a.id);
assert.deepEqual(first.amr.map(entry => entry.method), ['password']);
await pause(1100);
const refreshed = must(await a.auth.auth.refreshSession()).session;
const second = claims(refreshed.access_token);
assert.equal(second.session_id, first.session_id);
assert.equal(second.amr[0].timestamp, first.amr[0].timestamp);
assert.ok(second.iat > first.iat);
const again = must(await client().auth.signInWithPassword({ email: a.email, password: a.password })).session;
const third = claims(again.access_token);
assert.notEqual(third.session_id, first.session_id);
assert.ok(third.amr[0].timestamp > first.amr[0].timestamp);
console.log('PASS SA-1 amr records the sign-in method/time; refresh keeps it; a new sign-in issues a new session and time');

// SA-2: direct password update needs neither the current password nor fresh auth.
const next = `Bb2@${randomUUID()}`;
must(await a.auth.auth.updateUser({ password: next }));
assert.equal(await passwordWorks(a.email, a.password), false);
assert.equal(await passwordWorks(a.email, next), true);
assert.equal(sql(`select password_set from barangayan_private.resident_account_lifecycle where user_id='${a.id}'`), 't');
console.log('PASS SA-2 server accepts a direct updateUser password write from a refreshed, non-reauthenticated session (secure_password_change=false); lifecycle records it');

// SA-3: deletion has no target parameter and no fresh-auth requirement on the server.
const b = await resident('delete');
const bystander = await resident('bystander');
assert.equal(await remove(null), 401);
const old = must(await b.auth.auth.refreshSession()).session;
assert.equal(await remove(`Bearer ${old.access_token}`, { user_id: bystander.id }), 200);
assert.match(sql(`select (deleted_at is not null)::text from public.profiles where id='${b.id}'`), /true/);
assert.equal(sql(`select (deleted_at is null)::text from public.profiles where id='${bystander.id}'`), 'true');
assert.equal(sql(`select (banned_until > now() + interval '50 years')::text from auth.users where id='${b.id}'`), 'true');
assert.equal(await passwordWorks(b.email, b.password), false);
assert.equal(await passwordWorks(bystander.email, bystander.password), true);
const retry = await remove(`Bearer ${old.access_token}`);
console.log(`PASS SA-3 anonymous delete 401; caller-only deletion from a refreshed session 200 (no server fresh-auth check); target body ignored; ban blocks sign-in; earlier-JWT retry status ${retry}`);
assert.notEqual(sql(`select count(*) from public.profiles where id='${b.id}' and deleted_at is not null`), '0');

for (const user of [a, bystander]) await admin.auth.admin.deleteUser(user.id);
console.log('PASS local fixtures cleaned (the deleted/banned fixture stays as anonymized history)');
