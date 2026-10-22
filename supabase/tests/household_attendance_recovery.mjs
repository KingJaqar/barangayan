// Disposable local rehearsal only. Never accepts a remote connection string.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const database = process.env.ATTENDANCE_TEST_DB;
assert.ok(database && /^family_attendance_[a-z0-9_]+$/.test(database), 'Use a disposable family_attendance_* database.');
const container = process.env.ATTENDANCE_DB_CONTAINER ?? 'supabase_db_barangayan';
const owner = process.env.ATTENDANCE_DB_OWNER ?? 'supabase_admin';
assert.ok(['postgres', 'supabase_admin'].includes(owner));
const prefix = ['exec', '-i', container];
const args = [...prefix, 'psql', '-U', owner, '-d', database, '-X', '-At', '-v', 'ON_ERROR_STOP=1'];
const run = sql => execFileSync('docker', args, { input: sql, encoding: 'utf8', timeout: 30000 }).trim();
const json = sql => JSON.parse(run(sql).split('\n').findLast(line => line.startsWith('{')) ?? 'null');
const as = (actor, sql) => `begin; set local role authenticated; select set_config('request.jwt.claim.sub','${actor}',true); ${sql} commit;`;
const denied = sql => {
  const result = spawnSync('docker', args, { input: sql, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 3, result.stderr);
  return result.stderr;
};
const tenant = 'afa44000-0000-4000-8000-000000000001';
const actor = 'dfa44000-0000-4000-8000-000000000001';
const household = 'dfa44000-0000-4000-8000-000000000002';
const center = 'efa44000-0000-4000-8000-000000000001';
const request = randomUUID();
const arrival = `select public.check_in_household_members('${household}','${center}','[{"kind":"holder"}]','${request}');`;
const pause = readFileSync(new URL('../runbooks/family-attendance/pause.sql', import.meta.url), 'utf8');
const resume = readFileSync(new URL('../runbooks/family-attendance/resume.sql', import.meta.url), 'utf8');
const snapshot = `select jsonb_build_object('stays',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from public.household_attendance s),
  'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from barangayan_private.household_attendance_receipts r));`;
assert.equal(run(`select (select count(*) from public.household_attendance)+(select count(*) from barangayan_private.household_attendance_receipts)`), '0',
  'Rehearse only with empty attendance/receipts, never existing recorded data.');
assert.equal(run(`select count(*) from public.barangays where id='${tenant}'`), '0');
let initialized = false, paused = false;
try {
  run(`begin;
    insert into public.barangays(id,name) values('${tenant}','Synthetic release recovery');
    insert into auth.users(id,email) values('${actor}','release-actor@test.local'),('${household}','release-household@test.local');
    insert into public.profiles(id,barangay_id,role,full_name) values
      ('${actor}','${tenant}','admin','Synthetic staff'),('${household}','${tenant}','resident','Synthetic holder');
    insert into public.evacuation_centers(id,barangay_id,name,position,is_active) values
      ('${center}','${tenant}','Synthetic recovery center','{"lat":1,"lng":1}',true); commit;`);
  initialized = true;
  const receipt = json(as(actor, arrival));
  assert.equal(receipt.stays.length, 1);
  const closed = json(as(actor, `select public.check_out_household_attendance(array['${receipt.stays[0].attendance_id}'::uuid],'${randomUUID()}');`));
  assert.ok(closed.stays[0].checked_out_at);
  const nextArrival = arrival.replace(request, randomUUID());
  const later = json(as(actor, nextArrival));
  assert.notEqual(receipt.stays[0].attendance_id, later.stays[0].attendance_id);
  const before = json(snapshot);
  run(pause); paused = true;
  assert.match(denied(as(actor, arrival)), /permission denied for function check_in_household_members/);
  assert.match(denied(as(actor, `select public.check_out_household_attendance(array['${later.stays[0].attendance_id}'::uuid],'${randomUUID()}');`)),
    /permission denied for function check_out_household_attendance/);
  for (const schema of ['public', 'barangayan_private']) {
    for (const signature of ['check_in_household_members(uuid,uuid,jsonb,uuid)', 'check_out_household_attendance(uuid[],uuid)']) {
      for (const role of ['anon', 'authenticated', 'service_role'])
        assert.equal(run(`select has_function_privilege('${role}','${schema}.${signature}','execute')`), 'f');
    }
  }
  assert.equal(json(as(household, 'select public.get_my_household_attendance();')).people[0].current_stay.attendance_id, later.stays[0].attendance_id);
  assert.match(denied(as(household, `select public.check_in_to_evacuation_center('${center}');`)), /Ask barangay staff to scan your Family QR and confirm who is present/);
  assert.deepEqual(json(snapshot), before, 'Pausing must preserve stays and receipts.');
  const dump = execFileSync('docker', [...prefix, 'pg_dump', '-U', owner, '-d', database, '--data-only', '--column-inserts',
    '--table=public.household_attendance', '--table=barangayan_private.household_attendance_receipts'], { encoding: 'utf8', timeout: 30000 });
  // Every table row is a fixture. Roll back the restoration to preserve even these records.
  const restored = json(`begin; delete from barangayan_private.household_attendance_receipts; delete from public.household_attendance;
    ${dump}\n${snapshot}\nrollback;`);
  assert.deepEqual(restored, before, 'Every stored field, including receipt identity and timestamps, must restore exactly.');
  assert.deepEqual(json(snapshot), before, 'The recovery rehearsal must not lose the original records.');
  run(resume); paused = false;
  assert.deepEqual(json(as(actor, arrival)), receipt, 'Delayed arrival retry must return the closed original visit.');
  const departureRequest = closed.request_id;
  assert.deepEqual(json(as(actor, `select public.check_out_household_attendance(array['${receipt.stays[0].attendance_id}'::uuid],'${departureRequest}');`)), closed);
  assert.equal(json(as(household, 'select public.get_my_household_attendance();')).people[0].current_stay.attendance_id, later.stays[0].attendance_id);
  for (const role of ['anon', 'service_role'])
    assert.equal(run(`select has_function_privilege('${role}','public.check_in_household_members(uuid,uuid,jsonb,uuid)','execute')`), 'f');
  console.log(JSON.stringify({ database, result: 'pass', checks: ['paused arrivals and departures rejected at public/private boundaries',
    'resident reads continue and legacy writes remain blocked', 'two visits and three receipts unchanged during pause',
    'exact dump/restore of all stay and receipt fields', 'resume restores only authenticated mutation access',
    'delayed arrival/departure receipts replay exactly and leave the later stay open'],
    backup_sha256: createHash('sha256').update(dump).digest('hex') }, null, 2));
} finally {
  if (paused) run(resume);
  if (initialized) run(`begin;
    delete from barangayan_private.household_attendance_receipts where household_profile_id='${household}';
    delete from public.household_attendance where household_profile_id='${household}';
    delete from public.evacuation_centers where id='${center}';
    delete from public.profiles where id in ('${actor}','${household}');
    delete from auth.users where id in ('${actor}','${household}');
    delete from public.barangays where id='${tenant}'; commit;`);
}
