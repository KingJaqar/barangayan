/* global __dirname */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),output=path.join(root,'plans/evidence/phase7/http');
fs.mkdirSync(output,{recursive:true});
const config=require('./phase7-local-config.cjs')();
const client=key=>createClient(config.API_URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(10000)})}});
const trusted=client(config.SERVICE_ROLE_KEY),report={passed:false,assertions:[],realtimeStatuses:[]};
const fixturesPath=path.join(root,'dist/phase7-tools/fixtures.json');
const prove=(condition,label)=>{assert.ok(condition,label);report.assertions.push(label);};
const ok=async(p,label)=>{const r=await p;assert.ifError(r.error);prove(!r.error,label);return r.data;};
const denied=async(p,label)=>{const r=await p;prove(!!r.error,label);return r.error;};
let fixtures;
async function provision(){
 const foreign=randomUUID(),drive=randomUUID(),race=randomUUID();
 await ok(trusted.from('barangays').insert({id:foreign,name:'Phase Seven Test Foreign'}),'Synthetic foreign tenant created');
 fixtures={foreign,drive,race,users:{}};
 fs.mkdirSync(path.dirname(fixturesPath),{recursive:true});
 for(const [label,role,tenant] of [['resident','resident',null],['second','resident',null],['third','resident',null],['admin','admin',null],['foreignAdmin','admin',foreign],['foreignResident','resident',foreign]]){
  const email=`phase7-${label}-${randomUUID()}@test.local`,password=`TestOnly-${randomUUID()}!`;
  const data=await ok(trusted.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Phase Seven Test'}}),`${label}: Auth account created`);
  const id=data.user.id;fixtures.users[label]={id,email,password};
  await ok(trusted.from('profiles').insert({id,barangay_id:tenant||'00000000-0000-0000-0000-000000000001',role,full_name:'Phase Seven '+label,first_name:'Phase',last_name:'Seven',house_no:'7',street:'Test Street',sex:'female',employment_status:'student',mobile_number:'09171234567',birth_date:'1955-01-01',email}),`${label}: completed fixture profile created`);
 }
 await ok(trusted.from('medical_drives').insert([
 {id:drive,barangay_id:'00000000-0000-0000-0000-000000000001',title:'Phase Seven Privacy Drive',type:'vaccination',drive_date:'2026-10-04',time_start:'08:00',time_end:'12:00',eligible_criteria:'Test residents',stock_total:10,stock_remaining:10},
 {id:race,barangay_id:'00000000-0000-0000-0000-000000000001',title:'Phase Seven Concurrent Slot',type:'consultation',drive_date:'2026-10-04',time_start:'08:00',time_end:'12:00',eligible_criteria:'Test residents',stock_total:1,stock_remaining:1}
 ]),'Dedicated test drives created');
 fs.writeFileSync(fixturesPath,JSON.stringify(fixtures,null,2));
}
async function login(label){const value=fixtures.users[label],c=client(config.ANON_KEY);const session=await ok(c.auth.signInWithPassword(value),`${label}: real Auth session`);await c.realtime.setAuth(session.session.access_token);return c;}
async function subscription(c,table,events){
 const channel=c.channel(`phase7-${table}-${randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table},event=>events.push(event));
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Realtime subscription timeout')),10000);
  // Socket join precedes PostgreSQL subscription readiness. Wait for the actual
  // server system acknowledgement before generating the control mutations.
  channel.on('system',{},message=>{report.realtimeStatuses.push({table,system:message});if(message.extension==='postgres_changes'&&message.status==='ok'){clearTimeout(timer);resolve();}});
  channel.subscribe(state=>{report.realtimeStatuses.push({table,state});if(state==='SUBSCRIBED'&&table==='drive_registration_scores'){clearTimeout(timer);resolve();}else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'){clearTimeout(timer);reject(Error(table+': '+state));}});
 });return channel;
}
async function exercise(){
 await provision();
 const resident=await login('resident'),admin=await login('admin'),foreignAdmin=await login('foreignAdmin');
 const events=[],protectedEvents=[];await subscription(resident,'drive_registrations',events);await subscription(resident,'drive_registration_scores',protectedEvents);
 const input={p_drive_id:fixtures.drive,p_age:65,p_is_pwd:true,p_comorbidities:['a','b','c','d','e'],p_prior_dose_date:'2020-01-01'};
 const result=await ok(resident.rpc('register_for_drive',input),'Resident registration succeeds through real RPC');fixtures.registration=result.registration_id;fs.writeFileSync(fixturesPath,JSON.stringify(fixtures,null,2));
 prove(Object.keys(result).sort().join(',')==='applicant_number,registration_id,status','Resident RPC returns only safe confirmation fields');
 const rows=await ok(resident.from('drive_registrations').select('*,medical_drives(title,drive_date)').eq('id',result.registration_id),'Resident wildcard REST remains readable');
 prove(rows.length===1&&!JSON.stringify(rows).includes('priority_score'),'Wildcard REST has no score');
 await denied(resident.from('drive_registrations').select('priority_score'),'Explicit old score column denied');
 const scores=await ok(resident.from('drive_registration_scores').select('*'),'Protected REST applies RLS');prove(scores.length===0,'Resident REST cannot retrieve score rows');
 const nested=await ok(resident.from('drive_registrations').select('id,score:drive_registration_scores(priority_score)').eq('id',result.registration_id),'Nested protected REST join executes');prove(nested[0].score===null,'Nested join cannot reveal own score');
 const inner=await ok(resident.from('drive_registrations').select('id,score:drive_registration_scores!inner(priority_score)'),'Inner join authorization applies');prove(inner.length===0,'Inner joins cannot infer score by matching rows');
 const jwt=(await resident.auth.getSession()).data.session.access_token;
 const csv=await fetch(`${config.API_URL}/rest/v1/drive_registration_scores?select=*`,{headers:{apikey:config.ANON_KEY,Authorization:`Bearer ${jwt}`,Accept:'text/csv'},signal:AbortSignal.timeout(10000)});
 prove(csv.ok&&!(await csv.text()).includes('80'),'Resident CSV request yields no protected values');
 await denied(resident.rpc('admin_register_for_drive',{...input,p_target_user_id:fixtures.users.second.id}),'Resident cannot invoke staff RPC');
 await denied(resident.from('drive_registration_scores').insert({registration_id:result.registration_id,priority_score:999}),'Resident cannot forge score row');
 const staffRows=await ok(admin.from('drive_registrations').select('*,score:drive_registration_scores!inner(priority_score),medical_drives(id,title,type,drive_date,location)').eq('id',result.registration_id),'Actual administrator page join works');
 prove(staffRows[0].score.priority_score===80,'Administrator exact formula result is 80');
 const foreign=await ok(foreignAdmin.from('drive_registration_scores').select('*').eq('registration_id',result.registration_id),'Foreign administrator REST executes');prove(foreign.length===0,'Foreign administrator cannot retrieve local score');
 await denied(foreignAdmin.rpc('admin_register_for_drive',{...input,p_target_user_id:fixtures.users.second.id}),'Foreign administrator RPC rejected');
 await denied(admin.from('drive_registration_scores').update({priority_score:999}).eq('registration_id',result.registration_id),'Administrator cannot overwrite historical score');
 await denied(resident.from('drive_registrations').update({status:'cancelled',age:1}).eq('id',result.registration_id),'Resident cancellation cannot tamper with scoring inputs');
 const second=await ok(admin.rpc('admin_register_for_drive',{...input,p_target_user_id:fixtures.users.second.id,p_age:4,p_is_pwd:false,p_comorbidities:['one'],p_prior_dose_date:null}),'Staff registration succeeds');prove(second.priority_score===20,'Staff result preserves infant/comorbidity score');
 await ok(admin.from('drive_registrations').update({status:'confirmed'}).eq('id',result.registration_id),'Staff confirmation succeeds');
 const deadline=Date.now()+10000;while(!events.some(e=>e.new.id===result.registration_id)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
 prove(events.some(e=>e.new.id===result.registration_id),'Real Realtime registration event received');
 prove(!JSON.stringify(events).includes('priority_score'),'Realtime payloads carry no score key');
 await new Promise(r=>setTimeout(r,1500));prove(protectedEvents.length===0,'Malicious protected-table subscription receives no score events');
 const ordering=await ok(admin.from('drive_registration_scores').select('*').in('registration_id',[result.registration_id,second.registration_id]).order('priority_score',{ascending:false}),'Administrator ranked REST/export query');prove(ordering.map(r=>r.priority_score).join(',')==='80,20','Administrator ranking values remain correct');
 // Execute the exact edge handler under Node with real Auth/REST, adapting only
 // its Deno entrypoint/import. This is not a hosted Edge Runtime execution.
 let handler;const source=fs.readFileSync(path.join(root,'supabase/functions/export-my-data/index.ts'),'utf8').replace(/import \{ createClient \} from 'jsr:[^']+';/,'');
 vm.runInNewContext(ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}),{createClient,Request,Response,Date,JSON,Promise,Deno:{env:{get:name=>name==='SUPABASE_URL'?config.API_URL:config.ANON_KEY},serve:fn=>{handler=fn;}}});
 const exported=await handler(new Request('http://127.0.0.1/export-my-data',{headers:{Authorization:`Bearer ${jwt}`}}));prove(exported.status===200,'Actual personal-data export handler succeeds with resident JWT');const body=await exported.json();
 prove(body.medical_drive_registrations.some(r=>r.id===result.registration_id),'Export retains resident registration and applicant number');
 prove(!JSON.stringify(body).includes('priority_score'),'Personal-data export has no score field anywhere');
 prove((await handler(new Request('http://127.0.0.1/export-my-data'))).status===401,'Unauthenticated export denied');
 const secondClient=await login('second'),thirdClient=await login('third');
 const raceInput={...input,p_drive_id:fixtures.race};const races=await Promise.all([resident,secondClient,thirdClient].map(c=>c.rpc('register_for_drive',raceInput)));
 prove(races.filter(r=>!r.error).length===1,'Concurrent capacity race reserves exactly one slot');
 const winner=races.find(r=>!r.error).data;const raceRows=await ok(trusted.from('drive_registrations').select('*,score:drive_registration_scores!inner(priority_score)').eq('drive_id',fixtures.race),'Inspect concurrent results');
 prove(raceRows.length===1&&raceRows[0].id===winner.registration_id,'Race creates exactly one registration and one protected score');
 const remaining=await ok(trusted.from('medical_drives').select('stock_remaining').eq('id',fixtures.race).single(),'Inspect stock');prove(remaining.stock_remaining===0,'Concurrent capacity never oversells');
 const duplicate=await resident.rpc('register_for_drive',input);prove(duplicate.error?.code==='P0004','Retry duplicate remains denied without extra score');
 const registrations=await ok(trusted.from('drive_registrations').select('id,score:drive_registration_scores!inner(priority_score)').eq('drive_id',fixtures.drive),'Reconcile successful registrations');prove(registrations.length===2,'Retry did not duplicate registration or score');
 await Promise.all([resident,admin,foreignAdmin,secondClient,thirdClient].map(c=>c.removeAllChannels()));
 report.passed=true;
}
async function clean(){
 fixtures=JSON.parse(fs.readFileSync(fixturesPath,'utf8'));for(const value of Object.values(fixtures.users))assert.match(value.email,/^phase7-.*@test\.local$/);
 const drives=[fixtures.drive,fixtures.race,fixtures.uiDrive,fixtures.nativeDrive].filter(Boolean);
 await ok(trusted.from('admin_audit_log').delete().in('admin_id',Object.values(fixtures.users).map(u=>u.id)),'Delete task fixture administrator audits');
 await ok(trusted.from('drive_registrations').delete().in('drive_id',drives),'Delete task fixture registrations');
 await ok(trusted.from('medical_drives').delete().in('id',drives),'Delete task fixture drives');
 for(const value of Object.values(fixtures.users))await ok(trusted.auth.admin.deleteUser(value.id),'Delete task fixture user');
 await ok(trusted.from('barangays').delete().eq('id',fixtures.foreign),'Delete task foreign tenant');
 console.log('Cleaned task-created synthetic fixtures only');
}
(process.argv[2]==='clean'?clean():exercise()).then(()=>console.log(`PASS ${report.assertions.length} HTTP assertions`)).catch(error=>{report.error=error.message;console.error(error.message);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(output,process.argv[2]==='clean'?'cleanup.json':'results.json'),JSON.stringify(report,null,2));process.exit(process.exitCode||0);});
