import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { sql, state, token, root, bundle } from './runtime.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
await bundle();
const { browseTable, parseTableState, tableSummary, loadTable, manilaDay }=await import(pathToFileURL(path.join(root,'dist/admin-table-phase2/adapter.mjs')));
const contracts=JSON.parse(fs.readFileSync(new URL('./contracts.json',import.meta.url),'utf8'));
const admin='21000000-0000-4000-8000-000000001505';
let requests=0,maxTransportRows=0;
function client(sub,role='authenticated',override){
 return createClient(state().rest,token('anon'),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token(role,sub)}`},fetch:async(url,options)=>{
  requests++;const direct=String(url).replace('/rest/v1/','/');if(override)return override(direct,options);
  const r=await fetch(direct,options);const clone=r.clone();if(!r.ok)console.log('API failure',r.status,await clone.text());else if(options?.method !== 'HEAD' && String(url).includes('_browse')){const data=await clone.json();if(Array.isArray(data))maxTransportRows=Math.max(maxTransportRows,data.length);}return r;
 }}});
}
const db=client(admin);
const claims=JSON.stringify({sub:admin,role:'authenticated'});
const asAdmin=q=>sql(`set role authenticated; set request.jwt.claims='${claims}'; ${q}`);
const id=g=>'20000000-0000-4000-8000-'+String(g).padStart(12,'0');
// Valid writes only in the disposable fixture, via the real constraints/triggers.
sql(`update public.profiles set full_name=case right(id::text,12)::bigint when 1 then '  Alpha Duplicate  ' when 2 then E'\\tALPHA DUPLICATE\\t' when 3 then '   ' when 4 then 'Éclair' else full_name end where id in ('${id(1)}','${id(2)}','${id(3)}','${id(4)}');
update public.service_requests set reference_number=case right(id::text,12)::bigint when 1 then ' REQ-2 ' when 2 then 'req-0002' when 3 then 'REQ-10' when 4 then 'REQ-00010' when 5 then 'REF-1-2' else reference_number end where right(id::text,12)::bigint<=5;
update public.incidents set description='literal % _ * \\ " , ( ) sentinel' where id='61000000-0000-4000-8000-000000001505';
update public.drive_registrations set status='cancelled' where id='71000000-0000-4000-8000-000000000001';
update public.profiles set household_members='[{"id":"x","name":"fixture","relation":"child","role":"child"}]' where id='${id(1)}';
update public.barangay_officials set official_role=case right(profile_id::text,12)::bigint % 3 when 0 then 'health_worker' when 1 then 'staff' else 'admin' end where profile_id::text like '21000000%';`);
const labels={submitted:'Submitted',in_progress:'Processing',ready_for_pickup:'Ready for Pickup',completed:'Completed',cancelled:'Cancelled',pending:'Pending',paid:'Paid',waived:'Waived',failed:'Failed',expired:'Expired',refunded:'Refunded',open:'Open',resolved:'Resolved',withdrawn:'Withdrawn',unresolved:'Unresolved',confirmed:'Confirmed',attended:'Attended'};
const types={vaccination:'Vaccination',maternal_care:'Maternal Care',blood_drive:'Blood Drive',medicine:'Medicine Distribution',dental:'Dental Care',optical:'Optical Care',emergency_kit:'Emergency Kit',screening:'Medical Screening',consultation:'Medical Consultation',minor_surgical:'Minor Surgical Drive',others:'Others'};
const roles={admin:'Administrator',staff:'Staff',barangay_captain:'Barangay Captain',kagawad:'Kagawad',sk_chairman:'SK Chairman',secretary:'Secretary',treasurer:'Treasurer',health_worker:'Barangay Health Worker',tanod:'Tanod',clerk:'Clerk'};
const title=x=>x==null?null:x.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
function key(name,sort,r){
 const shared={modified:r.updated_at,created:r.created_at};
 const map={
 requests:{reference:r.reference_number,resident:r.profiles?.full_name,document:r.document_types?.name,status:labels[r.status]??title(r.status),payment_status:labels[r.payment_status]??title(r.payment_status),submitted:r.created_at},
 transactions:{reference:r.service_requests?.reference_number,resident:r.service_requests?.profiles?.full_name,document:r.service_requests?.document_types?.name,method:{pickup:'Pay at Pickup',qrph:'QR PH'}[r.method]??title(r.method),status:labels[r.status]??title(r.status),amount:r.amount_centavos,paid:r.paid_at,refund:r.refunded_at},
 residents:{name:r.full_name,first_name:r.first_name,last_name:r.last_name,email:r.email,email_verification:r.email_verification_status,id_status:r.id_repair_required?'Evidence repair required':{verified:'Verified ID',pending:'Pending Verification',verification_failed:'Verification Failed, Try Again'}[r.id_verification_status]??null,joined:r.created_at},
 incidents:{submitted:r.created_at,title:r.title,category:r.incident_categories?.name,reporter:r.profiles?.full_name,status:r.status==='in_progress'?'In Progress':labels[r.status]??title(r.status),confirmations:r.confirmation_count},
 health:{title:r.title,category:types[r.type]??title(r.type),drive_date:r.drive_date,active:r.is_active,registrations:r.registration_count,stock:r.stock_remaining},
 applicants:{registered:r.created_at,number:r.applicant_number,resident:r.profiles?.full_name,drive:r.medical_drives?.title,category:types[r.medical_drives?.type]??title(r.medical_drives?.type),status:labels[r.status]??title(r.status),age:r.age,priority:r.priority_score,drive_date:r.medical_drives?.drive_date},
 households:{name:r.name,head:r.profiles?.full_name,relation:title(r.relation),role:title(r.role),checked_in:r.is_checked_in,center:r.checked_in_center_name,added:r.created_at,check_in_date:r.checked_in_at},
 staff:{name:r.profile?.full_name,role:roles[r.official_role]??title(r.official_role),email:r.profile?.email,hired:r.date_hired,profile_modified:r.profile?.updated_at},
 };
 return {...shared,...map[name]}[sort];
}
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const stringCmp=(a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b));
function compare(a,b,category){
 if(category==='date')return cmp(Date.parse(a),Date.parse(b));
 if(category==='number'||category==='boolean')return cmp(a,b);
 if(category==='reference'){
  const aa=a.match(/\d+|\D+/g),bb=b.match(/\d+|\D+/g);
  for(let i=0;i<Math.min(aa.length,bb.length);i++){
   const an=/^\d+$/.test(aa[i]),bn=/^\d+$/.test(bb[i]);
   const c=an&&bn?cmp(BigInt(aa[i]),BigInt(bb[i])):an!==bn?(an?-1:1):stringCmp(aa[i],bb[i]);if(c)return c;
  }return cmp(aa.length,bb.length);
 }return stringCmp(a,b);
}
function comparator(name,sort,dir){return(a,b)=>{
 let av=key(name,sort.key,a),bv=key(name,sort.key,b);
 if(['text','reference'].includes(sort.category)){av=av?.trim().toLowerCase()||null;bv=bv?.trim().toLowerCase()||null;}
 if(av==null||bv==null)return av==null&&bv==null?cmp(a.id,b.id):av==null?1:-1;
 return compare(av,bv,sort.category)*(dir==='asc'?1:-1)||cmp(a.id,b.id);
};}
const report={timestamp:new Date().toISOString(),checks:[],sorts:[],counts:{}};
function check(name){report.checks.push(name);console.log(name);}
function ok(result){assert.equal(result.status,'success',JSON.stringify(result));return result.value;}
for(const [name,c] of Object.entries(contracts)){
 if(process.env.TABLE_TEST_SCREEN && !process.env.TABLE_TEST_SCREEN.split(',').includes(name))continue;
 // Whole expected membership is collected in SQL for the test only; production
 // adapters always request a page. Independent JS comparators use raw row fields.
 const all=JSON.parse(asAdmin(`select coalesce(json_agg(row),'[]') from public.admin_${name}_browse;`));
 report.counts[name]=all.length;assert.ok(all.length>=1505,name);
 for(const sort of c.sorts)for(const dir of ['asc','desc']){
  const expected=[...all].sort(comparator(name,sort,dir)).map(r=>r.id),actual=[];
  // Fixed batches of four independent reads; no writes occur while composing pages.
  for(let first=1;first<=Math.ceil(all.length/100);first+=4){
   const pages=Array.from({length:Math.min(4,Math.ceil(all.length/100)-first+1)},(_,i)=>first+i);
   const batch=await Promise.all(pages.map(page=>browseTable(name,parseTableState(name,new URLSearchParams({tab:'all',sort:sort.key,dir,page:String(page),pageSize:'100'})),db)));
   for(const response of batch){const result=ok(response);assert.equal(result.total,all.length);assert.equal(result.rows.length,Math.min(100,all.length-actual.length));actual.push(...result.rows.map(r=>r.id));}
  }
  assert.deepEqual(actual,expected,`${name} ${sort.key} ${dir}`);assert.equal(new Set(actual).size,all.length);
  report.sorts.push({name,sort:sort.key,dir,rows:actual.length});
  fs.writeFileSync(new URL('./sort-progress.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 }
 for(const size of [10,20,30,50,100]){
  const s=parseTableState(name,new URLSearchParams({tab:'all',page:'9999',pageSize:String(size)}));
  const before=requests,r=ok(await browseTable(name,s,db));assert.equal(r.state.page,Math.ceil(all.length/size));assert.equal(requests-before,4);assert.equal(r.rows.length,all.length%size||size);
 }
 const empty=ok(await browseTable(name,parseTableState(name,new URLSearchParams({tab:'all',q:'nothing-ever-matches',page:'9'})),db));assert.equal(empty.total,0);assert.equal(empty.state.page,1);assert.equal(empty.rows.length,0);
 const summary=ok(await tableSummary(name,db));
 if(name==='requests')assert.equal(summary.submitted,1505);
 if(name==='transactions')assert.equal(summary.pending,150500);
 if(name==='residents'){assert.equal(summary.total,1505);assert.equal(summary.householdMembers,1);}
 if(name==='incidents')assert.equal(summary.total,1505);
 if(name==='health'){assert.equal(summary.total,1505);assert.equal(summary.registrations,1507);assert.equal(all.find(x=>x.id.endsWith('000000000001')).registration_count,1506);assert.equal(all.find(x=>x.id.endsWith('000000000002')).registration_count,1);assert.equal(all.find(x=>x.id.endsWith('000000000003')).registration_count,0);}
 if(name==='applicants'){assert.equal(summary.total,1506);assert.equal(summary.cancelled,1);assert.ok(all.find(x=>x.id.endsWith('000000009998')&&x.profiles===null));}
 if(name==='households')assert.equal(summary.total,1505);
 if(name==='staff')assert.equal(summary.total,all.length);
 check(`${name}: all sorts, five sizes, one correction, empty and independent summaries`);
}
const searches={requests:'Beyond Cap Needle Ω',transactions:'Beyond Cap Needle Ω',residents:'Beyond Cap Needle Ω',incidents:'sentinel',health:'1505',applicants:'hypertension, diabetes',households:'Beyond Cap Needle Ω',staff:'1505'};
for(const [name,q]of Object.entries(searches)){const r=ok(await browseTable(name,parseTableState(name,new URLSearchParams({tab:'all',q})),db));assert.equal(r.total,1,`${name} beyond cap`);}
for(const q of ['%','_','*','\\','"',',','(',')']){const r=ok(await browseTable('incidents',parseTableState('incidents',new URLSearchParams({tab:'all',q})),db));assert.equal(r.total,1,`literal ${q}`);}
assert.equal(ok(await browseTable('applicants',parseTableState('applicants',new URLSearchParams({q:'Beyond Cap Needle Ω'})),db)).total,0);
assert.equal(manilaDay(new Date('2026-10-10T16:00:00Z')),'2026-10-11');check('complete related search, literal punctuation, separator semantics, no applicant-name search, Manila boundary');
for(const [actor,sub]of Object.entries({resident:id(1),removed:'23000000-0000-4000-8000-000000000002'}))for(const name of Object.keys(contracts)){
 const r=ok(await browseTable(name,parseTableState(name,new URLSearchParams({tab:'all'})),client(sub)));assert.equal(r.total,0,`${actor}/${name}`);
 const s=await tableSummary(name,client(sub));assert.equal(s.status,'error');assert.equal(s.code,'access-denied');
}
const foreign=client('23000000-0000-4000-8000-000000000001');
for(const name of Object.keys(contracts)){const r=ok(await browseTable(name,parseTableState(name,new URLSearchParams({tab:'all'})),foreign));assert.equal(r.total,name==='health'?2:name==='staff'?1:0);}
const anon=await browseTable('applicants',parseTableState('applicants',new URLSearchParams()),client(undefined,'anon'));assert.equal(anon.status,'error');
const scoreRead=await client(id(1)).from('drive_registration_scores').select('priority_score');assert.ifError(scoreRead.error);assert.deepEqual(scoreRead.data,[]);
const denied=await loadTable('requests',new URLSearchParams({tab:'all'}),client(id(1)));assert.equal(denied.table.code,'access-denied');
const write=await db.from('admin_requests_browse').delete().eq('id','40000000-0000-4000-8000-000000000001');assert.ok(write.error);check('resident, removed admin, foreign tenant, anon, protected scores and read-only views');
let failedReads=0;
const bad=client(admin,'authenticated',async(url,opts)=>{if(String(url).includes('_summary')){failedReads++;return new Response(JSON.stringify({message:'Injected summary failure'}),{status:503});}return fetch(url,opts);});
const outcomes=await loadTable('requests',new URLSearchParams({tab:'all'}),bad);assert.equal(outcomes.table.status,'success');assert.equal(outcomes.summary.status,'error');assert.equal(failedReads,1);check('summary failure isolated; automatic retries disabled');
report.requests=requests;report.maxTransportRows=maxTransportRows;assert.equal(maxTransportRows,100);
fs.writeFileSync(new URL(process.env.TABLE_TEST_SCREEN?'./targeted-results.json':'./results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(`PASS: ${report.sorts.length} global sort/direction runs; ${requests} requests; maximum transport ${maxTransportRows}`);



