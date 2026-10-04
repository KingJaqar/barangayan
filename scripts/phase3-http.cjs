/* global __dirname, Buffer */
// Local Auth/Storage/PostgREST only; no hosted credentials or production data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),{spawnSync}=require('node:child_process'),{createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'..'),output=path.join(root,'plans/evidence/phase3',`http-${Date.now()}`);
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
  const email=`phase3-${role}-${randomUUID()}@test.local`,password='PhaseLocalOnly!2026';
  const auth=await ok(trusted.auth.admin.createUser({email,password,email_confirm:true}),'Create synthetic '+role);
  const id=auth.user.id;
  await ok(trusted.from('profiles').insert({id,barangay_id,role,full_name:'Phase Three '+role,first_name:'Phase',last_name:'Three',house_no:'12',street:'Main Street',sex:'female',employment_status:'student',birth_date:'2000-01-01',mobile_number:'09171234567',email}),'Provision synthetic profile');
  const client=make(config.ANON_KEY);await ok(client.auth.signInWithPassword({email,password}),'Real '+role+' session');
  return {id,email,password,client};
}
async function main(){
  const catalogs=await ok(trusted.from('document_types').select('*').eq('barangay_id',tenant).eq('is_active',true),'Read activated pilot catalog');
  prove(catalogs.length===4,'Exactly four published services');
  for(const d of catalogs){prove(d.contract_version===2&&d.processing_target_minutes===15&&Object.keys(d.charter).length===11,d.name+' has eleven categories and fifteen-minute target');}
  prove(catalogs.find(d=>d.service_kind==='certified_true_copy').charter.personResponsible===null,'CTC personnel explicitly missing');
  const resident=await user('resident',tenant),admin=await user('admin',tenant);
  const other=randomUUID();await ok(trusted.from('barangays').insert({id:other,name:'HTTP foreign tenant'}),'Isolated foreign tenant');
  const foreign=await user('admin',other);
  const version=randomUUID(),frontPath=`${resident.id}/versions/${version}/id-front.png`,backPath=`${resident.id}/versions/${version}/id-back.png`;
  for(const name of [frontPath,backPath])await ok(resident.client.storage.from('id-documents').upload(name,png,{contentType:'image/png',upsert:false}),'Upload identity evidence');
  await ok(resident.client.rpc('publish_id_submission',{p_input:{submissionId:version,idType:'Passport',frontPath,backPath}}),'Publish ID');
  await ok(admin.client.rpc('review_id_submission',{p_input:{submissionId:version,decision:'verified'}}),'Staff approve ID');
  const attachmentPath=`${resident.id}/${randomUUID()}/dti.png`;
  await ok(resident.client.storage.from('request-attachments').upload(attachmentPath,png,{contentType:'image/png',upsert:false}),'Upload real private supporting evidence');
  const paymentBundle=path.join(root,'dist/phase3-tools/payments.cjs');fs.mkdirSync(path.dirname(paymentBundle),{recursive:true});
  require('esbuild').buildSync({entryPoints:[path.join(root,'apps/admin-web/src/lib/payments.ts')],bundle:true,platform:'node',format:'cjs',outfile:paymentBundle,alias:{'@barangayan/shared':path.join(root,'packages/shared/src/index.ts')}});
  const {markPaymentCollected}=require(paymentBundle),ui=[];
  for(const d of catalogs){
    const payload={documentTypeId:d.id,idempotencyKey:randomUUID(),purposeCode:d.purposes[0].code,details:{personalAppearanceAcknowledged:true},attachments:[]};
    if(d.service_kind==='business'){Object.assign(payload.details,{businessName:'Local Test Shop',establishmentAddress:'12 Main Street'});payload.attachments=[{requirementCode:'dti',path:attachmentPath,mimeType:'image/png',sizeBytes:png.length}];}
    if(d.service_kind==='certified_true_copy')Object.assign(payload.details,{recordReference:'Barangay record 12',copies:3});
    if(['indigency','first_time_job_seeker'].includes(d.service_kind))payload.details.isRenter=false;
    const requestId=await ok(resident.client.rpc('submit_service_request',{p_input:payload}),d.name+' real submission');
    const review={requestId,requirementsComplete:true,eligibility:'eligible',note:'Supporting documents, residency and eligibility checked',personalAppearancePresent:true};
    await denied(resident.client.rpc('review_service_request',{p_input:review}),'Resident review denied');
    await denied(foreign.client.rpc('review_service_request',{p_input:review}),'Foreign review denied');
    await denied(admin.client.rpc('transition_service_request_sla',{p_input:{requestId,action:'accept',requirementsComplete:true,personalAppearanceReady:true}}),'Unreviewed acceptance denied');
    await ok(admin.client.rpc('review_service_request',{p_input:{...review,eligibility:'pending'}}),'Requirements do not imply eligibility');
    await denied(admin.client.rpc('transition_service_request_sla',{p_input:{requestId,action:'accept',requirementsComplete:true,personalAppearanceReady:true}}),'Unconfirmed eligibility denied');
    await ok(admin.client.rpc('review_service_request',{p_input:review}),'Staff audit decisions recorded');
    const waived=d.service_kind==='first_time_job_seeker';
    const assessment={requestId,state:waived?'waived':'assessed',amountCentavos:waived?0:4000,basis:waived?'Confirmed eligible first-time-job-seeker exemption':'Applicable fee confirmed',...(d.pricing_mode==='per_page'?{billablePages:4}:{})};
    await ok(admin.client.rpc('assess_service_request_fee',{p_input:assessment}),'Staff fee/exemption assessment');
    const row=await ok(admin.client.from('service_requests').select('*').eq('id',requestId).single(),'Read audited request');
    prove(row.requirements_reviewed_by===admin.id&&!!row.requirements_reviewed_at&&row.personal_appearance_recorded_by===admin.id&&row.fee_assessed_by===admin.id,'Actor/time evidence persists for '+d.service_kind);
    await ok(admin.client.rpc('transition_service_request_sla',{p_input:{requestId,action:'accept',requirementsComplete:true,personalAppearanceReady:true}}),'Accept reviewed request');
    await ok(admin.client.rpc('transition_service_request_sla',{p_input:{requestId,action:'ready'}}),'Mark actual document readiness');
    if(!waived){
      await denied(admin.client.rpc('transition_service_request_sla',{p_input:{requestId,action:'release'}}),'Unpaid release denied');
      await ok(resident.client.rpc('set_service_request_payment_method',{p_request_id:requestId,p_method:'pickup'}),'Resident selects pickup through authorized operation');
      const payment=await markPaymentCollected(admin.client,requestId);assert.equal(payment.error,null);report.assertions.push('Actual administrator pickup adapter uses request amount');
      const retry=await markPaymentCollected(admin.client,requestId);prove(!retry.error&&retry.paymentId===payment.paymentId,'Collection retry is idempotent');
      await denied(admin.client.rpc('assess_service_request_fee',{p_input:{...assessment,amountCentavos:5000}}),'Assessment freezes after payment');
    }
    await ok(admin.client.rpc('transition_service_request_sla',{p_input:{requestId,action:'release'}}),'Confirmed payment or waiver permits release');
    if(d.service_kind==='business'){
      const nextPath=`${resident.id}/${randomUUID()}/dti.png`;
      await ok(resident.client.storage.from('request-attachments').upload(nextPath,png,{contentType:'image/png',upsert:false}),'Separate request uses separate immutable attachment');
      payload.attachments=[{...payload.attachments[0],path:nextPath}];
    }
    const nextId=await ok(resident.client.rpc('submit_service_request',{p_input:{...payload,idempotencyKey:randomUUID()}}),'Prepare pending browser review');
    ui.push({id:nextId,kind:d.service_kind,name:d.name});
  }
  await denied(foreign.client.from('document_types').update({description:'Forged'}).eq('id',catalogs[0].id).select('id').single(),'Foreign catalog edits denied');
  const files=await ok(admin.client.from('request_attachments').select('*').eq('resident_id',resident.id),'Authorized staff read supporting files');
  const signed=await ok(admin.client.storage.from('request-attachments').createSignedUrl(files[0].object_path,600),'Staff sign submitted private file');
  prove((await fetch(signed.signedUrl)).ok,'Signed private attachment opens');
  const {client:ignoredResident,...residentFixture}=resident;const {client:ignoredAdmin,...adminFixture}=admin;void ignoredResident;void ignoredAdmin;
  fs.writeFileSync(path.join(root,'dist/phase3-tools/ui-users.json'),JSON.stringify({resident:residentFixture,admin:adminFixture,requests:ui},null,2));
  report.passed=true;
}
main().catch(error=>{report.error=error.message;process.exitCode=1;console.error(error.message);}).finally(()=>{fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,assertions:report.assertions.length,evidence:path.relative(root,output)}));});
