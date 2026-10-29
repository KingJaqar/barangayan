// Real independent PostgreSQL sessions for notification_mark_scope_read (migration 0145): the bulk
// read's candidate set is its statement snapshot, concurrent calls by one resident serialize, and a
// rolled-back call leaves nothing applied. Refuses shared/default database names; fixtures are
// committed to the disposable database and removed at the end.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';

const database = process.env.NOTIF_TEST_DB;
assert.ok(database && /^notif_[a-z0-9_]+$/.test(database), 'NOTIF_TEST_DB must name a disposable notif_* database.');
const container = process.env.NOTIF_DB_CONTAINER ?? 'supabase_db_barangayan';
const args = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-X', '-At', '-v', 'ON_ERROR_STOP=1'];
const run = (sql) => execFileSync('docker', args, { input: sql, encoding: 'utf8', timeout: 15000 }).trim();
const barangay = 'a1450000-0000-4000-8000-0000000000c1';
const resident = 'b1450000-0000-4000-8000-0000000000c1';

function session(name, statement) {
  const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '', err = '', signal;
  const ready = new Promise((resolve) => { signal = resolve; });
  const deadline = setTimeout(() => child.kill(), 20000);
  const result = new Promise((resolve) => {
    child.stdout.on('data', (chunk) => { out += chunk; if (out.includes('NOTIF_READY')) signal(true); });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', (error) => { err += error.message; signal(false); });
    child.on('close', (code) => { clearTimeout(deadline); signal(false); resolve({ ok: code === 0, out, err }); });
  });
  child.stdin.on('error', () => { /* psql exits immediately on an expected SQL failure. */ });
  child.stdin.write(`begin; set local statement_timeout='12s'; set application_name='notif-${name}';
    set local role authenticated; select set_config('request.jwt.claim.sub','${resident}',true);
    select set_config('request.jwt.claims','{"sub":"${resident}","role":"authenticated"}',true);
    ${statement}\n`);
  child.stdin.end();
  return { ready, result };
}

const emit = (key) => run(`select barangayan_private.emit_notification_v2(array['${resident}'::uuid],'${barangay}','account_security','account',gen_random_uuid(),
  '${key}','Password updated','Your password was updated.','{"v":2,"kind":"account","screen":"change_password"}',false);`);
const unread = () => Number(run(`select count(*) from public.notification_inbox where recipient_id='${resident}' and read_at is null;`));
const resetUnread = () => run(`update public.notification_inbox set read_at=null where recipient_id='${resident}';`);
const marked = (out) => out.split('\n').find((line) => /^\d+\|\d+$/.test(line));

const gate = run('select emission_enabled from barangayan_private.notification_hub_settings;');
const results = [];
try {
  run(`insert into public.barangays (id, name) values ('${barangay}', 'P145 Concurrency');
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at)
      values ('${resident}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p145-race@test.local', '', now(), '', '', '', '', '{}', '{}', false, now(), now());
    insert into public.profiles (id, barangay_id, role, full_name) values ('${resident}', '${barangay}', 'resident', 'P145 Race');
    update barangayan_private.notification_hub_settings set emission_enabled=true;`);
  for (let n = 1; n <= 5; n++) emit(`p145:race:${n}`);

  // 1. An item committed after the bulk statement's snapshot stays unread.
  const first = session('snapshot', `select * from public.notification_mark_scope_read('all','all'); select 'NOTIF_READY'; select pg_sleep(3); commit;`);
  assert.equal(await first.ready, true, 'snapshot session did not reach its bulk read');
  emit('p145:race:late');
  const firstDone = await first.result;
  assert.ok(firstDone.ok, firstDone.err);
  assert.equal(marked(firstDone.out), '0|5', 'the bulk read marks only what its snapshot saw');
  assert.equal(unread(), 1, 'the arrival committed during the bulk read stays unread');
  results.push('snapshot: 5 marked, late arrival unread');

  // 2. A second bulk read by the same resident waits for the first and then finds nothing left.
  resetUnread();
  const holder = session('holder', `select * from public.notification_mark_scope_read('all','all'); select 'NOTIF_READY'; select pg_sleep(3); commit;`);
  assert.equal(await holder.ready, true, 'holder session did not reach its bulk read');
  const waiter = session('waiter', `select * from public.notification_mark_scope_read('all','all'); commit;`);
  let waitEvent = '';
  for (let attempt = 0; attempt < 10 && waitEvent !== 'advisory'; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    waitEvent = run(`select coalesce(max(wait_event),'') from pg_stat_activity where application_name='notif-waiter';`);
  }
  assert.equal(waitEvent, 'advisory', 'the repeat waits on the per-resident bulk-read lock');
  const [holderDone, waiterDone] = await Promise.all([holder.result, waiter.result]);
  assert.ok(holderDone.ok && waiterDone.ok, holderDone.err + waiterDone.err);
  assert.equal(marked(holderDone.out), '0|6');
  assert.equal(marked(waiterDone.out), '0|0', 'the serialized repeat applies nothing');
  assert.equal(unread(), 0);
  results.push('serialized: 6 then 0');

  // 3. A bulk read that rolls back leaves every item unread.
  resetUnread();
  const rolled = session('rollback', `select * from public.notification_mark_scope_read('all','all'); rollback;`);
  const rolledDone = await rolled.result;
  assert.ok(rolledDone.ok, rolledDone.err);
  assert.equal(marked(rolledDone.out), '0|6');
  assert.equal(unread(), 6, 'nothing is applied after a rollback');
  results.push('rollback: 0 applied');
} finally {
  run(`delete from barangayan_private.notification_events where recipient_id='${resident}';
    delete from public.profiles where id='${resident}'; delete from auth.users where id='${resident}'; delete from public.barangays where id='${barangay}';
    update barangayan_private.notification_hub_settings set emission_enabled=${gate === 't'};`);
}
console.log(JSON.stringify({ passed: results }));
