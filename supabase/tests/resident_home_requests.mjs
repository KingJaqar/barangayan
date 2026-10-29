// Run only against an empty schema-only disposable clone; all fixtures and DDL roll back.
// PowerShell: $env:HOME_REQUEST_TEST_DB='resident_home_p1_20261028'; node supabase/tests/resident_home_requests.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const database = process.env.HOME_REQUEST_TEST_DB;
assert.match(database ?? '', /^resident_home_p1_\d{8}$/u, 'An explicitly named disposable Home database is required');
const root = process.cwd();
const output = path.join(root, 'tmp/resident-home-phase1-20261028/db');
mkdirSync(output, { recursive: true });
const bundle = path.join(output, 'priority.mjs');
await build({ entryPoints: ['packages/shared/src/lib/home-request-priority.ts'], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const { homeRequestAttention } = await import(pathToFileURL(bundle).href);
const fees = path.join(output, 'fees.mjs');
await build({ entryPoints: ['packages/shared/src/lib/service-catalog.ts'], outfile: fees, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const { requestFee } = await import(pathToFileURL(fees).href);
const uuid = (prefix, number) => `${prefix}000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const quote = value => value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
const base = { version: 2, fee: 1000, state: 'assessed', status: 'submitted', payment: 'pending', method: null, paused: false };
const fixtures = [
  ['assessed', {}], ['unknown fee', { fee: null, state: 'pickup_due' }],
  ['free', { fee: 0 }], ['pickup', { method: 'pickup' }],
  ['qr', { method: 'qrph' }], ['qr below minimum', { method: 'qrph', fee: 99 }],
  ['qr minimum', { method: 'qrph', fee: 100 }], ['waived', { payment: 'waived', fee: 0, state: 'waived' }],
  ['paid', { payment: 'paid', ledger: [{ status: 'paid', amount: 1000, fee: null }] }],
  ['refunded', { payment: 'refunded' }], ['failed', { payment: 'failed' }],
  ['pages', { fee: null, state: 'page_count_required' }], ['paused', { paused: true, fee: null, state: 'pickup_due' }],
  ['processing', { status: 'in_progress' }], ['ready paid', { status: 'ready_for_pickup', payment: 'paid', ledger: [{ status: 'paid', amount: 1000, fee: 1000 }] }],
  ['completed', { status: 'completed' }], ['cancelled', { status: 'cancelled' }],
  ['legacy catalog', { version: 1, fee: null }], ['legacy snapshot', { version: 1, fee: null, snapshot: 1700 }],
  // Only legacy contracts permit ledger/assessment differences and multiple historical attempts.
  ['ledger fee wins', { version: 1, ledger: [{ status: 'pending', amount: 2300, fee: 1900 }] }],
  ['ledger amount fallback', { version: 1, ledger: [{ status: 'pending', amount: 2300, fee: null }] }],
  ['paid wins over newer', { version: 1, payment: 'paid', ledger: [{ status: 'paid', amount: 3000, fee: 2400 }, { status: 'failed', amount: 9000, fee: null }] }],
  ['latest nonpaid wins', { version: 1, ledger: [{ status: 'failed', amount: 2100, fee: null }, { status: 'pending', amount: 2600, fee: 2200 }] }],
  ['ledger stable ID tie', { version: 1, tie: true, ledger: [{ status: 'pending', amount: 2500, fee: null }, { status: 'failed', amount: 2700, fee: null }] }],
].map(([name, changes], index) => ({ ...base, ...changes, name, number: index + 1, owner: uuid('b1', index + 1), id: uuid('d1', index + 1) }));
const migration = readFileSync('supabase/migrations/0148_resident_home_request_priority.sql', 'utf8');
const charter = Object.fromEntries(['officeDivision','classification','transactionType','whoMayAvail','checklistOfRequirements',
  'whereToSecureRequirements','clientSteps','agencyActions','feesToBePaid','processingTime','personResponsible'].map(key => [key,'Synthetic fixture']));
const sql = [];
sql.push(`\n\\set ON_ERROR_STOP on
begin;
set local lock_timeout='5s'; set local statement_timeout='60s';
set local search_path=public,extensions;
do $$ begin
  if (select count(*) from public.service_requests) <> 0 or (select count(*) from public.profiles) <> 0
    or to_regprocedure('public.resident_home_requests(boolean)') is not null then
    raise exception 'requires empty schema-only disposable database';
  end if;
end $$;
insert into public.barangays(id,name) values ('a1000000-0000-4000-8000-000000000001','Home synthetic A'),('a1000000-0000-4000-8000-000000000002','Home synthetic B');
insert into public.document_types(id,barangay_id,name,fee_centavos) values
 ('c1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Legacy Home fixture',3100);
insert into public.document_types(id,barangay_id,name,fee_centavos,contract_version,service_kind,charter,requirement_rules,purposes,processing_target_minutes,pricing_mode) values
 ('c1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Business Home fixture',0,2,'business',
 ${quote(JSON.stringify(charter))},'{"dtiRequired":false,"hoaRequired":false,"lessorForRenter":false,"personalAppearance":false}',
 '[{"code":"fixture","label":"Fixture","requiresExplanation":false}]',15,'fixed');
-- Privileged fixture seed uses the same server-only completion context as transitions.
-- No trigger, constraint or policy is disabled while inserting historical states.
set local barangayan.allow_request_completion='true';
set local barangayan.foundation_operation='submit';`);
for (const f of fixtures) {
  const submission = uuid('e1', f.number);
  sql.push(`insert into auth.users(id,email,raw_user_meta_data) values (${quote(f.owner)},'home-${f.number}@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values (${quote(f.owner)},'a1000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values (${quote(submission)},${quote(f.owner)},'a1000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-${f.number}','fixture/back-${f.number}','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values (${quote(f.id)},${quote(f.owner)},'a1000000-0000-4000-8000-000000000001',${quote(uuid('c1', f.version))},${f.version},${f.snapshot ?? 'null'},${f.number === 1 ? "'2026-01-01'" : 'now()'},
 ${f.version === 1 ? 'null,null,null,null,null,null,\'legacy_hours\',null,\'legacy\',\'legacy\',null,null,null,\'legacy\',null'
 : `${quote(f.id)},'{}',${quote(submission)},'fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing',${quote(f.state)},${f.fee ?? 'null'},'Fixture fee',now(),'complete','fixed'`});`);
  for (const [index, payment] of (f.ledger ?? []).entries()) sql.push(`insert into public.payments(id,service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos,created_at)
 values (${quote(uuid('f1', f.number * 10 + index))},${quote(f.id)},'a1000000-0000-4000-8000-000000000001','pickup',${quote(payment.status)},${payment.amount},${payment.fee ?? 'null'},'2026-10-20'::timestamptz + interval '${f.tie ? 0 : index} minutes');`);
  sql.push(`set local barangayan.foundation_operation='sla';
update public.service_requests set status=${quote(f.status)}, payment_status=${quote(f.payment)},payment_method=${quote(f.method)},
 sla_state=${quote(f.version === 1 ? 'legacy' : f.paused ? 'paused' : ({submitted:'pre_processing',in_progress:'running',ready_for_pickup:'ready',completed:'released',cancelled:'cancelled'})[f.status])},
 accepted_at=${f.version === 2 && (f.paused || ['in_progress','ready_for_pickup','completed'].includes(f.status)) ? 'now()' : 'null'},
 ready_at=${f.version === 2 && ['ready_for_pickup','completed'].includes(f.status) ? 'now()' : 'null'},
 released_at=${f.version === 2 && f.status === 'completed' ? 'now()' : 'null'},
 cancelled_at=${f.version === 2 && f.status === 'cancelled' ? 'now()' : 'null'} where id=${quote(f.id)};
set local barangayan.foundation_operation='submit';`);
}
sql.push(`
-- Retired services remain visible to their request owners via migration 0143.
update public.document_types set is_active=false where id='c1000000-0000-4000-8000-000000000001';
create temp table before_rows as select 'requests' as name,md5(jsonb_agg(to_jsonb(r) order by id)::text) as digest from public.service_requests r
 union all select 'payments',md5(jsonb_agg(to_jsonb(p) order by id)::text) from public.payments p;
-- A failed upgrade must roll back its function and grants inside the subtransaction.
do $failure$ begin
  begin
    execute $upgrade$${migration}$upgrade$;
    perform 1/0;
  exception when division_by_zero then null;
  end;
  if to_regprocedure('public.resident_home_requests(boolean)') is not null then raise exception 'failed upgrade leaked DDL'; end if;
end $failure$;
${migration}
do $$ begin
  if has_function_privilege('anon','public.resident_home_requests(boolean)','execute')
    or not has_function_privilege('authenticated','public.resident_home_requests(boolean)','execute')
    or (select prosecdef or provolatile <> 's' from pg_proc where oid='public.resident_home_requests(boolean)'::regprocedure) then
    raise exception 'invalid function authority';
  end if;
end $$;
create temp table results(label text,payload jsonb);
grant insert,select on results to authenticated;
-- Event/read-marker state before the read-only RPC calls.
create temp table event_before as select jsonb_build_object('inbox',(select count(*) from public.notification_inbox),
 'reads',(select count(*) from public.announcement_reads),'audit',(select count(*) from public.admin_audit_log),
 'events',(select count(*) from barangayan_private.notification_events),'outbox',(select count(*) from barangayan_private.notification_outbox),
 'deliveries',(select count(*) from barangayan_private.notification_deliveries)) as counts;
set local role authenticated;`);
for (const f of fixtures) {
  sql.push(`set local request.jwt.claim.sub=${quote(f.owner)};
insert into results select ${quote(f.name)},jsonb_build_object('off',(select jsonb_agg(to_jsonb(q)) from public.resident_home_requests(false) q),'on',(select jsonb_agg(to_jsonb(q)) from public.resident_home_requests(true) q));`);
}
sql.push(`
-- Even a valid authenticated caller without an owner identity sees no rows.
set local request.jwt.claim.sub='';
insert into results select 'no identity',to_jsonb(count(*)) from public.resident_home_requests();
reset role;
do $$ begin
 if (select counts from event_before) is distinct from jsonb_build_object('inbox',(select count(*) from public.notification_inbox),
 'reads',(select count(*) from public.announcement_reads),'audit',(select count(*) from public.admin_audit_log),
 'events',(select count(*) from barangayan_private.notification_events),'outbox',(select count(*) from barangayan_private.notification_outbox),
 'deliveries',(select count(*) from barangayan_private.notification_deliveries)) then raise exception 'query emitted events'; end if;
 if exists (select 1 from before_rows b join (
  select 'requests' as name,md5(jsonb_agg(to_jsonb(r) order by id)::text) as digest from public.service_requests r
  union all select 'payments',md5(jsonb_agg(to_jsonb(p) order by id)::text) from public.payments p
 ) a using(name) where a.digest is distinct from b.digest) then raise exception 'upgrade/query mutated data'; end if;
end $$;
set local role anon;
do $$ begin
 begin
  perform public.resident_home_requests();
  raise exception 'anonymous execution allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
-- Prove caller RLS still applies even though the function also has an owner predicate.
savepoint owner_policy;
drop policy "residents can read their own service requests" on public.service_requests;
set local role authenticated;
set local request.jwt.claim.sub='b1000000-0000-4000-8000-000000000001';
insert into results select 'RLS deny',to_jsonb(count(*)) from public.resident_home_requests();
reset role;
-- Keep the assertion outside the rolled-back savepoint.
do $$ begin if exists (select 1 from results where label='RLS deny' and payload <> '0'::jsonb) then raise exception 'RLS bypassed'; end if; end $$;
rollback to savepoint owner_policy;
-- Missing optional metadata must not remove a request or manufacture a free fee.
savepoint catalog_policy;
drop policy "residents can read document types of their own requests" on public.document_types;
set local role authenticated;
set local request.jwt.claim.sub='b1000000-0000-4000-8000-000000000018';
do $$ begin
 if not exists (select 1 from public.resident_home_requests() where document_name is null and resolved_fee_centavos is null and next_action is null) then
  raise exception 'missing catalog metadata lost request or invented fee';
 end if;
end $$;
reset role;
rollback to savepoint catalog_policy;
set local request.jwt.claim.sub='';
-- Foreign-barangay fixture remains outside the owner-visible dataset.
insert into auth.users(id,email,raw_user_meta_data) values ('b1000000-0000-4000-8000-000000000099','home-foreign@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b1000000-0000-4000-8000-000000000099','a1000000-0000-4000-8000-000000000002','resident','Home foreign synthetic');
insert into public.document_types(id,barangay_id,name,fee_centavos) values ('c1000000-0000-4000-8000-000000000099','a1000000-0000-4000-8000-000000000002','Foreign synthetic',1000);
insert into public.service_requests(id,resident_id,barangay_id,document_type_id) values ('d1000000-0000-4000-8000-000000000099','b1000000-0000-4000-8000-000000000099','a1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000099');
-- Older actionable request must beat more than three newer inactive requests.
-- Use the first owner, whose assessed request is our older actionable row.
update public.document_types set is_active=true where id='c1000000-0000-4000-8000-000000000001';
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,created_at,updated_at,payment_method)
select ('d1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b1000000-0000-4000-8000-000000000001',
 'a1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','2026-10-27','2026-10-27','pickup'
from generate_series(101,104) n;
set local barangayan.foundation_operation='sla';
update public.service_requests set status='completed' where id in ('d1000000-0000-4000-8000-000000000101','d1000000-0000-4000-8000-000000000102');
update public.service_requests set status='cancelled' where id in ('d1000000-0000-4000-8000-000000000103','d1000000-0000-4000-8000-000000000104');
set local role authenticated;
set local request.jwt.claim.sub='b1000000-0000-4000-8000-000000000001';
insert into results select 'priority',jsonb_agg(to_jsonb(q)) from public.resident_home_requests() q;
reset role;
set local request.jwt.claim.sub='';
-- Other active precedes completed; update time wins over ID among active ties.
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,created_at,updated_at,payment_method)
select ('d1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b1000000-0000-4000-8000-000000000001',
 'a1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','2026-10-27',
 case when n=105 then '2026-10-27'::timestamptz else '2026-10-26'::timestamptz end,'pickup'
from generate_series(105,106) n;
set local role authenticated;
set local request.jwt.claim.sub='b1000000-0000-4000-8000-000000000001';
insert into results select 'active priority',jsonb_agg(to_jsonb(q)) from public.resident_home_requests() q;
reset role;
select 'HOME_RESULT='||jsonb_object_agg(label,payload)::text from results;
rollback;
select 'HOME_CLEAN='||(to_regprocedure('public.resident_home_requests(boolean)') is null and (select count(*)=0 from public.service_requests))::text;`);

const script = sql.join('\n');
writeFileSync(path.join(output,'fixtures.sql'),script);
const result = spawnSync('docker', ['exec','-i','supabase_db_barangayan','psql','-U','postgres','-d',database,'-X','-At','-v','ON_ERROR_STOP=1'], { input: script, encoding:'utf8',timeout:120000,windowsHide:true,maxBuffer:8*1024*1024 });
writeFileSync(path.join(output,'sql-output.log'),`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
process.stderr.write(result.stderr ?? '');
assert.equal(result.status,0,`SQL failed: ${result.error?.message ?? result.stderr}`);
assert.match(result.stdout,/HOME_CLEAN=true/u,'DDL and fixture rollback failed');
const line=result.stdout.split('\n').find(value=>value.startsWith('HOME_RESULT='));
assert.ok(line,'Missing SQL result');
const rows=JSON.parse(line.slice('HOME_RESULT='.length));
assert.equal(rows['no identity'],0);
assert.deepEqual(rows.priority.map(row=>row.id),[uuid('d1',1),uuid('d1',102),uuid('d1',101)]);
assert.deepEqual(rows['active priority'].map(row=>row.id),[uuid('d1',1),uuid('d1',105),uuid('d1',106)]);
assert.equal(new Set(rows.priority.map(row=>row.id)).size,3);
for(const f of fixtures) {
  const ledger=[...(f.ledger ?? [])].map((p,index)=>({...p,index})).sort((a,b)=>Number(b.status==='paid')-Number(a.status==='paid') || b.index-a.index)[0];
  const expectedFee=requestFee({contract_version:f.version,fee_assessment_state:f.state,assessed_amount_centavos:f.fee,legacy_fee_centavos:f.snapshot},3100,ledger?.fee ?? ledger?.amount);
  for(const capability of [false,true]) {
    const values=rows[f.name][capability?'on':'off'];
    assert.equal(values.length,1,`${f.name}: foreign-owner rows leaked or owner missing`);
    const [row]=values;
    assert.equal(row.id,f.id);
    assert.equal(row.resolved_fee_centavos,expectedFee,`${f.name}: fee parity`);
    assert.equal(row.next_action,homeRequestAttention(row,capability),`${f.name}: action parity`);
    assert.equal(row.document_name,f.version===1?'Legacy Home fixture':'Business Home fixture');
  }
}
console.log(JSON.stringify({pass:true,fixtures:fixtures.length,feeAndActionComparisons:fixtures.length*2,authority:true,rls:true,crossOwner:true,crossBarangay:true,retiredAndMissingCatalog:true,priorityBeforeLimit:true,stableTies:true,failedUpgradeRollback:true,unchangedDataAndEvents:true,cleanRollback:true}));
