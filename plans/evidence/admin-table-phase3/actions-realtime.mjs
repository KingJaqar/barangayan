import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
import {privateDir,statePath,sql} from './runtime-stack.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const state=JSON.parse(fs.readFileSync(statePath,'utf8')),users=JSON.parse(fs.readFileSync(privateDir+'/users.json','utf8'));
const trusted=createClient(state.api,state.serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(u,i)=>fetch(u,{...i,signal:AbortSignal.timeout(15000)})}});
const report={passed:false,checks:[],errors:[],timings:[],refreshes:null,leaks:[]};
const save=()=>fs.writeFileSync(new URL('./actions-realtime.json',import.meta.url),JSON.stringify(report,null,2));
const check=async(label,run)=>{if(process.argv.includes('--reconciliation-only') && ['Complete options','Transaction request lookup'].some(text=>label.startsWith(text)))return;if(process.argv.includes('--creation-only') && !['Complete options','Transaction request lookup'].some(text=>label.startsWith(text)))return;if(process.argv.includes('--transaction-only')&&!label.startsWith('Transaction request lookup'))return;await run();report.checks.push(label);console.log('Passed: '+label);save();};
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Manila'});
await context.addInitScript(()=>{
 window.phase3={events:[],active:[],observers:{resize:0,mutation:0}};const Native=window.WebSocket;
 window.WebSocket=class extends Native {
  constructor(...args){super(...args);this.addEventListener('message',e=>{try{const a=JSON.parse(e.data),m=Array.isArray(a)?{topic:a[2],event:a[3],payload:a[4]}:a;window.phase3.events.push({topic:m.topic,event:m.event,status:m.payload?.status});}catch{}});}
  send(data){try{const a=JSON.parse(data),m=Array.isArray(a)?{topic:a[2],event:a[3]}:a;if(m.event==='phx_join')window.phase3.active.push(m.topic);if(m.event==='phx_leave')window.phase3.active=window.phase3.active.filter(t=>t!==m.topic);}catch{}return super.send(data);}
 };
 for(const [name,key] of [['ResizeObserver','resize'],['MutationObserver','mutation']]) {
  const Native=window[name];window[name]=class extends Native {
   observe(target,...args){if(!this.counted&&target.tagName==='TABLE'){this.counted=true;window.phase3.observers[key]++;}return super.observe(target,...args);}
   disconnect(){if(this.counted){this.counted=false;window.phase3.observers[key]--;}return super.disconnect();}
  };
 }
});
const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>{report.errors.push(e.message);save();});
let requests=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/requests' && r.headers().rsc==='1' && r.method()==='GET')requests++;});
async function ready(){await page.waitForFunction(()=>document.querySelector('.table-browse-panel')?.getAttribute('aria-busy')==='false');await page.waitForFunction(()=>Object.keys(document.querySelector('input[type=search]')??{}).some(k=>k.startsWith('__reactProps')));}
async function go(route){await page.goto('http://127.0.0.1:3140'+route,{timeout:60000});await ready();}
async function range(text){await page.waitForFunction(t=>document.querySelector('.table-browse-pagination')?.textContent.includes(t),text);await ready();}
async function patch(table,id,values){const r=await trusted.from(table).update(values).eq('id',id).select('id');assert.ifError(r.error);assert.equal(r.data.length,1);}
try{
 await page.goto('http://127.0.0.1:3140/login');await page.locator('input[type=email]').fill(users.admin.email);await page.locator('input[type=password]').fill(users.admin.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.waitForURL('**/dashboard');
 await check('Actual request Realtime events defer during an edit and reconcile a burst without losing draft identity',async()=>{
  await go('/requests?tab=all&q=REQ-PHASE0-01505');
  await page.waitForFunction(()=>window.phase3.events.some(e=>e.topic?.includes('admin-service-requests')&&e.event==='phx_reply'&&e.status==='ok'));
  const cell=page.locator('tbody tr td').nth(6);await cell.focus();await cell.press('Enter');await cell.locator('input').fill('Retained draft');
  const before=requests,events=await page.evaluate(()=>window.phase3.events.filter(e=>e.event==='postgres_changes').length);
  const nonce=Date.now();for(let i=1;i<=3;i++)await patch('service_requests','40000000-0000-4000-8000-000000001505',{requester_notes:'Realtime burst '+nonce+' '+i});
  await page.waitForFunction(n=>window.phase3.events.filter(e=>e.event==='postgres_changes').length>=n+3,events);await page.waitForTimeout(250);assert.equal(requests,before);assert.equal(await cell.locator('input').inputValue(),'Retained draft');
  await cell.getByRole('button',{name:'Cancel edit',exact:true}).click();await page.waitForFunction(n=>document.querySelector('tbody tr td:nth-child(7)')?.textContent==='Realtime burst '+n+' 3',nonce);await ready();report.refreshes={whileEditing:0,afterRelease:requests-before,events:3};assert.ok(requests-before>=1&&requests-before<=2);
 });
 await check('Ten client route mount cycles leave one request subscription and table observer counts at baseline',async()=>{
  const initial=await page.evaluate(()=>({...window.phase3.observers}));
  for(let i=0;i<10;i++){
   await page.locator('a[href="/transactions"]').first().click();await page.waitForURL('**/transactions');await ready();
   await page.waitForFunction(()=>window.phase3.active.filter(t=>t?.includes('admin-service-requests')).length===0);
   await page.locator('a[href="/requests"]').first().click();await page.waitForURL('**/requests');await ready();
   await page.waitForFunction(()=>window.phase3.active.filter(t=>t?.includes('admin-service-requests')).length===1);
   report.leaks.push(await page.evaluate(()=>({observers:{...window.phase3.observers},requestChannels:window.phase3.active.filter(t=>t?.includes('admin-service-requests')).length})));save();
  }
  for(const sample of report.leaks){assert.deepEqual(sample.observers,initial);assert.equal(sample.requestChannels,1);}
 });
 await check('Warm loopback control-to-committed-results timings are recorded for both pilot routes',async()=>{
  for(const route of ['requests','transactions']){
   await go('/'+route+'?tab=all');
   for(let i=0;i<10;i++){
    const before=performance.now(),old=page.url();await page.getByRole('button',{name:i%2===0?'Next':'Previous',exact:true}).click();await page.waitForURL(u=>u.toString()!==old);await ready();report.timings.push({route,ms:performance.now()-before});save();
   }
  }
 });
 await check('Complete options permit request creation for a resident beyond the API cap; archive refreshes exact membership',async()=>{
  await go('/requests?tab=all&q=REQ-PILOT-CREATED');await page.getByRole('button',{name:'+ Add Request',exact:true}).click();const form=page.locator('form');
  await form.getByLabel(/^Reference/).fill('REQ-PILOT-CREATED');await form.getByLabel(/^Resident/).selectOption('20000000-0000-4000-8000-000000001505');await form.getByLabel(/^Document Type/).selectOption('30000000-0000-4000-8000-000000000001');await form.getByRole('button',{name:'Create Request',exact:true}).click();await range('Showing 1–1 of 1');
  const row=await trusted.from('service_requests').select('id,resident_id,contract_version').eq('reference_number','REQ-PILOT-CREATED').single();assert.ifError(row.error);assert.equal(row.data.resident_id,'20000000-0000-4000-8000-000000001505');assert.equal(row.data.contract_version,1);
  await page.getByRole('button',{name:'Archive request REQ-PILOT-CREATED',exact:true}).click();await page.getByRole('button',{name:'Archive?',exact:true}).click();await range('Showing 0–0 of 0');
 });
 await check('Transaction request lookup chooses the latest reference, creates a centavo-accurate ledger row and audits archive',async()=>{
  await go('/transactions?q=REQ-PHASE0-01505');await page.getByRole('button',{name:'+ Add Transaction',exact:true}).click();const form=page.locator('form');
  await form.getByLabel('Request Reference',{exact:true}).fill('REQ-PHASE0-00001');await form.getByLabel('Request Reference',{exact:true}).fill('REQ-PHASE0-01505');
  await page.waitForFunction(()=>document.querySelector('form input[readonly]')?.value.includes('Beyond Cap Needle'));
  await form.getByLabel('Amount (₱)',{exact:true}).fill('5.67');await form.getByRole('button',{name:'Add Transaction',exact:true}).click();await range('Showing 1–2 of 2');
  const record=await trusted.from('payments').select('id').eq('service_request_id','40000000-0000-4000-8000-000000001505').eq('amount_centavos',567).single();assert.ifError(record.error);
  const row=page.locator('tbody tr').filter({hasText:'5.67'});await row.getByRole('button',{name:'Archive REQ-PHASE0-01505',exact:true}).click();await row.getByRole('button',{name:'Archive?',exact:true}).click();await range('Showing 1–1 of 1');
  const audit=await trusted.from('admin_audit_log').select('id').eq('entity_id',record.data.id).eq('action','delete');assert.ifError(audit.error);assert.ok(audit.data.length>0);
 });
 report.passed=report.errors.length===0;save();assert.ok(report.passed);
}catch(e){report.error=e.message;save();console.error(e);process.exitCode=1;}finally{await context.close();await browser.close();}



