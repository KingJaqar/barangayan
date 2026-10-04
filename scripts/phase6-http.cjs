/* global __dirname */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'..');
const r=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--cd','/mnt/c/Users/User/barangayan','--exec','/opt/barangayan-tools/supabase','status','--output','json'],{encoding:'utf8',timeout:30000});
assert.equal(r.status,0);const config=JSON.parse(r.stdout);assert.equal(config.API_URL,'http://127.0.0.1:54321');
const host=process.env.BARANGAYAN_LOCAL_TEST_HOST;
if(host&&!/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host))throw Error('Only the private WSL test host is permitted');
const api=host?`http://${host}:54321`:config.API_URL;
const make=(key,pkce=false)=>createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false,flowType:pkce?'pkce':'implicit'},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)})}});
const trusted=make(config.SERVICE_ROLE_KEY),resident=make(config.ANON_KEY),anon=make(config.ANON_KEY);
const output=path.join(root,process.argv.includes('flexible')?'plans/evidence/phase6/http-flexible':'plans/evidence/phase6/http');fs.mkdirSync(output,{recursive:true});
const report={passed:false,assertions:[]};
const prove=(condition,label)=>{assert.ok(condition,label);report.assertions.push(label);};
async function ok(operation,label){const result=await operation;assert.ifError(result.error);report.assertions.push(label);return result.data;}
async function denied(operation,label){const result=await operation;prove(!!result.error,label);}
async function main(){
 const locality=await ok(anon.from('barangay_localities').select('*').eq('resident_registration_enabled',true).single(),'Anonymous registration can read configured locality');
 const email=`phase6-password-${randomUUID()}@test.local`,password='PhaseLocalOnly!2026';
 const metadata={first_name:'Password',last_name:'Resident',house_no:'12',street:'Main',sex:'female',employment_status:'student',mobile_number:'09171234567',birth_date:'2000-01-01',barangay_id:locality.barangay_id,role:'admin',location_verified:true,registration_gps:{lat:0,lng:0},registration_home:{lat:0,lng:1}};
 const signup=await ok(resident.auth.signUp({email,password,options:{data:metadata}}),'Real password registration');
 prove(!!signup.session,'Password registration establishes session in configured local environment');
 let profile=await ok(resident.from('profiles').select('*').eq('id',signup.user.id).single(),'Password profile readable');
 prove(profile.role==='resident'&&profile.city==='San Mateo'&&profile.province==='Rizal','Role injection ignored and fixed address applied');
 prove(profile.location_verified===false&&profile.registration_home_location.lng===1&&profile.registration_location.lng===0,'Outside advisory stored independently and client verification ignored');
 await ok(resident.auth.signOut({scope:'local'}),'Password session logout');
 await denied(resident.auth.signInWithPassword({email,password:'incorrect'}),'Wrong password denied');
 await ok(resident.auth.signInWithPassword({email,password}),'Existing password login');
 const auth=await ok(trusted.auth.admin.createUser({email:`phase6-incomplete-${randomUUID()}@test.local`,password,email_confirm:true,user_metadata:{full_name:'Provider Name',role:'admin'}}),'Create synthetic metadata-free identity (not a Google provider login)');
 const incomplete=make(config.ANON_KEY);
 await ok(incomplete.auth.signInWithPassword({email:auth.user.email,password}),'Authenticate incomplete identity');
 const absent=await ok(incomplete.from('profiles').select('id').eq('id',auth.user.id),'Read incomplete profile state');prove(absent.length===0,'No invented profile created from provider name alone');
 if(process.argv.includes('flexible')) {
  const guidance=await ok(incomplete.from('document_types').select('id,barangay_id').eq('is_active',true),'Incomplete account can browse active document guidance');
  prove(guidance.length>0&&guidance.every(row=>row.barangay_id===locality.barangay_id),'Missing-profile guidance is tenant scoped');
  await ok(incomplete.from('announcements').select('id'),'Incomplete account can browse announcements');
  const drive=await ok(trusted.from('medical_drives').insert({barangay_id:locality.barangay_id,title:`Phase6 deferred ${randomUUID()}`,type:'vaccination',drive_date:'2099-01-01',time_start:'08:00',time_end:'12:00',eligible_criteria:'Synthetic local fixture',stock_total:10,stock_remaining:10}).select('id').single(),'Prepare synthetic health drive');
  await denied(incomplete.from('incidents').insert({barangay_id:locality.barangay_id,reporter_id:auth.user.id,title:'Blocked incomplete report',location:{lat:1,lng:1}}),'Real REST report bypass denied before completion');
  await denied(incomplete.rpc('register_for_drive',{p_drive_id:drive.id,p_age:26,p_is_pwd:false,p_comorbidities:[]}), 'Real health RPC denied before completion');
  await denied(incomplete.from('service_requests').insert({barangay_id:locality.barangay_id,resident_id:auth.user.id,document_type_id:guidance[0].id}), 'Real REST document request denied before completion');
  report.testDriveId=drive.id;
 }
 const input={firstName:'Provider',lastName:'Resident',houseNo:'15',street:'Main',sex:'female',employmentStatus:'student',mobileNumber:'09171234567',birthDate:'2000-01-01',location:{gps:null,home:null}};
 await denied(anon.rpc('complete_resident_profile',{p_input:input}),'Anonymous completion denied');
 await denied(incomplete.rpc('complete_resident_profile',{p_input:{...input,id:signup.user.id}}),'Forged completion identity denied');
 await denied(incomplete.rpc('complete_resident_profile',{p_input:{...input,barangayId:randomUUID()}}),'Forged tenant denied');
 const ids=await Promise.all([ok(incomplete.rpc('complete_resident_profile',{p_input:input}),'Concurrent completion A'),ok(incomplete.rpc('complete_resident_profile',{p_input:input}),'Concurrent completion B')]);
 prove(ids.every(id=>id===auth.user.id),'Concurrent completion returns same authenticated identity');
 profile=await ok(incomplete.from('profiles').select('*').eq('id',auth.user.id).single(),'Reload completed profile');
 prove(profile.role==='resident'&&profile.barangay_id===locality.barangay_id&&!!profile.profile_completed_at,'Completion server assigns resident tenant and timestamp');
 prove(profile.id_verification_status!=='verified'&&profile.approved_id_submission_id===null,'Authentication does not approve valid ID');
 if(report.testDriveId) {
  await ok(incomplete.rpc('register_for_drive',{p_drive_id:report.testDriveId,p_age:26,p_is_pwd:false,p_comorbidities:[]}), 'Real health RPC succeeds after completion');
  await ok(incomplete.from('incidents').insert({barangay_id:locality.barangay_id,reporter_id:auth.user.id,title:'Phase6 completed report',location:{lat:1,lng:1}}),'Real report submission succeeds after completion');
 }
 const cross=await ok(incomplete.from('profiles').update({street:'Forged'}).eq('id',signup.user.id).select('id'),'Attempt cross-account profile write');prove(cross.length===0,'Cross-account writes affect no rows');
 await denied(incomplete.from('profiles').update({verified_location:{lat:0,lng:0}}).eq('id',auth.user.id),'Settings outside GPS bypass denied over real REST');
 await denied(incomplete.from('profiles').update({registration_home_location:{lat:1,lng:1}}).eq('id',auth.user.id),'Raw registration result override denied over real REST');
 const pkce=make(config.ANON_KEY,true);await denied(pkce.auth.exchangeCodeForSession('expired-replayed-code'),'Expired/replayed callback fails real Auth code exchange');
 const oauth=await ok(pkce.auth.signInWithOAuth({provider:'google',options:{redirectTo:'barangayan://auth/callback',skipBrowserRedirect:true}}),'Construct Google provider API URL');
 const oauthURL=new URL(oauth.url);prove(oauthURL.searchParams.get('provider')==='google'&&oauthURL.searchParams.get('redirect_to')==='barangayan://auth/callback','Google provider and exact Android redirect forwarded');
 prove(!!oauthURL.searchParams.get('code_challenge')&&oauthURL.searchParams.get('code_challenge_method')==='s256','Google API constructs a PKCE S256 challenge');
 // A new identity remains incomplete for browser/native completion checks.
 const fresh=await ok(trusted.auth.admin.createUser({email:`phase6-ui-${randomUUID()}@test.local`,password,email_confirm:true,user_metadata:{given_name:'Browser',family_name:'Resident',full_name:'Browser Resident'}}),'Prepare incomplete local UI fixture');
 const fixtures={complete:{id:auth.user.id,email:auth.user.email,password},incomplete:{id:fresh.user.id,email:fresh.user.email,password},browserRegistration:{email:`phase6-browser-${randomUUID()}@test.local`,password},tenant:locality.barangay_id};
 fs.mkdirSync(path.join(root,'dist/phase6-tools'),{recursive:true});fs.writeFileSync(path.join(root,'dist/phase6-tools/ui-users.json'),JSON.stringify(fixtures,null,2));
 report.passed=true;console.log(`PASS: ${report.assertions.length} actual local Auth/REST assertions; Google provider success not simulated or claimed.`);
}
main().catch(error=>{report.error=error.message;console.error(error.message);process.exitCode=1;}).finally(()=>fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2)));
