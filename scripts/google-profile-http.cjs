/* global __dirname */
// Actual Auth/REST/RPC tests; synthetic fixtures on the verified WSL local stack.
// A SQL-created Google identity exercises profile provisioning, not Google consent.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync,spawn}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js'),{parse}=require('yaml');
const root=path.resolve(__dirname,'..'),output=path.join(root,'plans/evidence/phase6/google-minimal-http');
fs.mkdirSync(output,{recursive:true});
function local(args,input) {
 const r=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec',...args],{input,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
 assert.equal(r.status,0,'Local test command failed');return r.stdout;
}
function sql(source) {return local(['docker','exec','-i','supabase_db_barangayan','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],source);}
const ports=JSON.parse(local(['docker','inspect','--format','{{json .NetworkSettings.Ports}}','supabase_kong_barangayan']));
assert.ok(ports['8000/tcp'].every(port=>port.HostPort==='54321'),'Expected local API test port');
assert.ok(Number(sql("select count(*) from auth.users where email like '%@test.local'").trim())>0,'Expected synthetic fixtures');
const host=local(['hostname','-I']).trim().split(/\s+/)[0];
assert.match(host,/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,'Only the private WSL test host is permitted');
// Read keys only from the verified LOCAL gateway; never print or record them in evidence.
// CLI status is unavailable while Docker's stale health state says "starting".
const env=JSON.parse(local(['docker','inspect','--format','{{json .Config.Env}}','supabase_kong_barangayan']));
const configPath=env.find(value=>value.startsWith('KONG_DECLARATIVE_CONFIG='))?.slice('KONG_DECLARATIVE_CONFIG='.length);
assert.ok(configPath?.startsWith('/'),'Expected local gateway configuration path');
const gateway=parse(local(['docker','exec','supabase_kong_barangayan','cat',configPath]));
if(process.argv[2]==='gateway-shape') {
 console.log(JSON.stringify({keys:Object.keys(gateway),plugins:gateway.plugins?.map(plugin=>({name:plugin.name,configKeys:Object.keys(plugin.config??{})})),services:gateway.services?.map(service=>({name:service.name,plugins:service.plugins?.map(plugin=>({name:plugin.name,configKeys:Object.keys(plugin.config??{})}))}))},null,2));
 process.exit(0);
}
// This CLI's gateway uses request-transformer mappings rather than consumers.
// Decode only the public role claim to select its already-configured test key.
const configuredTokens=[...JSON.stringify(gateway).matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map(match=>match[0]);
const key=role=>configuredTokens.find(token=>JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).role===role);
const anonKey=key('anon'),serviceKey=key('service_role');assert.ok(anonKey&&serviceKey,'Expected local gateway credentials');
const api=`http://${host}:54321`;
const make=keyValue=>createClient(api,keyValue,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:init?.signal??AbortSignal.timeout(15000)})}});
const trusted=make(serviceKey),resident=make(anonKey),other=make(anonKey),anon=make(anonKey);
const fixturePath=path.join(root,'dist/phase6-tools/google-minimal-users.json');
if(process.argv[2]==='web') {
 const envPreview={...process.env,NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_ANON_KEY:anonKey,BARANGAYAN_PREVIEW_DIST_DIR:'.next-google-minimal',NEXT_TELEMETRY_DISABLED:'1'};
 const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3107'],{cwd:path.join(root,'apps/resident-web'),env:envPreview,stdio:'inherit'});
 child.on('exit',code=>{process.exitCode=code;});
} else {
 const report={passed:false,assertions:[]};
 const prove=(value,label)=>{assert.ok(value,label);report.assertions.push(label);};
 async function ok(operation,label) {const r=await operation;assert.ifError(r.error);report.assertions.push(label);return r.data;}
 async function denied(operation,label) {const r=await operation;prove(!!r.error,label);}
 const created=[];let driveId,reportId;
 async function cleanup() {
  const saved=process.argv[2]==='cleanup'?JSON.parse(fs.readFileSync(fixturePath,'utf8')):null;
  const ids=saved?.ids??created,drive=saved?.driveId??driveId,incident=saved?.reportId??reportId;
  if(incident) await ok(trusted.from('incidents').delete().eq('id',incident),'Remove task report fixture');
  if(drive) await ok(trusted.from('drive_registrations').delete().eq('drive_id',drive),'Remove task health fixture registrations');
  if(drive) await ok(trusted.from('medical_drives').delete().eq('id',drive),'Remove task health fixture');
  for(const id of ids) await ok(trusted.auth.admin.deleteUser(id),'Remove task Auth user and cascaded profile');
 }
 async function main() {
  if(process.argv[2]==='cleanup') {await cleanup();report.passed=true;return;}
  const locality=await ok(anon.from('barangay_localities').select('*').eq('resident_registration_enabled',true).single(),'Read sole configured test registration locality');
  const password='GoogleProfileLocalOnly!2026';
  const email=`google-minimal-${randomUUID()}@test.local`;
  const {user}=await ok(trusted.auth.admin.createUser({email,password,email_confirm:true}),'Create synthetic Auth user');created.push(user.id);
  prove(JSON.parse(sql(`select coalesce(jsonb_agg(id),'[]') from public.profiles where id='${user.id}'`)).length===0,'Profile absent before Google identity insert');
  sql(`insert into auth.identities(user_id,provider_id,provider,identity_data,created_at,updated_at,last_sign_in_at) values ('${user.id}','${randomUUID()}','google','{"given_name":"Google","family_name":"Resident","email":"forged@test.local"}',now(),now(),now());`);
  await ok(resident.auth.signInWithPassword({email,password}),'Authenticate synthetic user through actual Auth API');
  const auth=await ok(resident.auth.getUser(),'Auth returns linked identity');prove(auth.user.identities.some(identity=>identity.provider==='google'),'Real Auth response exposes Google identity');
  let profile=await ok(resident.from('profiles').select('*').eq('id',user.id).single(),'Read immediate minimal profile through own-session REST');
  prove(profile.first_name==='Google'&&profile.last_name==='Resident'&&profile.email===email,'Available names and Auth email persisted');
  prove(profile.role==='resident'&&profile.barangay_id===locality.barangay_id,'Role and tenant server assigned');
  prove(profile.profile_completed_at===null&&profile.house_no===null&&profile.approved_id_submission_id===null,'Minimal profile remains incomplete and unverified');
  const guidance=await ok(resident.from('document_types').select('id,barangay_id').eq('is_active',true),'Incomplete account can read document guidance');
  prove(guidance.length>0&&guidance.every(row=>row.barangay_id===locality.barangay_id),'Guidance remains tenant isolated');
  const drive=await ok(trusted.from('medical_drives').insert({barangay_id:locality.barangay_id,title:`Google test ${randomUUID()}`,type:'vaccination',drive_date:'2099-01-01',time_start:'08:00',time_end:'12:00',eligible_criteria:'All',stock_total:10,stock_remaining:10}).select('id').single(),'Prepare task health fixture');driveId=drive.id;
  await denied(resident.from('incidents').insert({barangay_id:locality.barangay_id,reporter_id:user.id,title:'Incomplete',location:{lat:1,lng:1}}),'Direct report submission denied before completion');
  await denied(resident.from('drive_registrations').insert({drive_id:drive.id,user_id:user.id,applicant_number:'GOOGLE',age:26}),'Direct health registration denied before completion');
  await denied(resident.rpc('register_for_drive',{p_drive_id:drive.id,p_age:26,p_is_pwd:false,p_comorbidities:[]}), 'Health registration RPC denied before completion');
  await denied(resident.from('service_requests').insert({barangay_id:locality.barangay_id,resident_id:user.id,document_type_id:guidance[0].id}),'Direct document request denied before completion');
  await denied(anon.rpc('ensure_google_resident_profile'),'Anonymous provisioning denied');
  await denied(resident.rpc('ensure_google_resident_profile',{p_uid:randomUUID(),role:'admin',barangay_id:randomUUID()}),'RPC refuses caller identity/role/tenant payload');
  // Recreate an earlier orphan and race retries against full completion.
  sql(`delete from public.profiles where id='${user.id}';`);
  const input={firstName:'Confirmed',lastName:'Resident',houseNo:'12',street:'Main',sex:'female',employmentStatus:'student',mobileNumber:'09171234567',birthDate:'2000-01-01'};
  const results=await Promise.all([...Array.from({length:8},()=>resident.rpc('ensure_google_resident_profile')),resident.rpc('complete_resident_profile',{p_input:input})]);
  prove(results.every(r=>!r.error&&r.data===user.id),'Concurrent bootstrap retries and completion succeed for same identity');
  prove(JSON.parse(sql(`select count(*) from public.profiles where id='${user.id}'`))===1,'Concurrency creates exactly one profile');
  profile=await ok(resident.from('profiles').select('*').eq('id',user.id).single(),'Read concurrently completed resident');
  prove(profile.first_name==='Confirmed'&&profile.house_no==='12'&&profile.profile_completed_at!==null,'Bootstrap cannot overwrite concurrent completion');
  const initial=JSON.stringify(profile);
  await ok(resident.rpc('ensure_google_resident_profile'),'Repeat sign-in provisioning');
  prove(JSON.stringify(await ok(resident.from('profiles').select('*').eq('id',user.id).single(),'Read existing completed row'))===initial,'Repeat provisioning preserves every saved profile field');
  const incident=await ok(resident.from('incidents').insert({barangay_id:locality.barangay_id,reporter_id:user.id,title:'Google completed report',location:{lat:1,lng:1}}).select('id').single(),'Completed resident may submit report');reportId=incident.id;
  await ok(resident.rpc('register_for_drive',{p_drive_id:drive.id,p_age:26,p_is_pwd:false,p_comorbidities:[]}), 'Completed resident may register through health RPC');
  prove(profile.approved_id_submission_id===null,'Completing resident details did not approve ID');
  const secondEmail=`google-profile-other-${randomUUID()}@test.local`;
  const second=await ok(trusted.auth.admin.createUser({email:secondEmail,password,email_confirm:true,user_metadata:{provider:'google',providers:['google']}}),'Prepare non-Google metadata-forgery fixture');created.push(second.user.id);
  await ok(other.auth.signInWithPassword({email:secondEmail,password}),'Authenticate separate synthetic account');
  await denied(other.rpc('ensure_google_resident_profile'),'Editable Google provider claim cannot provision profile');
  prove((await ok(other.from('profiles').select('id').eq('id',user.id),'Attempt cross-account profile read')).length===0,'Cross-account profile access remains denied');
  // Leave only the explicitly recorded fixture for browser checks, then cleanup.
  sql(`insert into auth.identities(user_id,provider_id,provider,identity_data,created_at,updated_at,last_sign_in_at) values ('${second.user.id}','${randomUUID()}','google','{"name":"Browser Resident"}',now(),now(),now());`);
  fs.mkdirSync(path.dirname(fixturePath),{recursive:true});
  fs.writeFileSync(fixturePath,JSON.stringify({ids:created,driveId,reportId,complete:{id:user.id,email,password},incomplete:{id:second.user.id,email:secondEmail,password}},null,2));
  report.passed=true;console.log(`PASS: ${report.assertions.length} actual Auth/REST/RPC assertions; Google provider consent not simulated.`);
 }
 main().catch(async error=>{report.error=error.message;console.error(error.message);process.exitCode=1;await cleanup().catch(()=>{});})
 .finally(()=>fs.writeFileSync(path.join(output,process.argv[2]==='cleanup'?'cleanup.json':'results.json'),JSON.stringify(report,null,2)));
}
