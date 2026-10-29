// Integration gate I1 for the notification hub (plan phase 2): real writers -> inbox/outbox -> the
// database's own claim -> the Edge sender's runWorker -> push payload -> the Android destination
// parser, in one run against a disposable notif_* database. Only the push provider (Expo) is
// simulated. Covers the version-2 account and System notice paths, the due-notice step, catch-up
// history for a later resident, a legacy version-1 payload, bounded provider retries, opt-out and
// the absence of duplicate events. Fixtures are committed to the disposable database and removed at
// the end; the activation gate is restored. Refuses any database name that is not notif_*.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { EXPO_SEND_URL, runWorker } from '../functions/send-notifications/worker.ts';
import { parseNotificationDestination } from '../../apps/resident-android-mobile/src/lib/notification-hub.ts';

const database = process.env.NOTIF_TEST_DB;
assert.ok(database && /^notif_[a-z0-9_]+$/.test(database), 'NOTIF_TEST_DB must name a disposable notif_* database.');
const container = process.env.NOTIF_DB_CONTAINER ?? 'supabase_db_barangayan';
const psql = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'];
const run = (sql) => execFileSync('docker', psql, { input: sql, encoding: 'utf8', timeout: 30000 }).trim();

const B = 'a7000000-0000-4000-8000-000000000001';
const B2 = 'a7000000-0000-4000-8000-000000000002';
const id = (n) => `b7000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [R1, R2, AD, R3, F] = [id(1), id(2), id(3), id(4), id(5)];
const INCIDENT = 'e7000000-0000-4000-8000-000000000001';
const CATEGORY = 'e7000000-0000-4000-8000-0000000000c1';
const TOKEN_R1 = 'ExponentPushToken[i1-resident-one]';

const cleanup = () => run(`
  delete from public.system_notices where barangay_id in ('${B}','${B2}');
  delete from barangayan_private.notification_events where barangay_id in ('${B}','${B2}');
  delete from public.incidents where id='${INCIDENT}';
  delete from public.incident_categories where id='${CATEGORY}';
  delete from public.push_tokens where user_id::text like 'b7000000-%';
  delete from public.profiles where id::text like 'b7000000-%';
  delete from auth.users where id::text like 'b7000000-%';
  delete from public.barangays where id in ('${B}','${B2}');`);

// --- the database as the Edge Function sees it: service_role over the public RPCs ---
const TABLE_FUNCTIONS = new Set(['notification_publish_due_notices', 'notification_worker_claim', 'notification_worker_due_receipts', 'notification_worker_purge', 'notification_worker_health']);
const literal = (value) => `'${(typeof value === 'string' ? value : JSON.stringify(value)).replaceAll("'", "''")}'`;
const rpc = async (name, args = {}) => {
  try {
    const call = `public.${name}(${Object.entries(args).map(([key, value]) => `${key} => ${literal(value)}`).join(', ')})`;
    const sql = TABLE_FUNCTIONS.has(name) ? `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from ${call} t;` : `select to_jsonb(${call});`;
    return { data: JSON.parse(run(`set role service_role;\n${sql}`)), error: null };
  } catch (error) {
    return { data: null, error: { message: String(error.message).slice(0, 200) } };
  }
};

// --- the push provider: accepts everything, or fails every request ---
function provider(mode = 'ok') {
  const sent = [];
  let requests = 0;
  const fetch = async (url, init) => {
    requests++;
    if (mode === 'down') return { status: 503, json: async () => null };
    const body = JSON.parse(init.body);
    if (url === EXPO_SEND_URL) { sent.push(...body); return { status: 200, json: async () => ({ data: body.map((_, index) => ({ status: 'ok', id: `ticket-${requests}-${index}` })) }) }; }
    return { status: 200, json: async () => ({ data: {} }) };
  };
  return { fetch, sent, requests: () => requests };
}
const worker = (push) => runWorker({ rpc, fetch: push.fetch, sleep: async () => undefined });
const one = (sql) => run(sql);
const count = (sql) => Number(one(sql));
const asStaff = (statement) => run(`begin; select set_config('request.jwt.claim.sub','${AD}',true), set_config('request.jwt.claims','{"sub":"${AD}","role":"authenticated"}',true); ${statement} commit;`);
const outboxState = (inboxMatch) => one(`select o.state||'/'||o.attempt_count||'/'||coalesce(o.last_error,'') from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id where ${inboxMatch} order by o.created_at desc limit 1;`);
const dataOf = (message) => { const { inbox, ...destination } = message.data; return { inbox, destination }; };

const gate = one('select emission_enabled||\',\'||v2_alerts_enabled from barangayan_private.notification_hub_settings;');
assert.equal(gate, 'false,false', 'The disposable database must start with the activation gate off.');
const passed = [];
const check = (name) => passed.push(name);

try {
  cleanup();
  run(`
    insert into public.barangays(id,name) values ('${B}','P146 I1 Barangay'),('${B2}','P146 I1 Other');
    insert into auth.users(id,email,raw_user_meta_data) select u.id,u.email,'{}' from (values
      ('${R1}'::uuid,'i1-r1@test.local'),('${R2}','i1-r2@test.local'),('${AD}','i1-admin@test.local'),('${R3}','i1-r3@test.local'),('${F}','i1-foreign@test.local')) u(id,email);
    insert into public.profiles(id,barangay_id,role,full_name) values
      ('${R1}','${B}','resident','I1 One'),('${R2}','${B}','resident','I1 Two'),('${AD}','${B}','admin','I1 Admin'),('${F}','${B2}','resident','I1 Foreign');
    update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',sex='female',employment_status='student',
      mobile_number='09171234567',birth_date='2000-01-01',profile_completed_at=now() where role='resident' and id::text like 'b7000000-%';
    insert into public.push_tokens(user_id,expo_push_token,device_type) values ('${R1}','${TOKEN_R1}','android'),('${F}','ExponentPushToken[i1-foreign]','android');
    insert into public.incident_categories(id,barangay_id,name) values ('${CATEGORY}','${B}','I1 Category');
    insert into public.incidents(id,barangay_id,reporter_id,category_id,title,location,status) values ('${INCIDENT}','${B}','${R1}','${CATEGORY}','I1 incident','{"lat":14.6,"lng":121.1}','open');
    update barangayan_private.notification_hub_settings set emission_enabled=true, v2_alerts_enabled=true;`);

  // 1. Account event (version 2): staff edit -> inbox + outbox -> claim -> push -> parser.
  asStaff(`update public.profiles set mobile_number='09170000001' where id='${R1}';`);
  assert.equal(count(`select count(*) from barangayan_private.notification_events where recipient_id='${R1}' and dedupe_key like 'profile:%'`), 1, 'one durable event');
  assert.equal(count(`select count(*) from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id where i.recipient_id='${R1}' and i.kind='account_profile'`), 1, 'one alert path');
  let push = provider();
  let summary = await worker(push);
  assert.deepEqual(summary.errors, []);
  assert.deepEqual([summary.claimed, summary.sent], [1, 1]);
  assert.equal(push.sent.length, 1);
  assert.equal(push.sent[0].to, TOKEN_R1);
  let { inbox, destination } = dataOf(push.sent[0]);
  assert.deepEqual(destination, { v: 2, kind: 'account', screen: 'profile' });
  assert.deepEqual(parseNotificationDestination(destination), destination, 'the Android parser accepts the transported payload');
  assert.match(inbox, /^[0-9a-f-]{36}$/);
  assert.equal(push.sent[0].title, 'Your profile was updated');
  assert.ok(!JSON.stringify(push.sent[0]).includes('09170000001'), 'no profile value in the payload');
  assert.equal(outboxState(`i.id='${inbox}'`).split('/')[0], 'sent');
  check('account event: writer -> outbox -> claim -> push -> parser');

  // 2. A second run finds nothing: no duplicate delivery and no new event.
  const eventsBefore = count('select count(*) from barangayan_private.notification_events');
  push = provider();
  summary = await worker(push);
  assert.deepEqual([summary.claimed, summary.sent, push.sent.length], [0, 0, 0]);
  assert.equal(count('select count(*) from barangayan_private.notification_events'), eventsBefore, 'a worker run creates no events');
  check('repeat run delivers nothing and writes no events');

  // 3. System notice: operator publish -> due step -> outbox -> claim -> push (version 2 notice).
  const notice = one(`set role service_role;\nselect public.system_notice_create('service_status','${B}','Scheduled maintenance','Barangayan will be unavailable tonight.','${AD}',null,null,null,null,null,null,null,true);`).split('\n').pop();
  run(`set role service_role;\nselect public.system_notice_publish('${notice}');`);
  push = provider();
  summary = await worker(push);
  assert.deepEqual(summary.errors, []);
  assert.deepEqual(summary.notices, { published: 0, delivered: 2, pending: 0 }, 'both residents of the audience, none of another barangay');
  assert.deepEqual([summary.claimed, summary.sent], [1, 1], 'one device delivered');
  assert.equal(count(`select count(*) from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id where i.recipient_id='${R2}' and o.state='skipped' and o.last_error='no_token'`), 1, 'the resident without a device is skipped but keeps history');
  assert.equal(push.sent.length, 1);
  ({ inbox, destination } = dataOf(push.sent[0]));
  assert.deepEqual(destination, { v: 2, kind: 'notice', id: notice });
  assert.deepEqual(parseNotificationDestination(destination), destination);
  assert.equal(count(`select count(*) from public.notification_inbox where destination->>'id'='${notice}'`), 2);
  assert.equal(count(`select count(*) from public.notification_inbox where recipient_id='${F}' and destination->>'id'='${notice}'`), 0, 'no foreign recipient');
  check('system notice: operator -> due step -> outbox -> claim -> push -> parser');

  // 4. A resident who registers later receives the notice as history only.
  run(`
    insert into public.profiles(id,barangay_id,role,full_name) values ('${R3}','${B}','resident','I1 Three');
    update public.profiles set first_name='Late',last_name='Resident',house_no='1',street='Fixture Street',sex='female',employment_status='student',
      mobile_number='09171234567',birth_date='2000-01-01',profile_completed_at=now() where id='${R3}';`);
  push = provider();
  summary = await worker(push);
  assert.equal(summary.notices.delivered, 1);
  assert.deepEqual([summary.claimed, push.sent.length], [0, 0], 'history only: no replayed alert');
  assert.equal(count(`select count(*) from public.notification_inbox where recipient_id='${R3}' and destination->>'id'='${notice}'`), 1);
  summary = await worker(provider());
  assert.equal(summary.notices.delivered, 0, 'catch-up ends by itself');
  check('catch-up: later resident gets history without an alert; the pass terminates');

  // 5. A material revision is a new delivery key; the earlier row stays as history.
  run(`set role service_role;\nselect public.system_notice_revise('${notice}','Maintenance extended','Maintenance will continue until 11:30 PM.',true,null,null,null);`);
  push = provider();
  summary = await worker(push);
  assert.deepEqual(summary.notices, { published: 0, delivered: 3, pending: 0 });
  assert.equal(push.sent.length, 1);
  assert.equal(push.sent[0].title, 'Maintenance extended');
  assert.equal(count(`select count(*) from barangayan_private.notification_events where subject_id='${notice}'`), 6, 'two revisions x three residents');
  check('revision: new key per recipient, one alert for the device holder');

  // 6. Legacy version-1 payload (incident) still transports unchanged.
  asStaff(`update public.incidents set status='in_progress' where id='${INCIDENT}';`);
  push = provider();
  summary = await worker(push);
  assert.deepEqual(summary.errors, []);
  assert.equal(push.sent.length, 1);
  ({ destination } = dataOf(push.sent[0]));
  assert.deepEqual(destination, { v: 1, kind: 'incident', id: INCIDENT });
  assert.deepEqual(parseNotificationDestination(destination), destination);
  check('version 1 incident payload unchanged end to end');

  // 7. Provider outage: bounded attempts, then dead; nothing retried afterwards.
  asStaff(`update public.profiles set street='Second Street' where id='${R1}';`);
  const down = provider('down');
  for (let attempt = 1; attempt <= 6; attempt++) {
    run(`update barangayan_private.notification_outbox set next_attempt_at=now() where state='pending';`);
    await worker(down);
  }
  const state = outboxState(`i.recipient_id='${R1}' and i.kind='account_profile' and i.created_at=(select max(created_at) from public.notification_inbox where recipient_id='${R1}' and kind='account_profile')`);
  assert.equal(state.split('/')[0], 'dead');
  assert.ok(Number(state.split('/')[1]) <= 5, `attempts capped at 5 (saw ${state})`);
  assert.ok(down.requests() <= 5 * 3, `provider requests bounded (${down.requests()})`);
  check('provider outage: dead after at most 5 attempts, at most 3 requests each');

  // 8. Opt-out keeps history, sends nothing.
  run(`update public.profiles set push_notifications_enabled=false where id='${R1}';`);
  asStaff(`update public.profiles set house_no='9' where id='${R1}';`);
  push = provider();
  summary = await worker(push);
  assert.equal(push.sent.length, 0);
  const optedOut = outboxState(`i.recipient_id='${R1}' and i.kind='account_profile' and i.created_at=(select max(created_at) from public.notification_inbox where recipient_id='${R1}' and kind='account_profile')`);
  assert.equal(optedOut, 'skipped/0/opted_out');
  assert.equal(count(`select count(*) from public.notification_inbox where recipient_id='${R1}' and title='Your profile was updated'`), 3);
  check('opt-out: history kept, nothing sent');

  console.log(JSON.stringify({ passed }));
} finally {
  try { run('update barangayan_private.notification_hub_settings set emission_enabled=false, v2_alerts_enabled=false;'); cleanup(); } catch (error) { console.error('cleanup failed', error.message); process.exitCode = 1; }
}
