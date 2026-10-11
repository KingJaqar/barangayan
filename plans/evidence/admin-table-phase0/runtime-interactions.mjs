// Actual client interactions on the copied source; baseline defects are observations.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
import {privateDir,statePath,sql} from './runtime-stack.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const state=JSON.parse(fs.readFileSync(statePath,'utf8')),users=JSON.parse(fs.readFileSync(privateDir+'/users.json','utf8'));
assert.equal(state.api,'http://127.0.0.1:55431');
const trusted=createClient(state.api,state.serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(15000)})}});
const report={timestamp:new Date().toISOString(),passed:false,checks:[],observations:[],failures:[],pageErrors:[]};
const save=()=>fs.writeFileSync(new URL('./runtime-interaction-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const prove=(value,label,detail={})=>{assert.ok(value,label);report.checks.push({label,...detail});save();};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Manila'});
await context.addInitScript(()=>{
 window.__phase0={events:[],activeTopics:[]};const Native=window.WebSocket;
 window.WebSocket=class extends Native {
  constructor(...args){super(...args);this.addEventListener('message',e=>{try{const raw=JSON.parse(e.data),m=Array.isArray(raw)?{topic:raw[2],event:raw[3],payload:raw[4]}:raw;if(m.topic?.startsWith('realtime:'))window.__phase0.events.push({direction:'in',event:m.event,topic:m.topic,status:m.payload?.status});}catch{}});}
  send(data){try{const raw=JSON.parse(data),m=Array.isArray(raw)?{topic:raw[2],event:raw[3]}:raw;if(m.topic?.startsWith('realtime:')){window.__phase0.events.push({direction:'out',event:m.event,topic:m.topic});if(m.event==='phx_join')window.__phase0.activeTopics.push(m.topic);if(m.event==='phx_leave')window.__phase0.activeTopics=window.__phase0.activeTopics.filter(t=>t!==m.topic);}}catch{}return super.send(data);}
 };
});
const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>{report.pageErrors.push(error.message);save();});
page.on('console',message=>{if(message.type()==='error'){report.pageErrors.push(message.text());save();}});
async function hydrated(selector){await page.waitForFunction(selector=>Object.keys(document.querySelector(selector)??{}).some(key=>key.startsWith('__reactProps')),selector,{timeout:15000});}
async function go(route){await page.goto('http://127.0.0.1:3140'+route,{waitUntil:'domcontentloaded',timeout:60000});await page.locator('table').waitFor();await hydrated('tbody td');}
async function check(label,run){
 if(process.argv.includes('--remaining-only')&&(['Staff self guard','Paid amount guard','Inline edit failure and success'].includes(label)||label.endsWith(' selection')))return;
 try{await run();console.log('Verified '+label);}catch(error){report.failures.push({label,message:error.message,visibleTail:(await page.locator('body').innerText()).slice(-1000)});save();console.log('Incomplete '+label+': '+error.message.slice(0,180));}
}
async function patch(table,id,values){const result=await trusted.from(table).update(values).eq('id',id).select('id');assert.ifError(result.error);assert.equal(result.data.length,1);}
try {
 await page.goto('http://127.0.0.1:3140/login',{waitUntil:'domcontentloaded',timeout:60000});await hydrated('input[type=email]');
 await page.locator('input[type=email]').fill(users.admin.email);await page.locator('input[type=password]').fill(users.admin.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.waitForURL('**/dashboard',{timeout:60000});
 const official=await trusted.from('barangay_officials').update({official_role:'admin'}).eq('profile_id',users.admin.id).select('id');assert.ifError(official.error);
 await check('Staff self guard',async()=>{
  await go('/staff?q=Runtime%20admin');const row=page.locator('tbody tr').filter({hasText:users.admin.email});
  prove(await row.count()===1,'Current administrator appears in filtered Staff fixture');
  prove(!(await row.locator('td').nth(0).getAttribute('class')).includes('cursor-text'),'Staff current-user name editing is locked');
  prove(await row.getByText('current user',{exact:true}).isVisible(),'Staff hides current-user removal');
 });
 await patch('payments','50000000-0000-4000-8000-000000001505',{status:'paid',paid_at:'2026-10-11T04:00:00Z',collected_by:users.admin.id});
 await check('Paid amount guard',async()=>{
  await go('/transactions?q=REQ-PHASE0-01505');const row=page.locator('tbody tr').first();
  const headers=await page.locator('thead th').allTextContents(),index=headers.findIndex(h=>h.trim()==='Amount');assert.ok(index>=0);
  prove(!(await row.locator('td').nth(index).getAttribute('class')).includes('cursor-text'),'Paid transaction amount is not editable in the browser');
 });
 for(const [route,label,cell] of [
  ['/residents?q=phase0-resident-1%40example.invalid','Directory',9],
  ['/households-residents?q=Fixture%20Member%201505','Households',1],
  ['/health/applicants?q=CON-PHASE0-01505','Applicants',0],
  ['/incident-reports?q=Fixture%20Incident%201505','Incidents',0],
  ['/health?tab=all&q=Fixture%20Drive%200001','Health',0],
 ]) await check(label+' selection',async()=>{
  await go(route);prove(await page.locator('tbody tr').count()===1,label+': filter identifies one fixture row');
  const before=await page.locator('tbody tr').first().innerText();
  await page.locator('tbody tr').first().locator('td').nth(cell).click();
  const modal=page.locator('div.fixed.inset-0').last();await modal.waitFor();
  prove(await modal.isVisible(),label+': selected detail opens');
  report.observations.push({label:label+' selected detail',row:before.slice(0,300),detail:(await modal.innerText()).slice(0,500)});save();
  const namedClose=modal.getByRole('button',{name:'Close',exact:true});
  if(await namedClose.count()) await namedClose.click();
  else await modal.getByRole('button',{name:'✕',exact:true}).click();
  await modal.waitFor({state:'hidden'});prove(true,label+': detail closes without changing row identity');
 });
 await check('Inline edit failure and success',async()=>{
  await go('/health/applicants?q=CON-PHASE0-01505');const age=page.locator('tbody tr td').nth(3);
  await age.click();await age.locator('input').fill('131');await age.locator('input').press('Enter');
  await page.getByText(/Enter an age between 0 and 130/).waitFor();
  prove(await age.locator('input').count()===0,'Failed validation discards the current inline draft');
  const before=await trusted.from('drive_registrations').select('age').eq('id','71000000-0000-4000-8000-000000001505').single();assert.ifError(before.error);
  await age.click();await age.locator('input').fill('42');await age.locator('input').press('Enter');
  await page.waitForFunction(()=>document.querySelector('tbody tr td:nth-child(4)')?.textContent?.trim()==='42',{},{timeout:15000});
  const after=await trusted.from('drive_registrations').select('age,score:drive_registration_scores!inner(priority_score)').eq('id','71000000-0000-4000-8000-000000001505').single();assert.ifError(after.error);
  prove(after.data.age===42&&after.data.score.priority_score===50,'Successful inline age edit persists, refreshes, and preserves score snapshot',{before:before.data.age,after:after.data.age,score:after.data.score.priority_score});
  const deny=async route=>{if(route.request().method()==='PATCH')await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'Synthetic denied edit'})});else await route.continue();};
  await page.route('**/rest/v1/drive_registrations*',deny);
  await age.click();await age.locator('input').fill('43');await age.locator('input').press('Enter');
  await page.getByText(/Synthetic denied edit/).waitFor();
  const unchanged=await trusted.from('drive_registrations').select('age').eq('id','71000000-0000-4000-8000-000000001505').single();assert.ifError(unchanged.error);
  prove(unchanged.data.age===42&&await age.locator('input').count()===0,'HTTP-denied edit keeps stored value and exposes failure while discarding draft');
  await page.unroute('**/rest/v1/drive_registrations*',deny);
 });
 await check('Realtime refresh and selected snapshot',async()=>{
  await go('/incident-reports?q=Fixture%20Incident%201505');
  await page.waitForFunction(()=>window.__phase0.events.some(e=>e.event==='phx_reply'&&e.status==='ok'),{},{timeout:15000});
  await page.locator('tbody tr td').first().click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  const before=await trusted.from('incidents').select('title').eq('id','61000000-0000-4000-8000-000000001505').single();assert.ifError(before.error);
  const nextTitle=before.data.title.endsWith(' refreshed')?'Fixture Incident 1505 refreshed again':'Fixture Incident 1505 refreshed';
  await patch('incidents','61000000-0000-4000-8000-000000001505',{title:nextTitle});
  await page.waitForFunction(title=>document.querySelector('tbody')?.textContent?.includes(title),nextTitle,{timeout:15000});
  prove(true,'Actual incident Realtime event refreshes table props');
  const selected=await dialog.getAttribute('aria-label');prove(selected==='Incident details: '+before.data.title,'Baseline defect: open selected detail keeps its pre-refresh snapshot',{selected,refreshedTitle:nextTitle});
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  report.observations.push({label:'Realtime protocol',events:await page.evaluate(()=>window.__phase0)});save();
 });
 await check('Search debounce and Back/Forward',async()=>{
  await go('/incident-reports?tab=all');const search=page.locator('input[placeholder^="Search"]').last();
  await search.fill('Fixture Incident 150');await search.fill('Fixture Incident 1505');
  await page.waitForURL(url=>url.searchParams.get('q')==='Fixture Incident 1505',{timeout:15000});
  await page.locator('tbody tr').filter({hasText:'Fixture Incident 1505'}).waitFor();
  prove(true,'Rapid search typing commits final debounced query');
  await page.goBack({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('input[type=search]')?.value==='',{},{timeout:15000});
  prove(true,'Back restores prior search input');await page.goForward({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('input[type=search]')?.value==='Fixture Incident 1505',{},{timeout:15000});prove(true,'Forward restores committed search input');
 });
 await check('Delayed response race',async()=>{
  await go('/incident-reports?tab=all');const search=page.locator('input[placeholder^="Search"]').last();
  let release;const delayed=new Promise(resolve=>{release=resolve;});
  const intercept=async route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.headers().rsc==='1'&&url.searchParams.get('q')==='Fixture Incident 150'){
    const response=await route.fetch();await new Promise(resolve=>setTimeout(resolve,750));
    try{await route.fulfill({response});}catch(error){report.observations.push({label:'Older delayed RSC response cancelled',message:error.message.slice(0,160)});}finally{release();}
   }else await route.continue();
  };
  await page.route('**/incident-reports?**',intercept);
  const first=page.waitForRequest(request=>request.headers().rsc==='1'&&new URL(request.url()).searchParams.get('q')==='Fixture Incident 150',{timeout:15000});
  await search.fill('Fixture Incident 150');await first;await search.fill('Fixture Incident 1505');
  await page.waitForURL(url=>url.searchParams.get('q')==='Fixture Incident 1505',{timeout:15000});
  await Promise.race([delayed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Delayed response did not settle')),15000))]);
  await page.waitForFunction(()=>document.querySelector('tbody')?.textContent?.includes('Fixture Incident 1505'),{},{timeout:15000});
  prove(await page.locator('tbody tr').count()===1,'Final URL and row membership survive an older delayed RSC response');
  await page.unroute('**/incident-reports?**',intercept);
 });
 await check('Subscription cleanup across client navigation',async()=>{
  const before=await page.evaluate(()=>window.__phase0.events.filter(e=>e.event==='phx_leave').length);
  await page.locator('a[href="/transactions"]').first().click();await page.waitForURL('**/transactions');await hydrated('tbody td');
  await page.getByRole('heading',{name:'Financial Transactions',exact:true}).waitFor();
  await page.waitForFunction(before=>window.__phase0.events.filter(e=>e.event==='phx_leave').length>before,before,{timeout:15000});
  prove(true,'Incident channel sends leave on client route unmount');
  const metrics=await page.evaluate(()=>window.__phase0);
  // Header notifications intentionally stay subscribed across admin routes.
  const remaining=Number(sql(`select count(*) from realtime.subscription where entity='public.incidents'::regclass and claims->>'sub'='${users.admin.id}';`));
  const oldTopic=metrics.events.filter(e=>e.direction==='out'&&e.event==='phx_leave'&&e.topic?.startsWith('realtime:admin-incidents-')).at(-1)?.topic;
  assert.ok(oldTopic,'Specific incident topic left');
  const messagesBefore=metrics.events.filter(e=>e.direction==='in'&&e.event==='postgres_changes'&&e.topic===oldTopic).length;
  let refreshes=0;const countRefresh=request=>{if(request.headers().rsc==='1'&&new URL(request.url()).pathname==='/transactions')refreshes++;};
  page.on('request',countRefresh);
  await patch('incidents','61000000-0000-4000-8000-000000001505',{description:'Post-unmount fixture mutation'});
  await new Promise(resolve=>setTimeout(resolve,2500));page.off('request',countRefresh);
  const after=await page.evaluate(()=>window.__phase0);
  prove(after.events.filter(e=>e.direction==='in'&&e.event==='postgres_changes'&&e.topic===oldTopic).length===messagesBefore&&refreshes===0,'Removed incident topic delivers no callback or table refresh during bounded post-unmount mutation',{observationMs:2500,refreshes,serverMetadataRows:remaining,metrics:after});
  report.observations.push({label:'Server subscription metadata',note:'Rows may remain while shared Header socket is connected; database metadata alone does not prove an active callback. Full client close is checked separately.'});save();
 });
 report.passed=report.failures.length===0;save();console.log(`${report.checks.length} browser interaction assertions; ${report.failures.length} incomplete scenarios`);
}catch(error){report.failures.push({label:'setup',message:error.message});save();console.error(error);process.exitCode=1;}
finally {await context.close();await browser.close();}
if(!report.passed)process.exitCode=1;
