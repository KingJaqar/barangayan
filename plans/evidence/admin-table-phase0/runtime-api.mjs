// Real GoTrue sessions + PostgREST/RLS; exclusively the task-owned loopback stack.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {statePath,privateDir,sql} from './runtime-stack.mjs';
const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
const users=JSON.parse(fs.readFileSync(privateDir+'/users.json','utf8'));
assert.equal(state.api,'http://127.0.0.1:55431');
const report={timestamp:new Date().toISOString(),passed:false,checks:[],limitations:[],failures:[]};
const clients={};
const options={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(15000)})}};
const save=()=>fs.writeFileSync(new URL('./runtime-api-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
function prove(value,label,details={}) {assert.ok(value,label);report.checks.push({label,...details});save();}
async function rows(query,label){const r=await query;assert.ifError(r.error);return r;}
try {
 for(const [name,user] of Object.entries(users)){
  clients[name]=createClient(state.api,state.anonKey,options);
  const {data,error}=await clients[name].auth.signInWithPassword(user);assert.ifError(error);
  prove(data.user.id===user.id,`${name}: real password session`);
 }
 const admin=clients.admin, resident=clients.resident,foreign=clients.foreignAdmin,removed=clients.removedAdmin;
 const before=await rows(admin.from('profiles').select('id,full_name').eq('id','20000000-0000-4000-8000-000000001505').single());
 prove(before.data.full_name==='Beyond Cap Needle Ω','Synthetic sentinel retained by actual profile triggers',{actual:before.data.full_name});
 const definitions=[
  ['requests','service_requests','id','40000000',1505],
  ['transactions','payments','id','50000000',1505],
  ['directory','profiles','id','20000000',1505],
  ['incidents','incidents','id','61000000',1505],
  ['health','medical_drives','id','70000000',1505],
  ['applicants','drive_registrations','id,score:drive_registration_scores!inner(priority_score)','71000000',1505],
  ['households','household_members','id','80000000',1505],
  ['staff','barangay_officials','id,profile:profiles!inner(full_name)','',1505],
 ];
 for(const [name,table,select,prefix,expectedCount] of definitions){
  const make=()=>{
   let query=admin.from(table).select(select,{count:'exact'});
   if(name==='staff') query=query.like('profile.full_name','Fixture Staff %');
   else query=query.gte('id',prefix+'-0000-4000-8000-000000000001').lte('id',prefix+'-0000-4000-8000-000000001505');
   return query.order('id');
  };
  const capped=await rows(make());
  prove(capped.data.length===1000&&capped.count===expectedCount,`${name}: default cap differs from exact complete total`,{returned:capped.data.length,count:capped.count});
  const combined=[];
  for(let offset=0;offset<expectedCount;offset+=100){const page=await rows(make().range(offset,offset+99));assert.equal(page.count,expectedCount);assert.equal(page.data.length,Math.min(100,expectedCount-offset));combined.push(...page.data.map(row=>row.id));}
  const expected=name==='staff'?JSON.parse(sql("select jsonb_agg(o.id order by o.id) from public.barangay_officials o join public.profiles p on p.id=o.profile_id where p.full_name like 'Fixture Staff %';")):Array.from({length:expectedCount},(_,i)=>prefix+'-0000-4000-8000-'+String(i+1).padStart(12,'0'));
  assert.deepEqual(combined,expected);prove(new Set(combined).size===expectedCount,`${name}: concatenated bounded API pages equal independent fixture IDs`,{pages:Math.ceil(expectedCount/100),rows:combined.length});
 }
 const needle='Beyond Cap Needle Ω';
 const search=await rows(admin.from('service_requests').select('id,resident:profiles!service_requests_resident_id_fkey(full_name),r:profiles!service_requests_resident_id_fkey(),d:document_types()',{count:'exact'}).ilike('r.full_name',`%${needle}%`).ilike('d.name',`%${needle}%`).or(`reference_number.ilike.%${needle}%,r.not.is.null,d.not.is.null`).order('id').range(0,9));
 prove(search.count===1&&search.data[0].id.endsWith('001505'),'Related empty-embed OR finds resident sentinel beyond unfiltered cap',{query:'empty r/d embeds with top-level OR',count:search.count});
 const documentSearch=await rows(admin.from('service_requests').select('id,d:document_types()',{count:'exact'}).ilike('d.name','%Fixture Document Alpha%').not('d','is',null).range(0,9));
 prove(documentSearch.count===1505,'Related document filtering counts all 1,505 matching requests');
 const tx=await rows(admin.from('payments').select('id,service_requests(reference_number,...profiles!service_requests_resident_id_fkey(resident_name:full_name))').order('service_requests(resident_name)',{ascending:true}).order('id').range(0,99));
 const txExpected=JSON.parse(sql("select jsonb_agg(id order by full_name,id) from (select p.id,pr.full_name from public.payments p join public.service_requests sr on sr.id=p.service_request_id join public.profiles pr on pr.id=sr.resident_id order by pr.full_name,p.id limit 100)x;"));
 assert.deepEqual(tx.data.map(row=>row.id),txExpected);prove(true,'Transaction nested spread parent order matches independent SQL',{rows:tx.data.length});
 const score=await rows(admin.from('drive_registrations').select('id,score:drive_registration_scores!inner(priority_score)').order('score(priority_score)',{ascending:false}).order('id').range(0,99));
 prove(score.data.length===100&&score.data.every(row=>row.score.priority_score===90),'Protected score sorting under active administrator session');
 const missing=await rows(admin.from('drive_registrations').select('id,user_id,score:drive_registration_scores!inner(priority_score),medical_drives(title)').in('id',['71000000-0000-4000-8000-000000009998','71000000-0000-4000-8000-000000009999']));
 prove(missing.data.length===1&&missing.data[0].id.endsWith('009998'),'Inner score membership excludes missing score and retains missing-profile registration');
 const missingProfile=await rows(admin.from('profiles').select('id').eq('id','20000000-0000-4000-8000-000000009998'));prove(missingProfile.data.length===0,'Missing-profile fixture is genuinely absent');
 const nullIncident=await rows(admin.from('incidents').select('id,reporter:profiles!incidents_reporter_id_fkey(full_name),category:incident_categories(name)').eq('id','61000000-0000-4000-8000-000000001504').single());
 prove(nullIncident.data.reporter===null&&nullIncident.data.category===null,'Left incident joins retain null reporter/category');
 const aggregate=await admin.from('medical_drives').select('id,drive_registrations(count())').limit(1);
 prove(aggregate.error?.code==='PGRST123','Native registration aggregate is disabled in representative REST configuration',{code:aggregate.error?.code});
 const badProfile=await admin.from('drive_registrations').select('id,profiles(full_name)').limit(1);
 prove(badProfile.error?.code==='PGRST200','Applicant direct profile embed lacks a real FK',{code:badProfile.error?.code});
 for(const [name,client] of [['foreignAdmin',foreign],['resident',resident],['removedAdmin',removed]]){
  const protectedRows=await rows(client.from('drive_registration_scores').select('registration_id',{count:'exact'}));
  prove(protectedRows.data.length===0&&protectedRows.count===0,`${name}: cannot read tenant A protected scores`);
 }
 for(const table of ['service_requests','payments','incidents','household_members','barangay_officials']){
  const f=await rows(foreign.from(table).select('id',{count:'exact'}));
  const expected=table==='barangay_officials'?1:0;prove(f.count===expected,`foreignAdmin: ${table} excludes tenant A`,{count:f.count});
 }
 const visibleForeign=await rows(admin.from('medical_drives').select('id,title').eq('barangay_id','10000000-0000-4000-8000-000000000002'));
 prove(visibleForeign.data.length===1&&visibleForeign.data[0].title==='Foreign Active Drive','Baseline defect: admin can read active foreign Health drive');report.limitations.push('Health requires explicit caller tenant scope; current public SELECT policy admits active foreign drives.');
 const removedRequests=await rows(removed.from('service_requests').select('id',{count:'exact'}).limit(1));
 prove(removedRequests.count===1505,'Baseline defect: soft-deleted admin retains request read access',{count:removedRequests.count});report.limitations.push('current_role/current_barangay_id omit deleted_at; some browse reads still admit removed admin. Protected scores reject it separately.');
 const denied=await resident.from('incidents').update({title:'Forbidden edit'}).eq('id','61000000-0000-4000-8000-000000000001').select('id');
 prove(!denied.error&&denied.data.length===0,'Resident incident update affects zero unauthorized rows');
 const failedScore=await resident.from('drive_registration_scores').update({priority_score:100}).eq('registration_id','71000000-0000-4000-8000-000000000001').select('registration_id');
 prove(Boolean(failedScore.error)||failedScore.data?.length===0,'Resident cannot write protected score');
 report.passed=true;save();console.log(`PASS ${report.checks.length} real authenticated API/fixture checks; ${report.limitations.length} baseline limitations reproduced`);
}catch(error){report.failures.push({name:error.name,message:error.message});save();console.error(error);process.exitCode=1;}
finally {for(const client of Object.values(clients))await client.auth.signOut({scope:'local'});}
