import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {root,state,token,sql,bundle} from './runtime.mjs';
await bundle();
const {browseTable,tableSummary,parseTableState,manilaDay}=await import(pathToFileURL(path.join(root,'dist/admin-table-phase2/adapter.mjs')));
const admin='21000000-0000-4000-8000-000000001505';
const db=createClient(state().rest,token('anon'),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token('authenticated',admin)}`},fetch:(url,options)=>fetch(String(url).replace('/rest/v1/','/'),options)}});
const today=manilaDay();
const cases={
 requests:[['active','doc','30000000-0000-4000-8000-000000000001'],['processing'],['pickup'],['completed'],['cancelled']],
 transactions:[['pending','method','pickup'],['pending','method','qrph'],['paid'],['failed'],['expired'],['refunded']],
 residents:[['verified'],['unverified','verification','with_id'],['unverified','verification','without_id']],
 incidents:[['open','category','60000000-0000-4000-8000-000000000001'],['in_progress'],['resolved'],['withdrawn'],['unresolved']],
 health:[['upcoming','type','consultation'],['today'],['past'],['inactive']],
 applicants:[['pending','type','consultation'],['confirmed'],['attended'],['cancelled']],
 households:[['checked_in'],['not_checked_in','relation','child'],['all','relation','Child']],
 staff:[['admin','role','admin'],['staff','role','health_worker'],['staff','role','staff']],
};
function matches(name,r,tab,key,value){
 if(name==='requests'&&tab!=='all'&&r.status!=={active:'submitted',processing:'in_progress',pickup:'ready_for_pickup',completed:'completed',cancelled:'cancelled'}[tab])return false;
 if(['transactions','incidents','applicants'].includes(name)&&tab!=='all'&&r.status!==tab)return false;
 if(name==='residents'&&tab!=='all'&&(r.email_verification_status==='verified')!==(tab==='verified'))return false;
 if(name==='health'&&tab!=='all'){
  if(r.is_active!==(tab!=='inactive'))return false;
  if(tab==='today'&&r.drive_date!==today)return false;
  if(tab==='upcoming'&&r.drive_date<today)return false;
  if(tab==='past'&&r.drive_date>=today)return false;
 }
 if(name==='households'&&tab!=='all'&&r.is_checked_in!==(tab==='checked_in'))return false;
 if(name==='staff'&&tab!=='all'&&(r.official_role==='admin')!==(tab==='admin'))return false;
 if(!value)return true;
 if(key==='doc')return r.document_type_id===value;
 if(key==='method')return r.method===value;
 if(key==='category')return r.category_id===value;
 if(key==='verification')return (r.id_photo_urls.length>0)===(value==='with_id');
 if(key==='type')return (name==='health'?r.type:r.medical_drives?.type)===value;
 if(key==='relation')return r.relation===value;
 if(key==='role')return r.official_role===value;
 return true;
}
const report=[];
for(const[name,list]of Object.entries(cases)){
 const all=JSON.parse(sql(`set role authenticated;set request.jwt.claims='${JSON.stringify({sub:admin,role:'authenticated'})}';select json_agg(row) from public.admin_${name}_browse;`));
 const baseline=await tableSummary(name,db);assert.equal(baseline.status,'success');
 for(const[tab,key,value]of list){
  const params=new URLSearchParams({tab,...key?{[key]:value}:{},pageSize:'100'});
  const state=parseTableState(name,params),validTab=state.filters.tab,validValue=key?state.filters[key]:undefined;
  const expected=all.filter(r=>matches(name,r,validTab,key,validValue));
  const result=await browseTable(name,state,db);assert.equal(result.status,'success',JSON.stringify(result));
  assert.equal(result.value.total,expected.length,`${name}/${tab}/${key}`);
  assert.ok(result.value.rows.every(r=>expected.some(e=>e.id===r.id)));
  assert.deepEqual(await tableSummary(name,db),baseline);
  report.push({name,tab,key,value,validated:state.filters,total:expected.length});
 }
}
// Nullable category/reporter rows remain visible when the related filter is absent.
const noFilter=await browseTable('incidents',parseTableState('incidents',new URLSearchParams({tab:'all',q:'1504'})),db);
assert.equal(noFilter.status,'success');assert.equal(noFilter.value.total,1);assert.equal(noFilter.value.rows[0].profiles,null);
fs.writeFileSync(new URL('./filters.json',import.meta.url),JSON.stringify({checks:report,nullableRelationship:true},null,2));
console.log(`PASS: ${report.length} filter combinations and independent summaries`);
