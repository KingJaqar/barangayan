// Resident iOS Phase 3 (P03-T08): concurrency proof for the write boundaries, using
// parallel database sessions that each carry a different authenticated JWT claim set.
//
// Isolated databases only: it COMMITS fixtures, so it refuses to run unless
// P3_TEST_DB names a disposable database (never `postgres`). Example:
//   P3_TEST_DB=p03_ios node supabase/tests/resident_ios_phase3_concurrency.mjs
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const database = process.env.P3_TEST_DB;
assert.ok(database && database !== 'postgres' && /^[a-z0-9_]+$/.test(database), 'Set P3_TEST_DB to a disposable database name (not postgres).');
const container = process.env.P3_DB_CONTAINER ?? 'supabase_db_barangayan';
const psqlArgs = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-X', '-At', '-v', 'ON_ERROR_STOP=1'];

const run = sql => execFileSync('docker', psqlArgs, { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
function runAs(userId, statement) {
  const sql = `begin; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"${userId}","role":"authenticated"}',true),
       set_config('request.jwt.claim.sub','${userId}',true);
${statement}
commit;`;
  return new Promise(resolve => {
    const child = spawn('docker', psqlArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('close', code => resolve({ ok: code === 0, out: out.trim(), err: err.trim() }));
    child.stdin.end(sql);
  });
}

const prefix = 'c0ffee00';
const id = (kind, n) => `${prefix}-${kind}-4000-8000-${String(n).padStart(12, '0')}`;
const barangay = id('0001', 1);
const residents = Array.from({ length: 8 }, (_, i) => id('0002', i + 1));
const center = id('0003', 1);
const drive = id('0004', 1);
const incident = id('0005', 1);
const reporter = id('0006', 1);
const household = id('0007', 1);

function setup() {
  run(`
insert into public.barangays(id,name) values ('${barangay}','P3 Concurrency');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
select u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',u||'@p3.local','',now(),'','','','','{}','{}',false,now(),now()
from unnest(array[${[...residents, reporter, household].map(v => `'${v}'::uuid`).join(',')}]) u;
insert into public.profiles(id,barangay_id,role,full_name,first_name,last_name,house_no,street,sex,employment_status,mobile_number,birth_date)
select u,'${barangay}','resident','Concurrent Resident','Concurrent','Resident','1','Fixture','female','student','09171234567','2000-01-01'
from unnest(array[${[...residents, reporter, household].map(v => `'${v}'::uuid`).join(',')}]) u;
insert into public.evacuation_centers(id,barangay_id,name,position,is_active) values ('${center}','${barangay}','P3 Center','{"lat":1,"lng":1}',true);
insert into public.medical_drives(id,barangay_id,title,type,drive_date,time_start,time_end,eligible_criteria,stock_total,stock_remaining)
values ('${drive}','${barangay}','P3 Drive','vaccination',current_date+1,'08:00','12:00','All',3,3);
insert into public.incidents(id,barangay_id,reporter_id,title,location,status)
values ('${incident}','${barangay}','${reporter}','P3 incident','{"lat":1,"lng":1}','open');`);
}
function cleanup() {
  run(`
delete from public.push_tokens where user_id in (select id from public.profiles where barangay_id='${barangay}');
delete from public.evacuation_center_checkins where barangay_id='${barangay}';
delete from public.drive_registration_scores where registration_id in (select r.id from public.drive_registrations r join public.medical_drives d on d.id=r.drive_id where d.barangay_id='${barangay}');
delete from public.drive_registrations where drive_id in (select id from public.medical_drives where barangay_id='${barangay}');
delete from public.medical_drives where barangay_id='${barangay}';
delete from public.incident_confirmations where incident_id='${incident}';
delete from public.incidents where barangay_id='${barangay}';
delete from public.household_members where profile_id in (select id from public.profiles where barangay_id='${barangay}');
delete from public.evacuation_centers where barangay_id='${barangay}';
delete from public.profiles where barangay_id='${barangay}';
delete from auth.users where id::text like '${prefix}-%';
delete from public.barangays where id='${barangay}';`);
}

const results = [];
const check = (name, condition, detail) => { results.push({ name, pass: Boolean(condition) }); console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

try {
  cleanup();
  setup();

  // CC-1: one resident, eight simultaneous check-ins -> one row, one first-time receipt.
  const checkins = await Promise.all(Array.from({ length: 8 }, () =>
    runAs(residents[0], `select already_checked_in from public.check_in_to_evacuation_center('${center}');`)));
  const rows = run(`select count(*) from public.evacuation_center_checkins where user_id='${residents[0]}' and evacuation_center_id='${center}';`);
  const first = checkins.filter(r => r.ok && r.out.split('\n').some(line => line.trim() === 'f')).length;
  check('CC-1 parallel check-ins create exactly one attendance row', rows === '1' && checkins.every(r => r.ok), `rows=${rows}, firstTimeReceipts=${first}`);
  check('CC-1b exactly one caller received the first-time receipt', first === 1, `first=${first}`);

  // CC-2: eight residents race for three slots.
  const registrations = await Promise.all(residents.map(uid =>
    runAs(uid, `select public.register_for_drive('${drive}',30,false,'{}',null);`)));
  const accepted = registrations.filter(r => r.ok).length;
  const full = registrations.filter(r => !r.ok && /No remaining slots/.test(r.err)).length;
  const stock = run(`select stock_remaining from public.medical_drives where id='${drive}';`);
  const numbers = run(`select count(distinct applicant_number) from public.drive_registrations where drive_id='${drive}';`);
  check('CC-2 exactly three registrations are accepted', accepted === 3 && full === 5, `accepted=${accepted}, full=${full}`);
  check('CC-2b stock never oversells and applicant numbers are unique', stock === '0' && numbers === '3', `stock=${stock}, distinctNumbers=${numbers}`);

  // CC-3: one resident corroborates the same report six times concurrently.
  const confirms = await Promise.all(Array.from({ length: 6 }, () =>
    runAs(residents[1], `select public.confirm_incident('${incident}');`)));
  const count = run(`select confirmation_count from public.incidents where id='${incident}';`);
  const rowsC = run(`select count(*) from public.incident_confirmations where incident_id='${incident}' and user_id='${residents[1]}';`);
  check('CC-3 repeated corroboration counts once', count === '1' && rowsC === '1' && confirms.every(r => r.ok), `count=${count}, rows=${rowsC}`);

  // CC-4: two accounts register the same device token concurrently -> one current owner.
  const token = 'ExponentPushToken[p3-concurrency-device]';
  await Promise.all([residents[2], residents[3]].map(uid => runAs(uid, `select public.upsert_push_token('${token}','ios');`)));
  const owners = run(`select count(*) from public.push_tokens where expo_push_token='${token}';`);
  check('CC-4 a device token has exactly one owner after a race', owners === '1', `owners=${owners}`);

  // CC-5: two editors save the household from the same snapshot -> one wins, one PT409.
  const members = id => `[{"id":"${id}","name":"Member","relation":"child"}]`;
  const saves = await Promise.all([
    runAs(household, `select public.save_resident_household_if_unchanged('${members('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')}','[]');`),
    runAs(household, `select public.save_resident_household_if_unchanged('${members('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')}','[]');`),
  ]);
  const wins = saves.filter(r => r.ok).length;
  const conflicts = saves.filter(r => !r.ok && /resident_household_changed/.test(r.err)).length;
  check('CC-5 concurrent household saves from one snapshot: one commits, one conflicts', wins === 1 && conflicts === 1, `wins=${wins}, conflicts=${conflicts}`);
} finally {
  try { cleanup(); } catch (error) { console.error(`cleanup failed: ${error.message}`); process.exitCode = 1; }
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} concurrency checks passed`);
if (failed.length) process.exitCode = 1;
