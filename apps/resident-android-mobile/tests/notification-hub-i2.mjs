// Integration gate I2 for the Announcements hub (plan phase 5): real writers -> events/outbox -> the Edge
// sender's runWorker (service_role over PostgREST) -> the resident's own data layer (the app's
// notification-hub-data.ts and notification-hub.ts, bundled unchanged) over real PostgREST and real RLS.
// Synthetic: only the push provider (Expo) and the resident's JWT (signed with the local PostgREST secret,
// no GoTrue). Not covered here: the React screen/hook (tests/notification-hub-ui.mjs, a JS mirror of these
// contracts) and native behaviour (I3). Fixtures are committed to the disposable database and removed at the end.
//
//   NOTIF_TEST_DB=notif_p5_20261028 NOTIF_REST_URL=http://localhost:58410 NOTIF_JWT_SECRET=... node tests/notification-hub-i2.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const app = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(app, '../..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild');

const database = process.env.NOTIF_TEST_DB;
assert.ok(database && /^notif_[a-z0-9_]+$/.test(database), 'NOTIF_TEST_DB must name a disposable notif_* database.');
const rest = process.env.NOTIF_REST_URL;
const secret = process.env.NOTIF_JWT_SECRET;
assert.ok(rest && secret, 'NOTIF_REST_URL and NOTIF_JWT_SECRET are required (PostgREST on the disposable database).');
const container = process.env.NOTIF_DB_CONTAINER ?? 'supabase_db_barangayan';
const out = process.env.TEST_ARTIFACTS_DIR ?? path.join(repo, 'tmp/resident-notifications-phase5-20261028/i2');
fs.mkdirSync(out, { recursive: true });

const psql = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'];
const run = (sql) => execFileSync('docker', psql, { input: sql, encoding: 'utf8', timeout: 180000 }).trim();
const runAsync = (sql) => new Promise((resolve, reject) => {
  const child = execFile('docker', psql, { encoding: 'utf8', timeout: 60000 }, (error, stdout) => (error ? reject(error) : resolve(stdout.trim())));
  child.stdin.end(sql);
});
const one = (sql) => run(sql);
const count = (sql) => Number(run(sql));

// ---- JWTs for PostgREST (HS256) ----
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
// The CLI's PostgREST holds a JWKS (EC verify key + the legacy symmetric key); a plain string is used as is.
const hmacKey = (() => {
  try { const oct = JSON.parse(secret).keys?.find((key) => key.kty === 'oct'); if (oct) return Buffer.from(oct.k, 'base64url'); } catch { /* not JSON: a plain shared secret */ }
  return secret;
})();
const jwt = (claims) => {
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return `${head}.${crypto.createHmac('sha256', hmacKey).update(head).digest('base64url')}`;
};
const userJwt = (sub) => jwt({ role: 'authenticated', aud: 'authenticated', sub });
const anonJwt = jwt({ role: 'anon' });
const serviceJwt = jwt({ role: 'service_role' });

// ---- the app's data layer, bundled unchanged; only @/lib/supabase is replaced by a client on the isolated API ----
const src = path.join(app, 'src').replaceAll('\\', '/');
await build({
  stdin: {
    contents: "export * from './src/lib/notification-hub-data.ts'; export * from './src/lib/notification-hub.ts'; export { supabase } from '@/lib/supabase';",
    resolveDir: app, sourcefile: 'i2-entry.ts', loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: path.join(out, 'hub-data.mjs'), logLevel: 'error',
  plugins: [{
    name: 'i2-resolve',
    setup(b) {
      b.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: 'i2-supabase', namespace: 'i2' }));
      b.onResolve({ filter: /^@\// }, (args) => b.resolve(`${src}/${args.path.slice(2)}`, { resolveDir: app, kind: args.kind }));
      b.onLoad({ filter: /.*/, namespace: 'i2' }, () => ({
        resolveDir: app, loader: 'js',
        contents: "import { createClient } from '@supabase/supabase-js'; const s = globalThis.__i2; export const supabase = createClient(s.url, s.key, { accessToken: async () => s.token, global: { fetch: (u, i) => s.fetch(u, i) } });",
      }));
    },
  }],
});

const state = globalThis.__i2 = { url: 'http://i2.invalid', key: anonJwt, token: anonJwt, base: rest, delay: 0, requests: 0, bytes: 0 };
state.fetch = async (url, init) => {
  state.requests++;
  const text = String(url);
  const target = state.base + text.slice(text.indexOf('/rest/v1') + '/rest/v1'.length);
  if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
  return fetch(target, init);
};
const hub = await import(pathToFileURL(path.join(out, 'hub-data.mjs')).href);
const signal = () => new AbortController().signal;
const as = (sub) => { state.token = sub ? userJwt(sub) : anonJwt; };

// ---- fixtures ----
const B = 'a8000000-0000-4000-8000-000000000001';
const B2 = 'a8000000-0000-4000-8000-000000000002';
const id = (n) => `b8000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [R1, R2, AD, F] = [id(1), id(2), id(3), id(4)];
const INCIDENT = 'e8000000-0000-4000-8000-000000000001';
const CATEGORY = 'e8000000-0000-4000-8000-0000000000c1';
const TOKEN_R1 = 'ExponentPushToken[i2-resident-one]';
const annId = (n) => `f8000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const cleanup = () => run(`
  delete from public.announcement_reads where resident_id::text like 'b8000000-%';
  delete from public.announcements where barangay_id in ('${B}','${B2}');
  delete from public.system_notices where barangay_id in ('${B}','${B2}');
  delete from barangayan_private.notification_events where barangay_id in ('${B}','${B2}');
  delete from public.incidents where id='${INCIDENT}';
  delete from public.incident_categories where id='${CATEGORY}';
  delete from public.push_tokens where user_id::text like 'b8000000-%';
  delete from public.profiles where id::text like 'b8000000-%';
  delete from auth.users where id::text like 'b8000000-%';
  delete from public.barangays where id in ('${B}','${B2}');`);

const serviceRpc = async (name, args = {}) => {
  const response = await fetch(`${rest}/rpc/${name}`, { method: 'POST', headers: { authorization: `Bearer ${serviceJwt}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  const body = await response.json().catch(() => null);
  return response.ok ? { data: body, error: null } : { data: null, error: { message: String(body?.message ?? response.status) } };
};
const { EXPO_SEND_URL, runWorker } = await import(pathToFileURL(path.join(repo, 'supabase/functions/send-notifications/worker.ts')).href);
function provider() {
  const sent = [];
  const fetchTickets = async (url, init) => {
    const body = JSON.parse(init.body);
    if (url === EXPO_SEND_URL) { sent.push(...body); return { status: 200, json: async () => ({ data: body.map((_, index) => ({ status: 'ok', id: `ticket-${sent.length}-${index}` })) }) }; }
    return { status: 200, json: async () => ({ data: {} }) };
  };
  return { fetch: fetchTickets, sent };
}
const worker = (push) => runWorker({ rpc: serviceRpc, fetch: push.fetch, sleep: async () => undefined });
const asStaff = (statement) => run(`begin; select set_config('request.jwt.claim.sub','${AD}',true), set_config('request.jwt.claims','{"sub":"${AD}","role":"authenticated"}',true); ${statement} commit;`);
const ACCOUNT_DEST = '{"v":2,"kind":"account","screen":"settings"}';
const emitAccount = (key, kind) => `select barangayan_private.emit_notification_v2(array['${R1}'::uuid],'${B}','${kind}','account',gen_random_uuid(),'${key}','Update','Something changed.','${ACCOUNT_DEST}',false);`;
const unreadSql = () => count(`select count(*) from public.notification_inbox where recipient_id='${R1}' and read_at is null`);
const unreadAccountSql = () => count(`select count(*) from public.notification_inbox where recipient_id='${R1}' and read_at is null and kind not like 'system_%' and kind<>'announcement'`);
const quiet = () => ({
  events: count('select count(*) from barangayan_private.notification_events'),
  outbox: count('select count(*) from barangayan_private.notification_outbox'),
  inbox: count('select count(*) from public.notification_inbox'),
  incident: one(`select md5(i::text) from public.incidents i where id='${INCIDENT}'`),
});
const measure = async (label, fn) => {
  const requests = state.requests; const started = performance.now();
  const result = await fn();
  metrics.push({ label, requests: state.requests - requests, ms: Math.round(performance.now() - started) });
  return result;
};
const metrics = [];
const passed = [];
const check = (name) => passed.push(name);
const pageAll = async (loader, limit = 400) => {
  const rows = []; let total; let pages = 0;
  for (let after; pages < limit; pages++) {
    const page = await loader(after, pages === 0);
    if (pages === 0) total = page.total;
    assert.ok(page.rows.length <= 25, `a page never exceeds 25 rows (saw ${page.rows.length})`);
    rows.push(...page.rows);
    if (page.rows.length < 25) return { rows, total, pages: pages + 1 };
    after = page.rows.at(-1);
  }
  throw new Error('paging did not terminate');
};

const gate = one("select emission_enabled||','||v2_alerts_enabled from barangayan_private.notification_hub_settings;");
assert.equal(gate, 'false,false', 'The disposable database must start with the activation gate off.');

try {
  cleanup();
  run(`
    insert into public.barangays(id,name) values ('${B}','P5 I2 Barangay'),('${B2}','P5 I2 Other');
    insert into auth.users(id,email,raw_user_meta_data) select u.id,u.email,'{}' from (values
      ('${R1}'::uuid,'i2-r1@test.local'),('${R2}','i2-r2@test.local'),('${AD}','i2-admin@test.local'),('${F}','i2-foreign@test.local')) u(id,email);
    insert into public.profiles(id,barangay_id,role,full_name) values
      ('${R1}','${B}','resident','I2 One'),('${R2}','${B}','resident','I2 Two'),('${AD}','${B}','admin','I2 Admin'),('${F}','${B2}','resident','I2 Foreign');
    update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',sex='female',employment_status='student',
      mobile_number='09171234567',birth_date='2000-01-01',profile_completed_at=now() where role='resident' and id::text like 'b8000000-%';
    insert into public.push_tokens(user_id,expo_push_token,device_type) values ('${R1}','${TOKEN_R1}','android'),('${F}','ExponentPushToken[i2-foreign]','android');
    insert into public.incident_categories(id,barangay_id,name) values ('${CATEGORY}','${B}','I2 Category');
    insert into public.incidents(id,barangay_id,reporter_id,category_id,title,location,status) values ('${INCIDENT}','${B}','${R1}','${CATEGORY}','I2 incident','{"lat":14.6,"lng":121.1}','open');
    update barangayan_private.notification_hub_settings set emission_enabled=true, v2_alerts_enabled=true;`);

  // ===== J1. Staff transitions and an operator notice reach the resident's phone path and history =====
  asStaff(`update public.profiles set mobile_number='09170000001' where id='${R1}';`);
  asStaff(`update public.incidents set status='in_progress' where id='${INCIDENT}';`);
  const notice = one(`set role service_role;\nselect public.system_notice_create('service_status','${B}','Scheduled maintenance','Barangayan will be unavailable tonight.','${AD}',null,null,null,null,null,null,null,true);`).split('\n').pop();
  run(`set role service_role;\nselect public.system_notice_publish('${notice}');`);
  const push = provider();
  const summary = await worker(push);
  assert.deepEqual(summary.errors, []);
  assert.equal(summary.notices.delivered, 2, 'the notice reaches both residents of its barangay and nobody else');
  assert.equal(push.sent.length, 3, 'one phone alert per event for the device holder');
  const destinations = push.sent.map(({ data: { inbox, ...d } }) => d);
  for (const destination of destinations) assert.deepEqual(hub.parseNotificationDestination(destination), destination, 'the Android parser accepts every transported payload');
  assert.deepEqual((await worker(provider())).claimed, 0, 'a second sender run delivers nothing');
  check('J1 staff profile + incident transition + operator notice -> events/outbox -> worker (service_role over PostgREST) -> parser');

  // ===== J2. The resident's list, counts and details over the real API =====
  as(R1);
  let s = await measure('summary (all/all)', () => hub.loadHubSummary(signal(), 'all', 'all'));
  assert.deepEqual([s.account.total, s.account.unread, s.system.total, s.system.unread, s.barangay.total], [2, 2, 1, 1, 0], 'counts cover every authorized row');
  assert.equal(hub.totalUnread(s), 3);
  const account = await measure('account first page (page + count)', () => hub.loadInboxPage(signal(), 'account', 'all', 'all', undefined, true));
  assert.equal(account.total, 2);
  assert.deepEqual(account.rows.map((row) => row.filter).sort(), ['incident_reports', 'profile']);
  const createdOrder = account.rows.map((row) => `${row.created_at}|${row.id}`);
  assert.deepEqual(createdOrder, [...createdOrder].sort().reverse(), 'created_at DESC, id DESC');
  const incidentRow = account.rows.find((row) => row.filter === 'incident_reports');
  const profileRow = account.rows.find((row) => row.filter === 'profile');
  assert.deepEqual(hub.notificationOpen(incidentRow.destination), { type: 'record', route: `/reports/${INCIDENT}` });
  assert.equal(hub.notificationOpen(profileRow.destination).action.route.includes('profile'), true);
  s = await hub.loadHubSummary(signal(), 'account', 'incident_reports');
  assert.deepEqual([s.account.scopeTotal, s.account.scopeUnread], [1, 1], 'the chip scopes the count');
  const sys = await hub.loadInboxPage(signal(), 'system', 'all', 'all', undefined, true);
  assert.equal(sys.rows.length, 1);
  assert.deepEqual(hub.notificationOpen(sys.rows[0].destination), { type: 'detail', noticeId: notice, action: null });
  const noticeRow = await hub.fetchSystemNotice(signal(), notice);
  assert.deepEqual([noticeRow.title, noticeRow.state, noticeRow.revision], ['Scheduled maintenance', 'published', 1]);
  assert.equal((await hub.fetchInboxItem(signal(), incidentRow.id, R1)).id, incidentRow.id, 'the owner re-reads their own row');
  as(R2);
  assert.equal(await hub.fetchInboxItem(signal(), incidentRow.id, R2), null, "another resident cannot read the owner's row");
  assert.equal(await hub.fetchInboxItem(signal(), incidentRow.id, R1), null, 'claiming the owner id does not help');
  assert.equal((await hub.fetchSystemNotice(signal(), notice)).id, notice, 'a resident of the same barangay reads the notice');
  s = await hub.loadHubSummary(signal(), 'all', 'all');
  assert.deepEqual([s.account.total, s.system.total], [0, 1], 'the second resident has no Account rows of the first');
  as(F);
  assert.equal(await hub.fetchSystemNotice(signal(), notice), null, 'another barangay cannot read the notice');
  s = await hub.loadHubSummary(signal(), 'all', 'all');
  assert.deepEqual([s.account.total, s.system.total, s.barangay.total], [0, 0, 0]);
  as(null);
  await assert.rejects(hub.loadHubSummary(signal(), 'all', 'all'), 'guests get no hub summary (D21)');
  await assert.rejects(hub.loadInboxPage(signal(), 'account', 'all', 'all', undefined, false), 'guests cannot page the private inbox');
  await assert.rejects(hub.markScopeRead('all', 'all'), 'guests cannot bulk read');
  check('J2 list/count/detail over RLS: owner, same-barangay peer, foreign barangay, guest');

  // ===== J3. Individual read/unread: only the marker changes, repeatedly, with no new events =====
  as(R1);
  const before = quiet();
  await hub.setInboxRead(incidentRow.id, R1, true);
  s = await hub.loadHubSummary(signal(), 'all', 'all');
  assert.equal(s.account.unread, 1);
  for (let round = 0; round < 3; round++) { await hub.setInboxRead(incidentRow.id, R1, false); await hub.setInboxRead(incidentRow.id, R1, true); }
  assert.deepEqual(quiet(), before, 'read/unread creates no events, outbox rows or inbox rows and never touches the incident');
  assert.equal(unreadSql(), 2, 'one Account row + the notice left unread');
  const profileId = profileRow.id;
  as(R2);
  await hub.setInboxRead(profileId, R1, true);
  as(F);
  await hub.setInboxRead(profileId, R1, true);
  assert.equal(count(`select count(*) from public.notification_inbox where id='${profileId}' and read_at is null`), 1, "another resident's write to the owner's row changes nothing");
  check('J3 read/unread x7: no events/outbox/business change; foreign writes are no-ops');

  // ===== J4. Barangay announcements: ties, paging and read mirrors =====
  run(`
    insert into public.announcements(id,barangay_id,title,body,category,published_at)
    select ('f8000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'${B}','I2 '||g,'Body',(array['general','emergency','health','events'])[1+g%4],
      case when g<=30 then timestamp with time zone '2026-10-20 08:00:00.123456+00' when g<=45 then timestamp with time zone '2026-10-21 09:00:00+00' else now()-make_interval(secs=>g) end
    from generate_series(1,60) g;
    insert into public.announcements(id,barangay_id,title,body,category) values ('${annId(900)}','${B2}','I2 other','Body','general');
    insert into public.announcements(id,barangay_id,title,body,category,deleted_at) values ('${annId(901)}','${B}','I2 deleted','Body','general',now());`);
  as(R1);
  const sqlOrder = one(`select string_agg(id::text, ',' order by published_at desc, id desc) from public.announcements where barangay_id='${B}' and deleted_at is null`).split(',');
  const announcements = await measure('announcement paging (60 rows, 3 pages)', () => pageAll((after, first) => hub.loadAnnouncementPage(signal(), null, after, first)));
  assert.equal(announcements.total, 60);
  assert.deepEqual(announcements.rows.map((row) => row.id), sqlOrder, 'keyset paging over tied timestamps loses and repeats nothing');
  const emergency = await pageAll((after, first) => hub.loadAnnouncementPage(signal(), 'emergency', after, first));
  assert.equal(emergency.rows.length, count(`select count(*) from public.announcements where barangay_id='${B}' and deleted_at is null and category='emergency'`));
  s = await hub.loadHubSummary(signal(), 'barangay', 'all');
  assert.equal(s.barangay.total, 60);
  assert.equal((await hub.loadUnreadAnnouncementIds(R1)).length, 60);
  const a1 = sqlOrder[0];
  const { supabase } = hub;
  assert.equal((await supabase.from('announcement_reads').upsert({ resident_id: R1, announcement_id: a1 }, { onConflict: 'resident_id,announcement_id' })).error, null);
  assert.equal(count(`select count(*) from public.notification_inbox where recipient_id='${R1}' and kind='announcement' and destination->>'id'='${a1}' and read_at is not null`), 1, 'the inbox mirror follows an announcement read');
  assert.equal((await hub.loadUnreadAnnouncementIds(R1)).length, 59);
  assert.equal((await supabase.from('announcement_reads').delete().eq('resident_id', R1).eq('announcement_id', a1)).error, null);
  assert.equal(count(`select count(*) from public.notification_inbox where recipient_id='${R1}' and kind='announcement' and destination->>'id'='${a1}' and read_at is null`), 1, 'an explicit unread converges the mirror');
  check('J4 announcements: tied-timestamp keyset paging = SQL order, category scope, deleted/foreign excluded, mirror converges both ways');

  // ===== J5. Volume: more than 1,000 rows in every source =====
  run(`
    insert into public.announcements(id,barangay_id,title,body,category,published_at)
    select ('f8000000-0000-4000-8000-'||lpad((1000+g)::text,12,'0'))::uuid,'${B}','I2 bulk '||g,'Body','general',now()-make_interval(secs=>100+g) from generate_series(1,1000) g;
    do $$ declare g integer; k text; dest text; begin for g in 1..1100 loop
      k:=(array['account_verification','account_security','account_profile','incident_status','system_service','system_update','system_policy','account_verification'])[1+g%8];
      dest:=case when k like 'account_%' then '${ACCOUNT_DEST}' when k='incident_status' then '{"v":1,"kind":"incident","id":"${INCIDENT}"}' else '{"v":2,"kind":"notice","id":"${notice}"}' end;
      perform barangayan_private.emit_notification_v2(array['${R1}'::uuid],'${B}',k,case when k like 'account_%' then 'account' when k='incident_status' then 'incident' else 'notice' end,gen_random_uuid(),'i2:vol:'||g,'Update','Something changed.',dest::jsonb,false);
    end loop; end $$;`);
  const sqlAccount = count(`select count(*) from public.notification_inbox where recipient_id='${R1}' and kind not like 'system_%' and kind<>'announcement'`);
  const sqlSystem = count(`select count(*) from public.notification_inbox where recipient_id='${R1}' and kind like 'system_%'`);
  assert.ok(sqlAccount > 600 && sqlSystem > 400, `volume fixture (${sqlAccount}/${sqlSystem})`);
  s = await hub.loadHubSummary(signal(), 'all', 'all');
  assert.deepEqual([s.account.total, s.system.total, s.barangay.total], [sqlAccount, sqlSystem, 1060], 'summary counts every row, past any response cap');
  for (const [source, expected] of [['account', sqlAccount], ['system', sqlSystem]]) {
    const all = await measure(`${source} paging (${expected} rows)`, () => pageAll((after, first) => hub.loadInboxPage(signal(), source, 'all', 'all', after, first)));
    assert.equal(all.rows.length, expected);
    assert.equal(all.total, expected);
    assert.equal(new Set(all.rows.map((row) => row.id)).size, expected, `${source}: no row repeats`);
    const sqlIds = one(`select string_agg(id::text, ',' order by created_at desc, id desc) from public.notification_inbox where recipient_id='${R1}' and ${source === 'system' ? "kind like 'system_%'" : "kind not like 'system_%' and kind<>'announcement'"}`);
    assert.equal(all.rows.map((row) => row.id).join(','), sqlIds, `${source}: page order = SQL order across tied created_at`);
  }
  const unreadIds = await measure('unread announcement ids (1,060 rows, past the 1,000 response cap)', () => hub.loadUnreadAnnouncementIds(R1));
  assert.equal(unreadIds.length, 1060, 'every unread announcement keeps its marker');
  const rawCapped = await supabase.from('announcements').select('id').is('deleted_at', null);
  assert.equal(rawCapped.data.length, 1000, 'documents the server cap that the unbounded query hit');
  check('J5 >1,000 rows per source: counts, complete paging, SQL-equal order; unread ids no longer capped at 1,000');

  // ===== J6. Bulk read: scope, concurrent arrivals, repeat =====
  const incidentBefore = one(`select md5(i::text) from public.incidents i where id='${INCIDENT}'`);
  for (let n = 1; n <= 3; n++) run(emitAccount(`i2:chip:v${n}`, 'account_verification') + emitAccount(`i2:chip:s${n}`, 'account_security'));
  s = await hub.loadHubSummary(signal(), 'account', 'verification');
  const verificationUnread = s.account.scopeUnread;
  const securityUnread = (await hub.loadHubSummary(signal(), 'account', 'security')).account.scopeUnread;
  const accountUnread = s.account.unread;
  const chipRun = await hub.markScopeRead('account', 'verification');
  assert.deepEqual([chipRun.announcements, chipRun.notifications], [0, verificationUnread], 'a chip marks exactly its own unread rows');
  s = await hub.loadHubSummary(signal(), 'account', 'security');
  assert.equal(s.account.scopeUnread, securityUnread, 'sibling chips stay untouched');
  assert.equal(s.account.unread, accountUnread - verificationUnread);
  const accountBefore = s.account.unread;
  const arrivals = [1, 2, 3, 4, 5, 6].map((n) => runAsync(emitAccount(`i2:race:${n}`, 'account_security')));
  const bulk = await hub.markScopeRead('account', 'all');
  await Promise.all(arrivals);
  const afterBulk = unreadAccountSql();
  assert.equal(afterBulk, accountBefore + 6 - bulk.notifications, 'unread = before + arrivals - actually marked: no phantom or lost rows');
  const second = await hub.markScopeRead('account', 'all');
  assert.equal(second.notifications, afterBulk, 'an explicit repeat marks exactly what arrived after the first snapshot');
  const stamp = one(`select coalesce(sum(xmin::text::bigint),0) from public.notification_inbox where recipient_id='${R1}'`);
  const third = await hub.markScopeRead('account', 'all');
  assert.deepEqual([third.announcements, third.notifications], [0, 0]);
  assert.equal(one(`select coalesce(sum(xmin::text::bigint),0) from public.notification_inbox where recipient_id='${R1}'`), stamp, 'a repeat rewrites no row');
  const everything = await hub.markScopeRead('all', 'all');
  assert.equal(everything.announcements, 1060);
  assert.equal(unreadSql(), 0, 'All/All leaves no unread inbox row, mirrors included');
  assert.equal(count(`select count(*) from public.announcement_reads where resident_id='${R1}'`), 1060);
  s = await hub.loadHubSummary(signal(), 'all', 'all');
  assert.equal(hub.totalUnread(s), 0);
  assert.equal(one(`select md5(i::text) from public.incidents i where id='${INCIDENT}'`), incidentBefore, 'bulk read never changes the incident (R06)');
  assert.equal(count(`select count(*) from public.notification_inbox where recipient_id='${R2}' and read_at is not null`), 0, "another resident's rows are untouched");
  check('J6 bulk read: chip scope, concurrent arrivals reconcile, repeat marks only new arrivals and rewrites nothing, All/All = zero unread, business rows unchanged');

  // ===== J7. Failure, delay and offline =====
  await assert.rejects(hub.loadInboxPage(signal(), 'account', 'account', 'not_a_chip', undefined, false), 'an invalid chip is rejected by the server');
  s = await hub.loadHubSummary(signal(), 'all', 'all');
  assert.equal(s.account.total, sqlAccount + 12, 'one failing source does not disturb the others');
  state.base = 'http://127.0.0.1:1';
  await assert.rejects(hub.loadHubSummary(signal(), 'all', 'all'), 'an unreachable API rejects');
  await assert.rejects(hub.setInboxRead(incidentRow.id, R1, false), /Read status could not be saved/, 'a failed read write surfaces a readable error');
  state.base = rest;
  state.delay = 300;
  const controller = new AbortController();
  const slow = hub.loadInboxPage(controller.signal, 'account', 'all', 'all', undefined, false);
  setTimeout(() => controller.abort(), 40);
  await assert.rejects(slow, 'an abandoned (delayed) request rejects instead of resolving late');
  state.delay = 0;
  assert.equal((await hub.loadInboxPage(signal(), 'account', 'all', 'all', undefined, false)).rows.length, 25, 'the next request is unaffected');
  assert.equal(count(`select count(*) from public.notification_inbox where id='${incidentRow.id}' and read_at is not null`), 1, 'the failed write changed nothing');
  check('J7 invalid input, unreachable API, delayed + abandoned request, failed write: readable failures, no partial state');

  // ===== J8. Request cost of opening the hub =====
  await measure('open All (summary + announcements page + account page/count + system page/count)', () => Promise.all([
    hub.loadHubSummary(signal(), 'all', 'all'), hub.loadAnnouncementPage(signal(), null, undefined, true),
    hub.loadInboxPage(signal(), 'account', 'all', 'all', undefined, true), hub.loadInboxPage(signal(), 'system', 'all', 'all', undefined, true)]));
  const open = metrics.at(-1);
  assert.ok(open.requests <= 6, `opening All costs at most 6 requests (saw ${open.requests})`);
  const firstPage = await hub.loadInboxPage(signal(), 'account', 'all', 'all', undefined, false);
  const requestsBefore = state.requests;
  await measure('load older Account page', () => hub.loadInboxPage(signal(), 'account', 'all', 'all', firstPage.rows.at(-1), false));
  assert.equal(state.requests - requestsBefore, 1, 'a later page is exactly one request, with no per-row queries');
  check('J8 request cost: opening All <= 6 requests; each older page = 1 request');

  const eventsTotal = count('select count(*) from barangayan_private.notification_events');
  console.log(JSON.stringify({ passed, metrics, eventsTotal }, null, 1));
} finally {
  try { run('update barangayan_private.notification_hub_settings set emission_enabled=false, v2_alerts_enabled=false;'); cleanup(); } catch (error) { console.error('cleanup failed', error.message); process.exitCode = 1; }
}
