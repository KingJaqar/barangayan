import fs from 'node:fs';
import assert from 'node:assert/strict';
import { sql, state, token, bundle, root } from './runtime.mjs';
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
await bundle();
const {browseTable,parseTableState}=await import(pathToFileURL(path.join(root,'dist/admin-table-phase2/adapter.mjs')));
const admin='21000000-0000-4000-8000-000000001505';
// Reuse only the scale insert statements from the deterministic baseline seed.
// Existing schema, login actors and edge fixtures stay unchanged.
const original=fs.readFileSync(path.join(root,'plans/evidence/admin-table-phase0/runtime-seed.sql'),'utf8');
const scale=original.split(';').filter(s=>s.includes('generate_series(1,1505)g')&&!s.includes('UPDATE public.drive_registration_scores'))
 .map(s=>s.replaceAll('generate_series(1,1505)g','(select g from generate_series(1506,10002) as source(g) where g not in (9998,9999)) as fixture(g)')).join(';')+';';
if(process.argv[2]!=='measure')sql('begin;\n'+scale+'\ncommit;');
sql('analyze;');
const db=createClient(state().rest,token('anon'),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token('authenticated',admin)}`},fetch:(url,opts)=>fetch(String(url).replace('/rest/v1/','/'),opts)}});
const candidates=[
 ['requests','default',{}],['requests','natural deep page',{page:'1000'}],['transactions','joined resident',{sort:'resident'}],
 ['residents','substring',{q:'resident-9997'}],['incidents','nullable reporter',{sort:'reporter'}],['health','aggregate',{sort:'registrations'}],
 ['applicants','joined score',{sort:'priority'}],['households','joined head',{sort:'head'}],['staff','label role',{sort:'role'}],
];
const report={timestamp:new Date().toISOString(),tenantRows:10000,cpuLimit:2,memory:'DB 1GiB; REST 512MiB',profile:'loopback, no injected latency; sequential warm requests',samples:20,results:[],plans:{}};
for(const[name,label,params]of candidates){
 const s=parseTableState(name,new URLSearchParams({tab:'all',...params}));
 const times=[];
 for(let i=0;i<22;i++){
  const t=performance.now(),r=await browseTable(name,s,db);assert.equal(r.status,'success',JSON.stringify(r));
  if(i>=2)times.push(performance.now()-t);
 }
 times.sort((a,b)=>a-b);const p95=times[Math.ceil(times.length*0.95)-1];
 report.results.push({name,label,p95Ms:Math.round(p95*100)/100,maxMs:Math.round(times.at(-1)*100)/100,pass:p95<=500});
 console.log(`${name}/${label}: p95 ${p95.toFixed(1)}ms`);
 const sort=params.sort??s.sort;
 const where=params.q?`where x4 like '%resident-9997%'`:'';
 const plan=sql(`set role authenticated; set request.jwt.claims='${JSON.stringify({sub:admin,role:'authenticated'})}'; explain(analyze,buffers,format json) select id from public.admin_${name}_browse ${where} order by s_${sort} ${s.dir} nulls last,id asc limit 10 offset ${params.page?'9990':'0'};`);
 report.plans[`${name}/${label}`]=JSON.parse(plan);
 fs.writeFileSync(new URL('./performance-latest.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
}
fs.writeFileSync(new URL('./performance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
assert.ok(report.results.every(r=>r.pass),'Measured performance target failed; inspect query plans before adding indexes');
console.log('PASS: all measured warm browse p95 targets <=500ms');
