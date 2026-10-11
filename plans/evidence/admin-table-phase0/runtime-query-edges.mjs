// Additional real query capability checks; task-owned synthetic data only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {statePath,privateDir} from './runtime-stack.mjs';
const state=JSON.parse(fs.readFileSync(statePath,'utf8')),users=JSON.parse(fs.readFileSync(privateDir+'/users.json','utf8'));
assert.equal(state.api,'http://127.0.0.1:55431');
const options={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(15000)})}};
const admin=createClient(state.api,state.anonKey,options),trusted=createClient(state.api,state.serviceKey,options);
assert.ifError((await admin.auth.signInWithPassword(users.admin)).error);
const report={passed:false,checks:[],failures:[]};
const prove=(value,label,detail={})=>{assert.ok(value,label);report.checks.push({label,...detail});};
const result=async query=>{const r=await query;assert.ifError(r.error);return r;};
try{
 const needle='Beyond Cap Needle Ω';
 const tx=await result(admin.from('payments').select('id,request:service_requests(reference_number),r:service_requests(),n:service_requests(nr:profiles!service_requests_resident_id_fkey!inner()),d:service_requests(dt:document_types!inner()),c:profiles!payments_collected_by_fkey()',{count:'exact'}).ilike('r.reference_number',`%${needle}%`).ilike('n.nr.full_name',`%${needle}%`).ilike('d.dt.name',`%${needle}%`).ilike('c.full_name',`%${needle}%`).or('r.not.is.null,n.not.is.null,d.not.is.null,c.not.is.null').range(0,9));
 prove(tx.count===1&&tx.data[0].id.endsWith('001505'),'Transaction multi-level OR finds one resident match without excluding other left branches',{count:tx.count});
 const collector=await result(admin.from('payments').select('id,c:profiles!payments_collected_by_fkey()',{count:'exact'}).ilike('c.full_name','%Runtime admin%').not('c','is',null).range(0,9));
 prove(collector.count===1,'Collector-name filter matches the separately populated collector join');
 for(const [index,name] of [[2,'Literal %_.*,(quote) Ω'],[5,'Literal %_.x,(quote) Ω']]){
  const updated=await trusted.from('profiles').update({first_name:name,last_name:'Fixture'}).eq('id','20000000-0000-4000-8000-'+String(index).padStart(12,'0')).select('id');assert.ifError(updated.error);assert.equal(updated.data.length,1);
 }
 const literal='Literal %_.*,(quote) Ω';
 const pattern=literal.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const exact=await result(admin.from('profiles').select('id',{count:'exact'}).filter('full_name','imatch',pattern).range(0,9));
 prove(exact.count===1&&exact.data[0].id.endsWith('000002'),'Escaped native imatch preserves percent/underscore/star/comma/parentheses as literal substring',{pattern,count:exact.count});
 const naive=await result(admin.from('profiles').select('id',{count:'exact'}).ilike('full_name',`%${literal.replace(/[%_]/g,'\\$&')}%`).range(0,9));
 prove(naive.count===2,'Baseline capability limitation: ilike star alias broadens a literal asterisk',{count:naive.count});
 const quoted='"'+pattern.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
 const combined=await result(admin.from('profiles').select('id',{count:'exact'}).or(`full_name.imatch.${quoted},email.imatch.${quoted}`).range(0,9));
 prove(combined.count===1&&combined.data[0].id.endsWith('000002'),'Quoted regex OR preserves literal punctuation across existing direct columns');
 const offset=await admin.from('service_requests').select('id',{count:'exact'}).order('id').range(1600,1699);
 prove(offset.status===416&&offset.error?.code==='PGRST103','Out-of-range API page raises a range error; it is not empty success',{status:offset.status,code:offset.error?.code,sdkCount:offset.count});
 const recount=await result(admin.from('service_requests').select('id',{count:'exact',head:true}));
 prove(recount.count===1505,'One bounded independent count recovers total after invalid range',{count:recount.count});
 for(const tab of ['pending','confirmed','attended','cancelled']){
  const filtered=await result(admin.from('drive_registrations').select('id,score:drive_registration_scores!inner(priority_score)',{count:'exact'}).eq('status',tab).range(0,9));
  prove(filtered.count===(tab==='pending'?1506:0),`Applicant ${tab} filter produces an exact inner-score count`,{count:filtered.count});
 }
 report.passed=true;
}catch(error){report.failures.push(error.message);console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(new URL('./runtime-query-edges.json',import.meta.url),JSON.stringify(report,null,2)+'\n');await admin.auth.signOut({scope:'local'});}
console.log(`${report.checks.length} query-edge assertions; passed=${report.passed}`);
