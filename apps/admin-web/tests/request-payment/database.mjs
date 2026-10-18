// Focused PostgreSQL rehearsal with the real request/payment guards and mutation
// migrations. Synthetic tables omit unrelated Supabase products; no hosted access.
// Install @electric-sql/pglite into a temporary directory and set PGLITE_MODULE
// to its dist/index.js to run without changing workspace dependencies.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db = new PGlite();
const root = path.resolve(import.meta.dirname, '../../../..');
const migration = name => fs.readFile(path.join(root, 'supabase/migrations', name), 'utf8');
function functionDefinition(source, name) {
  const start = source.search(new RegExp(`create (?:or replace )?function ${name.replaceAll('.', '\\.')}\\(`));
  assert.ok(start >= 0, name);
  const end = source.indexOf('end $$;', start);
  assert.ok(end > start, name);
  return source.slice(start, end + 7);
}
const uuid = n => `01320000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenant = uuid(1), foreignTenant = uuid(2), admin = uuid(3), resident = uuid(4), foreignAdmin = uuid(5), deletedAdmin = uuid(6);
const checks = [];
const query = async (sql, values = []) => (await db.query(sql, values)).rows;
const sql = statement => db.exec(statement);
const actor = async id => { await sql('reset role'); await query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await sql('set role authenticated'); };
const version = async id => (await query('select updated_at::text as value from public.service_requests where id=$1', [id]))[0].value;
const save = async (id, patch, expected) => (await query("select public.admin_mutate_record('requests',$1,'save',$2::jsonb,$3::timestamptz) as result", [id, JSON.stringify(patch), expected ?? await version(id)]))[0].result;
const rejects = async (operation, code, label) => { await assert.rejects(operation, error => error.code === code, label); checks.push(label); };
try {
  await sql(`
    create role authenticated; create role anon; create schema auth; create schema barangayan_private;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles(id uuid primary key,barangay_id uuid,role text,full_name text,deleted_at timestamptz,updated_at timestamptz default clock_timestamp());
    create function public.current_barangay_id() returns uuid language sql security definer set search_path='' stable as $$ select barangay_id from public.profiles where id=auth.uid() and deleted_at is null $$;
    create function public.current_role() returns text language sql security definer set search_path='' stable as $$ select role from public.profiles where id=auth.uid() and deleted_at is null $$;
    create table public.document_types(id uuid primary key,barangay_id uuid,is_active boolean default true,deleted_at timestamptz,contract_version int default 1,fee_centavos int default 5000,service_kind text default 'general');
    create table public.service_requests(id uuid primary key default gen_random_uuid(),barangay_id uuid,resident_id uuid,document_type_id uuid,
      reference_number text default 'PAY-TEST',contract_version int default 1,status text default 'submitted',payment_method text,
      payment_status text not null default 'pending' constraint service_requests_payment_status_check check(payment_status in ('pending','paid','refunded','waived')),
      legacy_fee_centavos int,fee_assessment_state text default 'assessed',assessed_amount_centavos int default 5000,
      submission_payload jsonb default '{}',approved_id_submission_id uuid,target_minutes_snapshot int,timing_model text default 'agency_minutes_v1',pricing_mode_snapshot text,
      requester_notes text,deleted_at timestamptz,created_at timestamptz default clock_timestamp(),updated_at timestamptz default clock_timestamp());
    create table public.payments(id uuid primary key default gen_random_uuid(),service_request_id uuid references public.service_requests(id),barangay_id uuid,
      method text not null check(method in ('pickup','qrph')),status text default 'pending',amount_centavos int not null,document_fee_centavos int not null,
      paid_at timestamptz,collected_by uuid,refund_status text default 'none',refund_amount_centavos int,refunded_at timestamptz,refunded_by uuid,
      deleted_at timestamptz,created_at timestamptz default clock_timestamp(),updated_at timestamptz default clock_timestamp());
    create table public.admin_audit_log(id uuid default gen_random_uuid(),barangay_id uuid,admin_id uuid,action text,entity_type text,entity_id uuid,entity_label text,changes jsonb,metadata jsonb);
    create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
    create trigger updated_at before update on public.service_requests for each row execute function public.set_updated_at();
    create trigger updated_at before update on public.payments for each row execute function public.set_updated_at();
    grant usage on schema public,auth,barangayan_private to authenticated,anon;
    grant select on public.profiles,public.document_types to authenticated;
    grant select,insert,update,delete on public.service_requests,public.payments to authenticated;
    alter table public.profiles enable row level security;
    create policy read_profiles on public.profiles for select to authenticated using(id=auth.uid() or barangay_id=public.current_barangay_id());
    alter table public.service_requests enable row level security;
    create policy read_requests on public.service_requests for select to authenticated using(resident_id=auth.uid() or (public.current_role()='admin' and barangay_id=public.current_barangay_id()));
    create policy edit_requests on public.service_requests for update to authenticated using(public.current_role()='admin' and barangay_id=public.current_barangay_id()) with check(public.current_role()='admin' and barangay_id=public.current_barangay_id());
    alter table public.payments enable row level security;
    create policy read_payments on public.payments for select to authenticated using(barangay_id=public.current_barangay_id());
    create policy edit_payments on public.payments for all to authenticated using(public.current_role()='admin' and barangay_id=public.current_barangay_id()) with check(public.current_role()='admin' and barangay_id=public.current_barangay_id());
    create view public.admin_requests_records with(security_invoker=true) as select id,barangay_id tenant_id,to_jsonb(r) as row from public.service_requests r where public.current_role()='admin' and barangay_id=public.current_barangay_id();
    grant select on public.admin_requests_records to authenticated;
  `);
  const foundations = await migration('0095_phase1_shared_foundations.sql');
  await sql(functionDefinition(foundations, 'barangayan_private.assert_actor'));
  await sql(functionDefinition(foundations, 'barangayan_private.check_keys'));
  await sql(functionDefinition(await migration('0101_unified_document_type_charter_forms.sql'), 'barangayan_private.guard_request_foundations')
    .replace("where id = new.resident_id and role = 'resident'", "where id = new.resident_id and role in ('resident','admin')"));
  await sql(functionDefinition(await migration('0126_restore_automatic_request_submission.sql'), 'barangayan_private.guard_payment_foundations'));
  await sql(`create trigger a_guard_request_foundations before insert or update on public.service_requests for each row execute function barangayan_private.guard_request_foundations();
    create trigger a_guard_payment_foundations before insert or update on public.payments for each row execute function barangayan_private.guard_payment_foundations();`);
  await sql(await migration('0129_admin_record_sheet_edit_parity.sql'));
  await sql(await migration('0131_request_editor_admin_resident_options.sql'));
  await query(`insert into public.profiles(id,barangay_id,role,full_name,deleted_at) values
    ($1,$2,'admin','Admin',null),($3,$2,'resident','Resident',null),($4,$5,'admin','Foreign',null),($6,$2,'admin','Deleted',now())`, [admin,tenant,resident,foreignAdmin,foreignTenant,deletedAdmin]);
  await query('insert into public.document_types(id,barangay_id,contract_version) values ($1,$2,1),($3,$2,2)',[uuid(10),tenant,uuid(11)]);
  await sql("select set_config('barangayan.foundation_operation','submit',false)");
  for (const [id,contract,owner] of [[uuid(20),1,resident],[uuid(21),2,resident],[uuid(22),2,admin],[uuid(23),2,resident]]) {
    await query('insert into public.service_requests(id,barangay_id,resident_id,document_type_id,contract_version,payment_method) values($1,$2,$3,$4,$5,\'pickup\')',[id,tenant,owner,contract===1?uuid(10):uuid(11),contract]);
  }
  await sql("select set_config('barangayan.foundation_operation','',false)");
  await query("insert into public.payments(service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos) values($1,$2,'pickup','failed',5000,5000)",[uuid(20),tenant]);
  await sql(await migration('0132_request_payment_column_editors.sql'));
  assert.equal((await query('select payment_status from public.service_requests where id=$1',[uuid(20)]))[0].payment_status,'failed');
  checks.push('Migration backfills existing failed ledger attempts into request status');
  await sql('create trigger sync_payments_to_service_request after insert or update on public.payments for each row execute function public.sync_service_request_payment_status();');
  await actor(admin);
  for (const id of [uuid(20),uuid(21),uuid(22)]) {
    const first = await save(id,{payment_method:'qrph',payment_status:'paid'});
    assert.equal(first.row.payment_status,'paid'); assert.equal(first.row.payment_method,'qrph');
    const stale = first.row.updated_at;
    for (const status of ['failed','refunded','pending','paid']) {
      const saved=await save(id,{payment_status:status}); assert.equal(saved.row.payment_status,status);
      const [payment]=await query('select * from public.payments where service_request_id=$1',[id]);
      assert.equal(payment.status,status); assert.equal(payment.amount_centavos,5000);
      assert.equal(payment.refund_status,status==='refunded'?'refunded':'none');
    }
    const saved=await save(id,{payment_method:'pickup'});
    const [payment]=await query('select * from public.payments where service_request_id=$1',[id]);
    assert.equal(saved.row.payment_method,'pickup'); assert.equal(payment.method,'pickup');
    await rejects(()=>save(id,{payment_status:'failed'},stale),'40001','Stale payment correction rejected');
    checks.push('Both fields and all four statuses persist together for '+id);
  }
  await rejects(()=>save(uuid(21),{requester_notes:'overwrite'}),'42501','Versioned submitted information protected');
  await rejects(()=>save(uuid(21),{payment_status:'waived'}),'22023','Unsupported status rejected');
  await rejects(()=>save(uuid(23),{payment_status:'refunded'}),'22023','Refund correction needs a recorded payment');
  await save(uuid(23),{payment_status:'failed'});
  assert.equal((await query('select payment_status from public.service_requests where id=$1',[uuid(23)]))[0].payment_status,'failed');
  const oldVersion = await version(uuid(20));
  await rejects(()=>save(uuid(20),{payment_status:'failed',document_type_id:uuid(999)}),'42501','Invalid mixed edit rolls back payment correction');
  assert.equal(await version(uuid(20)),oldVersion);
  assert.equal((await query('select status from public.payments where service_request_id=$1',[uuid(20)]))[0].status,'paid');
  await query("update public.payments set status='failed' where service_request_id=$1",[uuid(21)]);
  assert.equal((await query('select payment_status from public.service_requests where id=$1',[uuid(21)]))[0].payment_status,'failed');
  await query("update public.payments set status='pending' where service_request_id=$1",[uuid(21)]);
  assert.equal((await query('select payment_status from public.service_requests where id=$1',[uuid(21)]))[0].payment_status,'pending');
  checks.push('Transaction status changes synchronize failed and pending request summaries');
  await sql('reset role');
  await query("update public.payments set status='failed' where service_request_id=$1",[uuid(21)]);
  await query("insert into public.payments(id,service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos,created_at) values($1,$2,$3,'pickup','failed',5000,5000,'2020-01-01')",[uuid(40),uuid(21),tenant]);
  await query("update public.payments set status='pending' where service_request_id=$1 and id<>$2",[uuid(21),uuid(40)]);
  await query("update public.payments set status='expired' where id=$1",[uuid(40)]);
  assert.equal((await query('select payment_status from public.service_requests where id=$1',[uuid(21)]))[0].payment_status,'pending');
  checks.push('Late older attempt events do not replace the active payment summary');
  await actor(admin);
  await sql('reset role');
  await query("update public.document_types set service_kind='business' where id=$1",[uuid(11)]);
  await actor(admin);
  await rejects(()=>save(uuid(21),{payment_method:'qrph'}),'22023','Pickup-only document constraint preserved');
  await sql('reset role');
  await query("update public.document_types set service_kind='general' where id=$1",[uuid(11)]);
  await sql("select set_config('barangayan.foundation_operation','assessment',false)");
  await query("update public.service_requests set fee_assessment_state='page_count_required',assessed_amount_centavos=null where id=$1",[uuid(23)]);
  await sql("select set_config('barangayan.foundation_operation','',false)");
  await actor(admin);
  await rejects(()=>save(uuid(23),{payment_status:'paid'}),'22023','Unconfirmed fees cannot fabricate a paid ledger');
  await rejects(()=>query("update public.service_requests set payment_status='failed' where id=$1",[uuid(21)]),'42501','Direct versioned status update cannot bypass correction path');
  await rejects(async()=>query("select barangayan_private.admin_edit_request_payment($1,'{\"amount_centavos\":1}',$2)",[uuid(21),await version(uuid(21))]),'22023','Correction cannot change protected amounts');
  await actor(resident);
  await rejects(()=>save(uuid(21),{payment_status:'paid'}),'42501','Resident denied admin payment editing');
  await actor(foreignAdmin);
  await rejects(()=>save(uuid(21),{payment_status:'paid'},new Date().toISOString()),'42501','Foreign admin denied payment editing');
  await actor(deletedAdmin);
  await rejects(()=>save(uuid(21),{payment_status:'paid'},new Date().toISOString()),'42501','Deleted admin denied payment editing');
  await sql('reset role');
  const [audit]=await query("select count(*)::int total from public.admin_audit_log where metadata->>'operation'='payment_record_correction'");
  assert.ok(audit.total>=19); checks.push('Successful payment corrections have atomic audit entries');
  const [privilege]=await query("select has_function_privilege('anon','barangayan_private.admin_edit_request_payment(uuid,jsonb,timestamptz)','execute') as allowed");
  assert.equal(privilege.allowed,false); checks.push('Anonymous execution denied');
  console.log(JSON.stringify({status:'passed',checks,limitations:['Isolated PostgreSQL runtime, synthetic tables and auth claims; Supabase REST and external payment provider not exercised.']},null,2));
} finally { await db.close(); }
