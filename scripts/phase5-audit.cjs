/* global __dirname */
// Disposable local database only; no linked project or hosted URL accepted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function sql(source){
 const r=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker','exec','-i','supabase_db_barangayan','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{input:source,encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);return r.stdout.trim();
}
if(process.argv[2]==='refresh-report'){
 const migration=fs.readFileSync(path.join(root,'supabase/migrations/0099_phase5_sla_engine_reporting.sql'),'utf8');
 const start=migration.indexOf('create function barangayan_private.service_sla_report_rows()');
 const end=migration.indexOf('create function public.service_sla_report_rows()',start);
 assert.ok(start>0&&end>start);
 sql(migration.slice(start,end).replace('create function','create or replace function'));
 console.log('Refreshed only the local report function for iterative verification.');
}else if(process.argv[2]==='native-fixtures'){
 sql(`begin;
 insert into public.document_types(id,barangay_id,name,fee_centavos,processing_target_hours)
 values('f5000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Historical service (local test)',5000,24) on conflict(id) do nothing;
 insert into public.service_requests(id,barangay_id,resident_id,document_type_id,requester_notes,created_at)
 select 'f5000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','51e1d7bb-3637-44fb-84c3-f69003807161','f5000000-0000-0000-0000-000000000001','Local historical fixture','2026-01-01Z'::timestamptz
 where not exists(select 1 from public.service_requests where id='f5000000-0000-0000-0000-000000000002');
 select set_config('barangayan.allow_request_completion','true',true);
 update public.service_requests set status='completed',payment_status='waived',status_history='[{"status":"submitted","at":"2026-01-01T00:00:00Z"},{"status":"completed","at":"2026-01-02T00:00:00Z"}]'
 where id='f5000000-0000-0000-0000-000000000002';
 update public.service_requests set status_history='[{"status":"submitted","at":"2026-01-01T00:00:00Z"},{"status":"completed","at":"2026-01-02T00:00:00Z"}]'
 where id='f5000000-0000-0000-0000-000000000002';
 update public.document_types set is_active=false where id='f5000000-0000-0000-0000-000000000001';
 commit;`);
 console.log('Prepared a local historical hours fixture without activating another pilot service.');
}else if(process.argv[2]==='native-wait'){
 sql(`begin;
 set local role authenticated;
 set local request.jwt.claim.sub='c467cc4c-aeca-43db-80ce-20d6625ac6d7';
 select public.review_service_request('{"requestId":"998caa1e-9472-4ead-a5b0-73c6617fed95","requirementsComplete":true,"eligibility":"eligible","note":"Native local acceptance fixture","personalAppearancePresent":true}');
 select public.transition_service_request_sla('{"requestId":"998caa1e-9472-4ead-a5b0-73c6617fed95","action":"accept","requirementsComplete":true,"personalAppearanceReady":true}');
 select public.transition_service_request_sla('{"requestId":"998caa1e-9472-4ead-a5b0-73c6617fed95","action":"pause","reason":"Resident supplying original certificate"}');
 reset role;
 select set_config('barangayan.foundation_operation','sla',true);
 update public.service_requests r set created_at=p.started_at-interval '10 minutes',accepted_at=p.started_at-interval '5 minutes'
 from public.service_request_pauses p where r.id=p.request_id and r.id='998caa1e-9472-4ead-a5b0-73c6617fed95' and p.resumed_at is null;
 commit;`);
 const metrics=JSON.parse(sql("select public.service_request_sla_metrics('998caa1e-9472-4ead-a5b0-73c6617fed95')"));
 assert.equal(metrics.agencySeconds,300);assert.equal(metrics.position,'on_track');
 fs.writeFileSync(path.join(root,'plans/evidence/phase5/native-wait-metrics.json'),JSON.stringify(metrics,null,2));
 console.log('PASS: native resident-wait fixture freezes agency time at exactly 300 seconds.');
}else if(process.argv[2]==='legacy-report'){
 const rows=JSON.parse(sql(`begin; set local role authenticated; set local request.jwt.claim.sub='c467cc4c-aeca-43db-80ce-20d6625ac6d7'; select public.service_sla_report_rows(); rollback;`).split('\n').find(line=>line.startsWith('{')));
 const shared=require(path.join(root,'dist/phase5-tools/shared-audit.cjs'));
 const summary=shared.summarizeAgencySla(rows.requests,new Date('2026-01-02Z'),new Date('2026-01-03Z'),rows.evaluated_at);
 assert.equal(summary.readyCount,3);assert.equal(summary.averageProcessingSeconds,900);assert.equal(summary.averageResidentWaitSeconds,60);assert.equal(summary.withinTargetPercent,100);assert.equal(summary.releasedCount,0);assert.equal(summary.legacyCount,1);
 const legacy=rows.requests.filter(r=>r.timing_model==='legacy_hours');
 const trends=shared.computeDocumentTypeTrends(legacy,legacy.map(r=>({id:r.document_type_id,name:r.document_type_name,processing_target_hours:r.legacy_target_hours})));
 assert.equal(trends.length,1);assert.equal(trends[0].averageHours,24);assert.equal(trends[0].targetHours,24);
 fs.writeFileSync(path.join(root,'plans/evidence/phase5/legacy-report-audit.json'),JSON.stringify({summary,trends,passed:true},null,2));
 console.log('PASS: real tenant report preserves a separate 24-hour historical result without changing minute compliance.');
}else if(process.argv[2]==='audit'){
 const data=JSON.parse(sql(`select jsonb_build_object('job',(select to_jsonb(j) from cron.job j where jobname='service-request-sla-minute'),
  'recent_runs',(select jsonb_agg(to_jsonb(t)) from (select status,start_time,end_time,return_message from cron.job_run_details
   where jobid=(select jobid from cron.job where jobname='service-request-sla-minute') order by start_time desc limit 5)t),
  'journey',(select jsonb_build_object('request',to_jsonb(r),'pauses',(select jsonb_agg(to_jsonb(p)) from public.service_request_pauses p where p.request_id=r.id),
   'metrics',public.service_request_sla_metrics(r.id)) from public.service_requests r where r.id='e5b8a242-97c7-48cd-95c7-a750aed75bd7'))`));
 assert.equal(data.job.schedule,'* * * * *');assert.ok(data.recent_runs.some(r=>r.status==='succeeded'));
 assert.equal(data.journey.request.sla_state,'released');assert.ok(data.journey.request.released_at>data.journey.request.ready_at);
 const bundle=path.join(root,'dist/phase5-tools/shared-audit.cjs');
 require('esbuild').buildSync({entryPoints:[path.join(root,'packages/shared/src/index.ts')],bundle:true,platform:'node',format:'cjs',outfile:bundle});
 const shared=require(bundle).calculateAgencySla(data.journey.request,data.journey.pauses);
 assert.deepEqual(shared,data.journey.metrics);
 fs.writeFileSync(path.join(root,'plans/evidence/phase5/ui-database-audit.json'),JSON.stringify({...data,shared,passed:true},null,2));
 console.log('PASS: real minute scheduler, browser journey, SQL/shared processing/wait/turnaround parity.');
}else throw Error('Choose refresh-report or audit');
