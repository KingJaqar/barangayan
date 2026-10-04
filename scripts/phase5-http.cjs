/* global __dirname, Buffer */
// Local Auth/Storage/PostgREST only; no hosted credentials or production data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),{spawnSync}=require('node:child_process'),{createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'..'),output=path.join(root,'plans/evidence/phase5',`http-${Date.now()}`);
fs.mkdirSync(output,{recursive:true});
const status=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--cd','/mnt/c/Users/User/barangayan','--exec','/opt/barangayan-tools/supabase','status','--output','json'],{encoding:'utf8',timeout:30000});
assert.equal(status.status,0);const config=JSON.parse(status.stdout);assert.equal(config.API_URL,'http://127.0.0.1:54321');
const make=key=>createClient(config.API_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const trusted=make(config.SERVICE_ROLE_KEY),report={passed:false,assertions:[]},tenant='00000000-0000-0000-0000-000000000001';
const prove=(condition,label)=>{assert.ok(condition,label);report.assertions.push(label);};
async function ok(operation,label){const r=await operation;assert.ifError(r.error);report.assertions.push(label);return r.data;}
async function denied(operation,label){const r=await operation;prove(!!r.error,label);prove(!r.error?.code?.startsWith('PGRST0'),label+' is an application denial');}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64');
async function user(role,barangay_id){
  const email=`phase5-${role}-${randomUUID()}@test.local`,password='PhaseLocalOnly!2026';
  const auth=await ok(trusted.auth.admin.createUser({email,password,email_confirm:true}),'Create synthetic '+role);
  const id=auth.user.id;
  await ok(trusted.from('profiles').insert({id,barangay_id,role,full_name:'Phase Five '+role,first_name:'Phase',last_name:'Three',house_no:'12',street:'Main Street',sex:'female',employment_status:'student',birth_date:'2000-01-01',mobile_number:'09171234567',email}),'Provision synthetic profile');
  const client=make(config.ANON_KEY);await ok(client.auth.signInWithPassword({email,password}),'Real '+role+' session');
  return {id,email,password,client};
}
function sql(source) {
 const result=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker','exec','-i','supabase_db_barangayan','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{input:source,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return result.stdout.trim();
}
function concurrentSql(source) {
 return new Promise((resolve,reject)=>{
  const child=require('node:child_process').spawn('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker','exec','-i','supabase_db_barangayan','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At']);
  let out='',error='';child.stdout.on('data',bytes=>out+=bytes);child.stderr.on('data',bytes=>error+=bytes);
  child.on('error',reject);child.on('exit',code=>code===0?resolve(out.trim()):reject(Error(error)));child.stdin.end(source);
 });
}
async function main(){
 const resident=await user('resident',tenant),admin=await user('admin',tenant);
 const other=randomUUID();await ok(trusted.from('barangays').insert({id:other,name:'Phase Five foreign tenant'}),'Create foreign tenant');
 const foreign=await user('admin',other),second=await user('resident',tenant);
 const version=randomUUID(),frontPath=`${resident.id}/versions/${version}/id-front.png`,backPath=`${resident.id}/versions/${version}/id-back.png`;
 for(const name of [frontPath,backPath])await ok(resident.client.storage.from('id-documents').upload(name,png,{contentType:'image/png',upsert:false}),'Real private ID upload');
 await ok(resident.client.rpc('publish_id_submission',{p_input:{submissionId:version,idType:'Passport',frontPath,backPath}}),'Publish resident evidence');
 await ok(admin.client.rpc('review_id_submission',{p_input:{submissionId:version,decision:'verified'}}),'Approve evidence');
 const doc=(await ok(resident.client.from('document_types').select('*').eq('service_kind','first_time_job_seeker').eq('barangay_id',tenant).single(),'Read configured fifteen minute service'));
 async function submit(){return ok(resident.client.rpc('submit_service_request',{p_input:{documentTypeId:doc.id,idempotencyKey:randomUUID(),purposeCode:doc.purposes[0].code,details:{isRenter:false,personalAppearanceAcknowledged:true},attachments:[]}}),'Submit snapshotted request');}
 async function transition(id,action,extra={}){return ok(admin.client.rpc('transition_service_request_sla',{p_input:{requestId:id,action,...extra}}),'Staff '+action);}
 const id=await submit();
 const row=await ok(resident.client.from('service_requests').select('*').eq('id',id).single(),'Read target snapshot');
 prove(row.target_minutes_snapshot===15&&row.timing_model==='agency_minutes_v1'&&row.accepted_at===null,'Submission snapshots target but does not start agency clock');
 await denied(resident.client.rpc('service_sla_report_rows'),'Resident report denied');
 for(const actor of [foreign,second]) {
  const result=await ok(actor.client.rpc('service_request_sla_tracking',{p_request_id:id}),'Foreign request visibility check');
  prove(result===null,'Cross-owner or cross-tenant tracking returns no evidence');
 }
 await denied(resident.client.rpc('transition_service_request_sla',{p_input:{requestId:id,action:'accept',requirementsComplete:true,personalAppearanceReady:true}}),'Resident cannot start clock');
 await denied(foreign.client.rpc('transition_service_request_sla',{p_input:{requestId:id,action:'pause',reason:'Forged'}}),'Foreign staff cannot pause');
 await ok(admin.client.rpc('review_service_request',{p_input:{requestId:id,requirementsComplete:true,eligibility:'eligible',note:'Actual residency and requirements reviewed',personalAppearancePresent:true}}),'Complete review');
 await ok(admin.client.rpc('assess_service_request_fee',{p_input:{requestId:id,state:'waived',amountCentavos:0,basis:'Confirmed eligible first job seeker'}}),'Explicit eligibility waiver');
 await transition(id,'accept',{requirementsComplete:true,personalAppearanceReady:true});
 const concurrent=await Promise.all([admin.client.rpc('transition_service_request_sla',{p_input:{requestId:id,action:'pause',reason:'Resident supplying original'}}),admin.client.rpc('transition_service_request_sla',{p_input:{requestId:id,action:'pause',reason:'Concurrent resident wait'}})]);
 prove(concurrent.filter(r=>!r.error).length===1&&concurrent.filter(r=>r.error).length===1,'Concurrent pauses serialize: one interval only');
 const paused=await ok(resident.client.rpc('service_request_sla_tracking',{p_request_id:id}),'Read active pause and server timestamp');
 prove(paused.pauses.length===1&&paused.request.sla_state==='paused'&&!!paused.pauses[0].started_by,'Pause has actor, reason and server time');
 await denied(admin.client.rpc('transition_service_request_sla',{p_input:{requestId:id,action:'ready'}}),'Ready while paused rejected');
 const resume=await Promise.all([admin.client.rpc('transition_service_request_sla',{p_input:{requestId:id,action:'resume'}}),admin.client.rpc('transition_service_request_sla',{p_input:{requestId:id,action:'resume'}})]);
 prove(resume.filter(r=>!r.error).length===1&&resume.filter(r=>r.error).length===1,'Concurrent resumes: only one succeeds');
 await transition(id,'ready');await transition(id,'release');
 const cancelled=await submit();await transition(cancelled,'cancel',{reason:'Withdrawn before requirements complete'});
 const deterministic=await submit();
 await ok(admin.client.rpc('review_service_request',{p_input:{requestId:deterministic,requirementsComplete:true,eligibility:'eligible',note:'Deterministic fixture review',personalAppearancePresent:true}}),'Review deterministic request');
 await transition(deterministic,'accept',{requirementsComplete:true,personalAppearanceReady:true});
 sql(`begin;select set_config('barangayan.foundation_operation','sla',true); update public.service_requests set created_at='2026-01-01Z',accepted_at='2026-01-02Z' where id='${deterministic}';commit;`);
 const bundle=path.join(root,'dist/phase5-tools/shared.cjs');fs.mkdirSync(path.dirname(bundle),{recursive:true});
 require('esbuild').buildSync({entryPoints:[path.join(root,'packages/shared/src/index.ts')],bundle:true,platform:'node',format:'cjs',outfile:bundle});
 const {calculateAgencySla,summarizeAgencySla}=require(bundle);
 const cases=[];
 for(const seconds of [719.999,720,900,900.001,960]){
  const now=new Date(Date.UTC(2026,0,2)+seconds*1000);
  const snapshot=await ok(resident.client.rpc('service_request_sla_tracking',{p_request_id:deterministic}),'Read deterministic timing case');
  const db=await ok(resident.client.rpc('service_request_sla_metrics',{p_request_id:deterministic,p_at:now.toISOString()}),'Read database second-level result');
  const shared=calculateAgencySla(snapshot.request,snapshot.pauses,now);
  assert.deepEqual(db,shared);report.assertions.push('DB and shared agree at '+seconds+' seconds');cases.push({seconds,db,shared});
 }
 // Real evaluator concurrency and durable deduplication, delayed far beyond both thresholds.
 sql('select barangayan_private.evaluate_service_request_slas();');
 const results=await Promise.all([concurrentSql('select barangayan_private.evaluate_service_request_slas();'),concurrentSql('select barangayan_private.evaluate_service_request_slas();')]);
 prove(results.every(r=>r==='0'),'Repeated evaluator returns no duplicate events');
 const alerts=await ok(admin.client.from('service_request_sla_alerts').select('*').eq('request_id',deterministic),'Read durable staff alerts');
 prove(alerts.length===2&&new Set(alerts.map(a=>a.threshold)).size===2,'Exactly one alert per crossed threshold');
 for(const actor of [resident,foreign])prove((await ok(actor.client.from('service_request_sla_alerts').select('*').eq('request_id',deterministic),'Alert privacy check')).length===0,'Resident and foreign staff cannot read alert events');
 const dataset=await ok(admin.client.rpc('service_sla_report_rows'),'Read complete authorized report dataset');
 prove(dataset.requests.some(r=>r.id===deterministic)&&!dataset.requests.some(r=>r.barangay_id===other),'Report isolates tenant');
 const foreignReport=await ok(foreign.client.rpc('service_sla_report_rows'),'Foreign staff own report');prove(!foreignReport.requests.some(r=>r.id===id),'Foreign reports exclude protected requests');
 // Ready at exact target despite one minute resident wait; released much later.
 sql(`begin;select set_config('barangayan.foundation_operation','sla',true);
 insert into public.service_request_pauses(request_id,reason,started_by,started_at) values('${deterministic}','Resident original','${admin.id}','2026-01-02T00:05:00Z');
 update public.service_request_pauses set resumed_at='2026-01-02T00:06:00Z',resumed_by='${admin.id}' where request_id='${deterministic}';
 update public.service_requests set ready_at='2026-01-02T00:16:00Z',sla_state='ready',status='ready_for_pickup' where id='${deterministic}';commit;`);
 const finished=await ok(resident.client.rpc('service_request_sla_tracking',{p_request_id:deterministic}),'Ready clock fixture');
 const shared=calculateAgencySla(finished.request,finished.pauses,new Date('2026-01-03Z'));
 const database=await ok(resident.client.rpc('service_request_sla_metrics',{p_request_id:deterministic,p_at:'2026-01-03Z'}),'Ready clock DB result');assert.deepEqual(database,shared);report.assertions.push('Ready clock and waits agree across layers');
 const completedDataset=await ok(admin.client.rpc('service_sla_report_rows'),'Report sample by readiness');
 const summary=summarizeAgencySla(completedDataset.requests.filter(r=>r.resident_id===resident.id),new Date('2026-01-02Z'),new Date('2026-01-03Z'),new Date(completedDataset.evaluated_at));
 prove(summary.readyCount===1&&summary.averageProcessingSeconds===900&&summary.withinTargetPercent===100&&summary.averageResidentWaitSeconds===60,'Report includes prior-day submission completed in window and excludes cancelled sample');
 fs.writeFileSync(path.join(output,'timing-cases.json'),JSON.stringify({cases,ready:{database,shared},summary},null,2));
 // Leave reviewed running and pre-processing requests for browser/native transition checks.
 const uiPending=await submit(),uiRunning=await submit();
 await ok(admin.client.rpc('review_service_request',{p_input:{requestId:uiRunning,requirementsComplete:true,eligibility:'eligible',note:'Actual originals and eligibility checked',personalAppearancePresent:true}}),'Review UI timing request');
 await ok(admin.client.rpc('assess_service_request_fee',{p_input:{requestId:uiRunning,state:'waived',amountCentavos:0,basis:'Confirmed exemption'}}),'Waive UI request');
 await transition(uiRunning,'accept',{requirementsComplete:true,personalAppearanceReady:true});
 const fixtures={resident:{id:resident.id,email:resident.email,password:resident.password},admin:{id:admin.id,email:admin.email,password:admin.password},requests:{released:id,cancelled,ready:deterministic,pending:uiPending,running:uiRunning}};
 fs.writeFileSync(path.join(root,'dist/phase5-tools/ui-users.json'),JSON.stringify(fixtures,null,2));
 report.passed=true;
}
main().catch(error=>{report.error=error.message;process.exitCode=1;console.error(error.message);}).finally(()=>{fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,assertions:report.assertions.length,evidence:path.relative(root,output)}));});
