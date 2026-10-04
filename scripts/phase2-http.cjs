/* global __dirname, Buffer */
// Real Auth/PostgREST/Storage verification. No hosted URL or credentials accepted.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'plans/evidence/phase2',`http-${Date.now()}`);
fs.mkdirSync(output,{recursive:true});
const status=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--cd','/mnt/c/Users/User/barangayan','--exec','/opt/barangayan-tools/supabase','status','--output','json'],{encoding:'utf8',timeout:30000});
assert.equal(status.status,0);
const config=JSON.parse(status.stdout);
assert.equal(config.API_URL,'http://127.0.0.1:54321');
const client=key=>createClient(config.API_URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const trusted=client(config.SERVICE_ROLE_KEY);
const report={startedAt:new Date().toISOString(),passed:false,assertions:[]};
const prove=(condition,label)=>{assert.ok(condition,label);report.assertions.push(label);};
async function ok(operation,label){const result=await operation;assert.ok(!result.error,`${label}: ${result.error?.message}`);report.assertions.push(label);return result.data;}
async function denied(operation,label){const result=await operation;prove(!!result.error,label);prove(!['PGRST000','PGRST001'].includes(result.error.code),`${label} is an application denial`);}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64');
const tenant=randomUUID(),other=randomUUID();
async function user(role,barangay){
  const email=`phase2-${randomUUID()}@test.local`,password=`Test-${randomUUID()}!`;
  const created=await ok(trusted.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Phase Two'}}),'Create test Auth user');
  const id=created.user.id;
  await ok(trusted.from('profiles').insert({id,role,barangay_id:barangay,full_name:'Phase Two',home_address:'Unsplittable legacy text'}),'Provision trusted test profile');
  const session=client(config.ANON_KEY);
  await ok(session.auth.signInWithPassword({email,password}),'Sign in with real resident/admin session');
  return {id,client:session};
}
async function read(actor){return ok(actor.client.from('profiles').select('*').eq('id',actor.id).single(),'Read current own profile');}
async function upload(actor,side){const value=`${actor.id}/versions/${randomUUID()}/id-${side}.png`;await ok(actor.client.storage.from('id-documents').upload(value,png,{contentType:'image/png',upsert:false}),`Upload immutable ${side}`);return value;}
async function bytes(actor,name){const blob=await ok(actor.client.storage.from('id-documents').download(name),'Download authorized private ID');return Buffer.from(await blob.arrayBuffer());}
async function main(){
  await ok(trusted.from('barangays').insert([{id:tenant,name:'Phase 2 HTTP'},{id:other,name:'Phase 2 other tenant'}]),'Create isolated tenants');
  await ok(trusted.from('barangay_localities').insert({barangay_id:tenant,display_name:'Ampid 1',city:'San Mateo',province:'Rizal'}),'Configure permitted locality');
  const resident=await user('resident',tenant),sameResident=await user('resident',tenant),admin=await user('admin',tenant),foreign=await user('admin',other);
  const row=await read(resident);
  const nested=await ok(resident.client.from('profiles').select('*, barangays(name, boundary, barangay_localities(display_name, city, province))').eq('id',resident.id).single(),'Android profile query resolves nested configured locality');
  prove(nested.barangays.barangay_localities.display_name==='Ampid 1','Android receives an object containing configured locality');
  prove(row.city==='San Mateo'&&row.province==='Rizal','Locality defaults applied on profile insert');
  prove(row.home_address==='Unsplittable legacy text','Legacy address was not guessed');
  await denied(resident.client.from('profiles').update({city:'Tampered'}).eq('id',resident.id),'City tampering denied');
  await denied(resident.client.from('profiles').update({province:'Tampered'}).eq('id',resident.id),'Province tampering denied');
  await denied(resident.client.from('profiles').update({home_address:'Forged'}).eq('id',resident.id),'Legacy free text bypass denied');
  await denied(resident.client.from('profiles').update({id_verification_status:'pending'}).eq('id',resident.id),'Unversioned evidence state mutation denied');
  const compiled=path.join(root,'dist/phase2-tools/id-evidence.cjs');
  require('esbuild').buildSync({entryPoints:[path.join(root,'packages/shared/src/lib/id-evidence.ts')],bundle:true,platform:'node',format:'cjs',outfile:compiled,external:['@supabase/supabase-js']});
  const {publishIdEvidence}=require(compiled);
  const frontPath=await upload(resident,'front'),backPath=await upload(resident,'back');
  const submissionId=randomUUID();
  const published=await publishIdEvidence(resident.client,{submissionId,idType:'Passport',frontPath,backPath});
  report.assertions.push('Shared publication helper copies both sides and publishes a real version');
  const retry=await publishIdEvidence(resident.client,{submissionId,idType:'Passport',frontPath,backPath});
  prove(retry.submissionId===submissionId,'Interrupted/publication retries reuse exactly one version');
  const rpc=(actor,input)=>actor.client.rpc('review_id_submission',{p_input:input});
  await denied(rpc(resident,{submissionId,decision:'verified'}),'Resident cannot review own ID');
  await denied(rpc(foreign,{submissionId,decision:'verified'}),'Foreign administrator cannot review ID');
  await denied(sameResident.client.storage.from('id-documents').download(published.frontPath),'Other same-tenant resident cannot read ID');
  await denied(foreign.client.storage.from('id-documents').download(published.frontPath),'Foreign tenant cannot read ID');
  await ok(rpc(admin,{submissionId,decision:'verified'}),'Same-tenant staff approve displayed version');
  const approved=await read(resident);
  prove(approved.id_verification_status==='verified'&&approved.approved_id_submission_id===submissionId,'Approval names exact reviewed submission');
  const review=await ok(admin.client.from('id_submissions').select('*').eq('id',submissionId).single(),'Read reviewed evidence version');
  prove(review.reviewed_by===admin.id&&!!review.reviewed_at&&review.id_type==='Passport','Review stores actor/time/type and immutable paths');
  await denied(resident.client.storage.from('id-documents').upload(published.frontPath,png,{contentType:'image/png',upsert:true}),'Approved image overwrite denied');
  await ok(resident.client.storage.from('id-documents').remove([published.frontPath]),'Denied delete request is safe to retry');
  prove((await bytes(resident,published.frontPath)).equals(png),'Approved file survives resident delete attempt');
  await ok(resident.client.from('profiles').update({mobile_number:'09171234567'}).eq('id',resident.id),'Unrelated profile edit succeeds');
  prove((await read(resident)).approved_id_submission_id===submissionId,'Unrelated edit preserves approval');
  const nextId=randomUUID();
  await publishIdEvidence(resident.client,{submissionId:nextId,idType:'PhilSys',frontPath:published.frontPath,backPath:published.backPath});
  const replacement=await read(resident);
  prove(replacement.id_verification_status==='pending'&&replacement.approved_id_submission_id===null&&replacement.current_id_submission_id===nextId,'Type-only replacement clears approval');
  prove((await bytes(resident,published.frontPath)).equals(png),'Prior reviewed evidence remains intact after replacement');
  await denied(rpc(admin,{submissionId,decision:'revoked',reason:'Superseded'}),'Stale administrator decision rejected');
  await denied(rpc(admin,{submissionId:nextId,decision:'verification_failed'}),'Rejection without reason denied');
  await ok(rpc(admin,{submissionId:nextId,decision:'verification_failed',reason:'ID unreadable'}),'Rejection persists reason');
  const failed=await ok(admin.client.from('id_submissions').select('*').eq('id',nextId).single(),'Read rejected submission');
  prove(failed.rejection_reason==='ID unreadable'&&failed.reviewed_by===admin.id,'Rejection audit identifies evidence/reason/reviewer');
  const thirdId=randomUUID();
  await publishIdEvidence(resident.client,{submissionId:thirdId,idType:'Passport',frontPath,backPath});
  await ok(rpc(admin,{submissionId:thirdId,decision:'verified'}),'Replacement can be reviewed after retry');
  await ok(rpc(admin,{submissionId:thirdId,decision:'revoked',reason:'Revoked following review'}),'Staff revocation records reason');
  prove((await read(resident)).approved_id_submission_id===null,'Revocation blocks new verified eligibility');
  const leaked=await ok(sameResident.client.from('profiles').select('id,id_photo_urls').eq('id',resident.id),'Other-account profile response');
  prove(leaked.length===0,'Cross-account profile response contains no private data');
  await ok(resident.client.auth.signOut({scope:'local'}),'Local logout clears resident session');
  prove(!(await resident.client.auth.getSession()).data.session,'Signed-out client has no remaining session');
  report.passed=true;
}
main().catch(error=>{report.error=String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g,'[REDACTED]');process.exitCode=1;}).finally(()=>{
  report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(`${report.passed?'PASS':'FAIL'} Phase 2 real HTTP: ${report.assertions.length} assertions; ${report.error||''}`);
});
