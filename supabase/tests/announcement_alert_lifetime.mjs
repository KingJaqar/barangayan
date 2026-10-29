// Local-only upgrade/compatibility/security/event rehearsal; fixtures and DDL roll back.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const database=process.env.HOME_REQUEST_TEST_DB;
assert.match(database ?? '',/^resident_home_p1_\d{8}$/u);
const migration=readFileSync('supabase/migrations/0149_announcement_alert_expiry.sql','utf8');
const sql=`
\\set ON_ERROR_STOP on
begin;
set local search_path=public,extensions;
set local lock_timeout='5s';set local statement_timeout='60s';
select no_plan();
select is((select count(*)::int from public.announcements),0,'Disposable announcement table starts empty');
insert into public.barangays(id,name) values ('a1490000-0000-4000-8000-000000000001','Lifetime synthetic A'),('a1490000-0000-4000-8000-000000000002','Lifetime synthetic B');
insert into auth.users(id,email,raw_user_meta_data) values
 ('b1490000-0000-4000-8000-000000000001','lifetime-admin@test.local','{}'),
 ('b1490000-0000-4000-8000-000000000002','lifetime-resident@test.local','{}'),
 ('b1490000-0000-4000-8000-000000000003','lifetime-other@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values
 ('b1490000-0000-4000-8000-000000000001','a1490000-0000-4000-8000-000000000001','admin','Lifetime admin'),
 ('b1490000-0000-4000-8000-000000000002','a1490000-0000-4000-8000-000000000001','resident','Lifetime resident'),
 ('b1490000-0000-4000-8000-000000000003','a1490000-0000-4000-8000-000000000002','admin','Lifetime foreign admin');
insert into public.announcements(id,barangay_id,title,body,category,published_at) values
 ('c1490000-0000-4000-8000-000000000001','a1490000-0000-4000-8000-000000000001','Legacy emergency','Synthetic legacy','emergency',now()-interval '1 day'),
 ('c1490000-0000-4000-8000-000000000002','a1490000-0000-4000-8000-000000000001','Legacy general','Synthetic ordinary','general',now()-interval '1 day'),
 ('c1490000-0000-4000-8000-000000000003','a1490000-0000-4000-8000-000000000002','Foreign legacy','Synthetic foreign','general',now()-interval '1 day');
create temp table original as select md5(jsonb_agg(to_jsonb(a) order by id)::text) digest from public.announcements a;
create temp table policies as select md5(jsonb_agg(to_jsonb(p) order by policyname)::text) digest from pg_policies p where schemaname='public' and tablename='announcements';
-- Abort the complete additive change, then prove no column/constraint leaked.
do $failure$ begin
 begin execute $upgrade$${migration}$upgrade$;perform 1/0;
 exception when division_by_zero then null;end;
end $failure$;
select is((select count(*)::int from information_schema.columns where table_schema='public' and table_name='announcements' and column_name='alert_expires_at'),0,'Failed upgrade rolls back column and validation');
${migration}
select is((select count(*)::int from public.announcements where alert_expires_at is null),3,'No legacy lifetime backfill');
select is((select md5(jsonb_agg(to_jsonb(a)-'alert_expires_at' order by id)::text) from public.announcements a),(select digest from original),'Upgrade preserves every existing value and row');
select is((select md5(jsonb_agg(to_jsonb(p) order by policyname)::text) from pg_policies p where schemaname='public' and tablename='announcements'),(select digest from policies),'Existing audience policies unchanged');
select ok((select convalidated from pg_constraint where conname='announcements_alert_lifetime_check' and conrelid='public.announcements'::regclass),'DB lifetime check is validated');
set local role authenticated;
set local request.jwt.claim.sub='b1490000-0000-4000-8000-000000000001';
select lives_ok($q$insert into public.announcements(barangay_id,title,body) values ('a1490000-0000-4000-8000-000000000001','Old client','Omitted expiry')$q$,'Old insert payload remains valid');
select lives_ok($q$update public.announcements set body='Old edit payload' where id='c1490000-0000-4000-8000-000000000001'$q$,'Old edit payload remains valid');
select throws_ok($q$insert into public.announcements(barangay_id,title,body,category,alert_expires_at) values ('a1490000-0000-4000-8000-000000000001','Invalid category','Synthetic','general',now()+interval '1 day')$q$,'23514',null,'Non-emergency cannot have expiry');
select throws_ok($q$insert into public.announcements(barangay_id,title,body,category,published_at,alert_expires_at) values ('a1490000-0000-4000-8000-000000000001','Equal times','Synthetic','emergency',now(),now())$q$,'23514',null,'Equal publication/expiry rejected');
select throws_ok($q$insert into public.announcements(barangay_id,title,body,category,published_at,alert_expires_at) values ('a1490000-0000-4000-8000-000000000001','Reversed times','Synthetic','emergency',now(),now()-interval '1 hour')$q$,'23514',null,'Earlier expiry rejected');
select throws_ok($q$insert into public.announcements(barangay_id,title,body,category,alert_expires_at) values ('a1490000-0000-4000-8000-000000000001','Infinite expiry','Synthetic','emergency','infinity')$q$,'23514',null,'Infinite expiry rejected');
select throws_ok($q$insert into public.announcements(barangay_id,title,body,category,published_at,alert_expires_at) values ('a1490000-0000-4000-8000-000000000001','Infinite publication','Synthetic','emergency','-infinity',now())$q$,'23514',null,'Infinite publication cannot activate advisory');
select throws_ok($q$insert into public.announcements(barangay_id,title,body,category,alert_expires_at) values ('a1490000-0000-4000-8000-000000000001','Malformed','Synthetic','emergency','not-date')$q$,'22007',null,'Malformed timestamp rejected');
select lives_ok($q$insert into public.announcements(id,barangay_id,title,body,category,published_at,alert_expires_at) values ('c1490000-0000-4000-8000-000000000004','a1490000-0000-4000-8000-000000000001','Active advisory','Synthetic','emergency',now()-interval '1 hour',now()+interval '1 day')$q$,'Explicit active advisory accepted');
select lives_ok($q$insert into public.announcements(id,barangay_id,title,body,category,published_at,alert_expires_at) values ('c1490000-0000-4000-8000-000000000005','a1490000-0000-4000-8000-000000000001','Expired advisory','Synthetic','emergency','2020-01-01','2020-01-02')$q$,'Historical expiry remains valid');
select lives_ok($q$insert into public.announcements(barangay_id,title,body,category,published_at,alert_expires_at) values ('a1490000-0000-4000-8000-000000000001','Scheduled advisory','Synthetic','emergency',now()+interval '1 day',now()+interval '2 days')$q$,'Scheduled advisory can be published later');
select throws_ok($q$update public.announcements set category='health' where id='c1490000-0000-4000-8000-000000000004'$q$,'23514',null,'Category change requires clearing expiry');
select throws_ok($q$insert into public.announcements(barangay_id,title,body) values ('a1490000-0000-4000-8000-000000000002','Cross tenant','Denied')$q$,'42501',null,'Admin cannot publish to another barangay');
reset role;
create temp table event_before as select jsonb_build_object('events',(select count(*) from barangayan_private.notification_events),
 'inbox',(select count(*) from public.notification_inbox),'outbox',(select count(*) from barangayan_private.notification_outbox),
 'reads',(select count(*) from public.announcement_reads),'audit',(select count(*) from public.admin_audit_log)) counts;
select is((select count(*)::int from barangayan_private.notification_events where subject_id='c1490000-0000-4000-8000-000000000004'),1,'Create emitted one actual announcement event for one resident');
set local role authenticated;
set local request.jwt.claim.sub='b1490000-0000-4000-8000-000000000001';
select lives_ok($q$update public.announcements set alert_expires_at=now()+interval '2 days' where id='c1490000-0000-4000-8000-000000000004'$q$,'Expiry edit succeeds');
select lives_ok($q$update public.announcements set alert_expires_at=now()+interval '2 days' where id='c1490000-0000-4000-8000-000000000004'$q$,'Repeated identical expiry edit is idempotent in event behavior');
reset role;
select is(jsonb_build_object('events',(select count(*) from barangayan_private.notification_events),'inbox',(select count(*) from public.notification_inbox),
 'outbox',(select count(*) from barangayan_private.notification_outbox),'reads',(select count(*) from public.announcement_reads),
 'audit',(select count(*) from public.admin_audit_log)),(select counts from event_before),'Expiry edits do not duplicate actual fanout/read/audit events');
set local role authenticated;
set local request.jwt.claim.sub='b1490000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.announcements where category='emergency' and deleted_at is null and published_at<=now() and alert_expires_at>now()),1,'Active filter excludes legacy, scheduled, expired and foreign records');
select is((select count(*)::int from public.announcements where id='c1490000-0000-4000-8000-000000000005'),1,'Expired item stays reachable by its existing feed ID');
select throws_ok($q$insert into public.announcements(barangay_id,title,body) values ('a1490000-0000-4000-8000-000000000001','Resident write','Denied')$q$,'42501',null,'Resident cannot publish');
with changed as (update public.announcements set alert_expires_at=now()+interval '3 days' where id='c1490000-0000-4000-8000-000000000004' returning id)
select is(count(*)::int,0,'Resident cannot change expiry') from changed;
set local request.jwt.claim.sub='b1490000-0000-4000-8000-000000000003';
select is((select count(*)::int from public.announcements where id='c1490000-0000-4000-8000-000000000004'),0,'Other barangay admin cannot read private-scope advisory');
reset role;
set local role anon;
select throws_ok($q$insert into public.announcements(barangay_id,title,body) values ('a1490000-0000-4000-8000-000000000001','Anonymous write','Denied')$q$,'42501',null,'Anonymous cannot publish');
select is((select count(*)::int from public.announcements where id='c1490000-0000-4000-8000-000000000004'),1,'Existing guest read permission preserved');
reset role;
-- Targeted compensating recovery preserves unrelated content and the additive field.
create temp table recover as select id,alert_expires_at from public.announcements where id='c1490000-0000-4000-8000-000000000004';
update public.announcements set alert_expires_at=now()+interval '3 days' where id='c1490000-0000-4000-8000-000000000004';
update public.announcements a set alert_expires_at=r.alert_expires_at from recover r where a.id=r.id;
select is((select a.alert_expires_at from public.announcements a join recover r using(id)),(select alert_expires_at from recover),'Targeted expiry recovery restores recorded value');
select lives_ok($q$update public.announcements set category='health',alert_expires_at=null where id='c1490000-0000-4000-8000-000000000004'$q$,'Clearing expiry permits category change');
select * from finish();
rollback;
select 'LIFETIME_CLEAN='||((select count(*)=0 from public.announcements) and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='announcements' and column_name='alert_expires_at'))::text;
`;
const output='tmp/resident-home-phase1-20261028/lifetime';mkdirSync(output,{recursive:true});writeFileSync(output+'/tests.sql',sql);
const result=spawnSync('docker',['exec','-i','supabase_db_barangayan','psql','-U','postgres','-d',database,'-X','-At','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:120000,windowsHide:true,maxBuffer:8*1024*1024});
writeFileSync(output+'/sql-output.log',`${result.stdout??''}\n${result.stderr??''}`);
assert.equal(result.status,0,result.stderr);
assert.doesNotMatch(result.stdout,/^not ok/mu,result.stdout);
assert.match(result.stdout,/LIFETIME_CLEAN=true/u);
assert.doesNotMatch(result.stderr,/ERROR|WARNING/u);
console.log(JSON.stringify({pass:true,checks:(result.stdout.match(/^ok /gmu)??[]).length,rollback:true}));
