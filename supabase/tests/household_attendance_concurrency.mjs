// Real independent PostgreSQL sessions. Refuses shared/default database names.
// Run only after the migrations and rollback-only household_attendance.test.sql.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const database = process.env.ATTENDANCE_TEST_DB;
assert.ok(database && /^family_attendance_[a-z0-9_]+$/.test(database), 'ATTENDANCE_TEST_DB must name a disposable family_attendance_* database.');
const container = process.env.ATTENDANCE_DB_CONTAINER ?? 'supabase_db_barangayan';
const owner = process.env.ATTENDANCE_DB_OWNER ?? 'postgres';
assert.ok(['postgres', 'supabase_admin'].includes(owner), 'Use the verified local migration owner for fixture administration.');
const args = ['exec', '-i', container, 'psql', '-U', owner, '-d', database, '-X', '-At', '-v', 'ON_ERROR_STOP=1'];
const run = (sql) => execFileSync('docker', args, { input: sql, encoding: 'utf8', timeout: 15000 }).trim();
const id = (kind, n) => `dfa20000-${kind}-4000-8000-${String(n).padStart(12, '0')}`;
const tenant = id('0001', 1), otherTenant = id('0001', 2);
const admin = id('0002', 1), secondAdmin = id('0002', 2);
const rows = Array.from({ length: 22 }, (_, n) => ({
  household: id('0003', n + 1), center: id('0004', n + 1), member: id('0005', n + 1),
}));
const roster = (fixture) => JSON.stringify([{ id: fixture.member, name: 'Race member', relation: 'child' }]);
const participant = (fixture, member = false) => JSON.stringify(member ? [{ kind: 'member', member_id: fixture.member }] : [{ kind: 'holder' }]);
const arrival = (fixture, request = randomUUID(), member = false, center = fixture.center) =>
  `select public.check_in_household_members('${fixture.household}','${center}','${participant(fixture, member)}','${request}');`;
const resultJson = (text) => JSON.parse(text.split('\n').findLast((line) => line.startsWith('{') && line.includes('"stays"')) ?? 'null');

function session(name, uid, statement, hold = false) {
  const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '', err = '', signal;
  const ready = new Promise((resolve) => { signal = resolve; });
  const deadline = setTimeout(() => child.kill(), 20000);
  const result = new Promise((resolve) => {
    child.stdout.on('data', (chunk) => { out += chunk; if (out.includes('ATTENDANCE_READY')) signal(true); });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', (error) => { err += error.message; signal(false); });
    child.on('close', (code) => { clearTimeout(deadline); signal(false); resolve({ ok: code === 0, out, err }); });
  });
  child.stdin.on('error', () => { /* psql exits immediately on an expected SQL failure. */ });
  child.stdin.write(`begin; set local statement_timeout='12s'; set application_name='attendance-${name}';
    ${uid ? `set local role authenticated; select set_config('request.jwt.claim.sub','${uid}',true);` : ''}
    ${statement}
    select 'ATTENDANCE_READY';
    ${hold ? '' : 'commit;'}\n`);
  if (!hold) child.stdin.end();
  return { ready, result, output: () => out, release: () => child.stdin.end('commit;\n') };
}

async function blocked(name) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (run(`select count(*) from pg_stat_activity where datname=current_database() and application_name='attendance-${name}' and wait_event_type='Lock'`) === '1') return;
    await new Promise((resolve) => setTimeout(resolve, 70));
  }
  throw new Error(`${name} did not reach an observed database lock wait`);
}

const results = [];
async function race(name, firstUid, firstStatement, secondUid, secondStatement, expectedError) {
  const first = session(`${name}-first`, firstUid, firstStatement, true);
  if (!await first.ready) throw new Error(`${name}: first operation failed: ${(await first.result).err}`);
  const second = session(`${name}-second`, secondUid, secondStatement);
  try { await blocked(`${name}-second`); } finally { first.release(); }
  const [a, b] = await Promise.all([first.result, second.result]);
  assert.ok(a.ok, `${name}: ${a.err}`);
  if (expectedError) assert.ok(!b.ok && b.err.includes(expectedError), `${name}: expected ${expectedError}, got ${b.err}`);
  else assert.ok(b.ok, `${name}: ${b.err}`);
  results.push({ name, pass: true, observedLockWait: true });
  console.log(`PASS ${name}: observed independent connection waiting on a database lock`);
  return [resultJson(a.out), resultJson(b.out)];
}

function setup() {
  assert.equal(run(`select count(*) from public.barangays where id='${tenant}'`), '0', 'Fixture prefix already exists; use a fresh disposable database.');
  run(`insert into public.barangays(id,name) values ('${tenant}','Attendance concurrency A'),('${otherTenant}','Attendance concurrency B');
    insert into auth.users(id,email) select v,v::text||'@attendance.test.local' from unnest(array[
      ${[admin, secondAdmin, ...rows.map((r) => r.household)].map((v) => `'${v}'::uuid`).join(',')}]) v;
    insert into public.profiles(id,barangay_id,role,full_name) values
      ('${admin}','${tenant}','admin','Attendance administrator'),('${secondAdmin}','${tenant}','admin','Attendance second administrator');
    ${rows.map((r) => `insert into public.profiles(id,barangay_id,role,full_name,household_members) values
      ('${r.household}','${tenant}','resident','Attendance concurrency household','${roster(r)}');
      insert into public.evacuation_centers(id,barangay_id,name,position,is_active) values
      ('${r.center}','${tenant}','Attendance concurrency center','{"lat":1,"lng":1}',true);`).join('\n')}`);
}
function cleanup() {
  const households = rows.map((r) => `'${r.household}'::uuid`).join(',');
  run(`delete from barangayan_private.household_attendance_receipts where household_profile_id in (${households});
    delete from public.household_attendance where household_profile_id in (${households});
    delete from public.household_members where profile_id in (${households});
    delete from public.evacuation_centers where id in (${rows.map((r) => `'${r.center}'::uuid`).join(',')});
    delete from public.profiles where id in (${households},'${admin}','${secondAdmin}');
    delete from auth.users where id in (${households},'${admin}','${secondAdmin}');
    delete from public.barangays where id in ('${tenant}','${otherTenant}');`);
}

let initialized = false;
try {
  setup(); initialized = true;
  const [first, repeated] = await race('same-center', admin, arrival(rows[0]), secondAdmin, arrival(rows[0]));
  assert.equal(first.stays[0].attendance_id, repeated.stays[0].attendance_id);
  assert.equal(first.stays[0].checked_in_at, repeated.stays[0].checked_in_at);
  assert.equal(repeated.stays[0].outcome, 'already_active');
  await race('different-centers', admin, arrival(rows[1]), secondAdmin,
    arrival(rows[1], randomUUID(), false, rows[2].center), 'attendance_active_elsewhere');
  const sameKey = randomUUID();
  const [original, replay] = await race('same-request', admin, arrival(rows[2], sameKey), admin, arrival(rows[2], sameKey));
  assert.deepEqual(original, replay);
  await race('arrival-before-removal', admin, arrival(rows[3], randomUUID(), true), rows[3].household,
    `select public.save_resident_household_if_unchanged('[]','${roster(rows[3])}');`, 'attendance_lifecycle_conflict');
  await race('removal-before-arrival', rows[4].household,
    `select public.save_resident_household_if_unchanged('[]','${roster(rows[4])}');`, admin,
    arrival(rows[4], randomUUID(), true), 'household_roster_changed');
  for (const [offset, field, value] of [[5, 'deleted_at', 'clock_timestamp()'], [7, 'barangay_id', `'${otherTenant}'`]]) {
    await race(`arrival-before-center-${field}`, admin, arrival(rows[offset]), null,
      `update public.evacuation_centers set ${field}=${value} where id='${rows[offset].center}';`, 'attendance_lifecycle_conflict');
    await race(`center-${field}-before-arrival`, null,
      `update public.evacuation_centers set ${field}=${value} where id='${rows[offset + 1].center}';`, admin,
      arrival(rows[offset + 1]), 'attendance_center_unavailable');
  }
  await race('arrival-before-household-move', admin, arrival(rows[9]), null,
    `update public.profiles set barangay_id='${otherTenant}' where id='${rows[9].household}';`, 'attendance_lifecycle_conflict');
  await race('household-move-before-arrival', null,
    `update public.profiles set barangay_id='${otherTenant}' where id='${rows[10].household}';`, admin,
    arrival(rows[10]), 'household_unavailable');
  const revokeRequest = randomUUID();
  await race('arrival-before-role-revocation', secondAdmin, arrival(rows[11], revokeRequest), null,
    `update public.profiles set role='resident' where id='${secondAdmin}';`);
  const denied = await session('revoked-replay', secondAdmin, arrival(rows[11], revokeRequest)).result;
  assert.ok(!denied.ok && denied.err.includes('attendance_forbidden'));
  run(`update public.profiles set role='admin' where id='${secondAdmin}';`);
  await race('role-revocation-before-arrival', null,
    `update public.profiles set role='resident' where id='${secondAdmin}';`, secondAdmin,
    arrival(rows[12]), 'attendance_forbidden');
  run(`update public.profiles set role='admin' where id='${secondAdmin}';`);
  await race('arrival-before-auth-ban', secondAdmin, arrival(rows[13]), null,
    `update auth.users set banned_until=now()+interval '1 day' where id='${secondAdmin}';`);
  run(`update auth.users set banned_until=null where id='${secondAdmin}';`);
  await race('auth-ban-before-arrival', null,
    `update auth.users set banned_until=now()+interval '1 day' where id='${secondAdmin}';`, secondAdmin,
    arrival(rows[14]), 'attendance_forbidden');
  run(`update auth.users set banned_until=null where id='${secondAdmin}';`);
  await race('arrival-before-member-archive', admin, arrival(rows[15], randomUUID(), true), secondAdmin,
    `select public.admin_mutate_record('households','${rows[15].member}','archive','{}',
      (select updated_at from public.household_members where id='${rows[15].member}'));`, 'Record changed. Reload details.');
  await race('member-archive-before-arrival', secondAdmin,
    `select public.admin_mutate_record('households','${rows[16].member}','archive','{}',
      (select updated_at from public.household_members where id='${rows[16].member}'));`, admin,
    arrival(rows[16], randomUUID(), true), 'household_roster_changed');

  const timeoutKey = randomUUID();
  const holder = session('timeout-holder', null, `select 1 from public.profiles where id='${rows[17].household}' for update;`, true);
  assert.equal(await holder.ready, true);
  const started = Date.now();
  const timedOut = await session('timeout-contender', admin, arrival(rows[17], timeoutKey)).result;
  holder.release(); await holder.result;
  assert.ok(!timedOut.ok && /lock timeout/.test(timedOut.err), timedOut.err);
  assert.ok(Date.now() - started >= 4500 && Date.now() - started < 12000, 'Lock wait is bounded by five seconds.');
  const reconciled = await session('timeout-retry', admin, arrival(rows[17], timeoutKey)).result;
  assert.ok(reconciled.ok, reconciled.err);
  assert.equal(run(`select count(*) from barangayan_private.household_attendance_receipts where actor_profile_id='${admin}' and request_id='${timeoutKey}'`), '1');
  results.push({ name: 'bounded-timeout-explicit-retry', pass: true });
  const sharedMember = id('0005', 99);
  await race('cross-household-member-id', rows[18].household,
    `select public.save_resident_household_if_unchanged('[{"id":"${sharedMember}","name":"First owner","relation":"child"}]','${roster(rows[18])}');`,
    rows[19].household,
    `select public.save_resident_household_if_unchanged('[{"id":"${sharedMember}","name":"Forged owner","relation":"child"}]','${roster(rows[19])}');`,
    'household_roster_changed');
  assert.equal(run(`select profile_id||'|'||name from public.household_members where id='${sharedMember}'`), `${rows[18].household}|First owner`);
  const erase = `select set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'role','authenticated','amr',jsonb_build_array(
    jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint)))::text,true);
    select public.request_own_account_deletion();`;
  await race('arrival-before-household-erasure', admin, arrival(rows[20]), rows[20].household, erase);
  assert.equal(run(`select count(*) from public.household_attendance where household_profile_id='${rows[20].household}'`), '0');
  await race('household-erasure-before-arrival', rows[21].household, erase, admin, arrival(rows[21]), 'household_unavailable');
  assert.equal(run(`select count(*) from (select household_profile_id,household_member_id,count(*) from public.household_attendance
    where household_profile_id in (${rows.map((r) => `'${r.household}'::uuid`).join(',')}) and checked_out_at is null
    group by household_profile_id,household_member_id having count(*)>1) duplicates`), '0');
  console.log(JSON.stringify({ database, results, passed: results.length }, null, 2));
} finally {
  if (initialized) cleanup();
}
