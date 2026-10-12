import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
import {privateDir,statePath,sql} from './runtime-stack.mjs';
const require=createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('dist/admin-table-phase1-browsers');
const {chromium,firefox,webkit}=require('playwright');
const state=JSON.parse(fs.readFileSync(statePath,'utf8')),users=JSON.parse(fs.readFileSync(privateDir+'/users.json','utf8'));
const trusted=createClient(state.api,state.serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(15000)})}});
const report={passed:false,browsers:[],checks:[],failures:[],errors:[],limitations:['Refund provider endpoint is replaced with a synthetic successful submission; the browser uses the real confirmation read and audit action. No external payment provider is contacted.','Physical input, native Safari/Edge and manual screen-reader checks remain release work.'],timings:[]};
const save=()=>fs.writeFileSync(new URL('./acceptance.json',import.meta.url),JSON.stringify(report,null,2));
const fault=value=>fs.writeFileSync(path.join(privateDir,'faults.json'),JSON.stringify(value));
const sqlAsAdmin=query=>sql(`begin;set local role authenticated;set local request.jwt.claims='${JSON.stringify({sub:users.admin.id,role:'authenticated'})}';${query};rollback;`);
const check=async(label,run)=>{if(process.argv.includes('--actions-only') && !['request lifecycle','transaction edits'].some(text=>label.includes(text)))return;if(process.argv.includes('--remaining-only') && ['every advertised','concatenated','delayed rapid','query, summary','invalid pages','failed request'].some(text=>label.includes(text)))return;try{await run();report.checks.push(label);console.log('Passed: '+label);save();}catch(e){report.failures.push({label,message:e.message});save();throw e;}};
async function patch(table,id,values){const r=await trusted.from(table).update(values).eq('id',id).select('id');assert.ifError(r.error);assert.equal(r.data.length,1);}
async function login(page,user='admin'){
 await page.goto('http://127.0.0.1:3140/login',{timeout:60000});
 await page.waitForFunction(()=>Object.keys(document.querySelector('input[type=email]')??{}).some(k=>k.startsWith('__reactProps')));
 await page.locator('input[type=email]').fill(users[user].email);await page.locator('input[type=password]').fill(users[user].password);
 const notifications=page.waitForResponse(r=>r.url().includes('/rest/v1/admin_audit_log?')&&r.status()===200,{timeout:15000});
 await page.getByRole('button',{name:'Log In',exact:true}).click();await page.waitForURL('**/dashboard',{timeout:60000});await notifications;
}
async function ready(page){await page.waitForFunction(()=>document.querySelector('.table-browse-panel')?.getAttribute('aria-busy')==='false');await page.waitForFunction(()=>Object.keys(document.querySelector('input[type=search]')??{}).some(k=>k.startsWith('__reactProps')));}
async function go(page,route){await page.goto('http://127.0.0.1:3140'+route,{timeout:60000});await ready(page);}
const refs=async(page,route)=>page.locator(`tbody tr td:nth-child(${route==='requests'?1:2})`).allTextContents();
async function change(page,fn){const old=page.url();await fn();if(page.url()===old)await page.waitForURL(u=>u.toString()!==old);await ready(page);}
async function range(page,text){await page.waitForFunction(text=>document.querySelector('.table-browse-pagination')?.textContent.includes(text),text);await ready(page);}
async function editCell(page,cell,value){await cell.focus();await cell.press('Enter');await cell.locator('input,select').waitFor();await cell.locator('input').fill(value);}
const deadline=setTimeout(()=>{save();process.exit(1)},600000);
fault({});
try {
 for(const [engine,launch] of [['chrome',()=>chromium.launch({channel:'chrome',headless:true})],['firefox',()=>firefox.launch({headless:true})],['webkit',()=>webkit.launch({headless:true})]]) {
  if(process.argv.includes('--webkit-only') && engine!=='webkit')continue;
  if(process.argv.includes('--actions-only') && engine!=='chrome')continue;
  if(process.argv.includes('--matrix-only') && engine==='chrome')continue;
  const browser=await launch();report.browsers.push({engine,version:browser.version()});save();
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York'});
  await context.addInitScript(()=>{
   window.phase3={events:[],active:[],listeners:{}};const Native=window.WebSocket;
   window.WebSocket=class extends Native {
    constructor(...args){super(...args);this.addEventListener('message',e=>{try{const raw=JSON.parse(e.data),m=Array.isArray(raw)?{topic:raw[2],event:raw[3],payload:raw[4]}:raw;window.phase3.events.push({topic:m.topic,event:m.event,status:m.payload?.status});}catch{}});}
    send(data){try{const raw=JSON.parse(data),m=Array.isArray(raw)?{topic:raw[2],event:raw[3]}:raw;if(m.event==='phx_join')window.phase3.active.push(m.topic);if(m.event==='phx_leave')window.phase3.active=window.phase3.active.filter(t=>t!==m.topic);}catch{}return super.send(data);}
   };
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('requestfailed',r=>{report.networkFailures??=[];report.networkFailures.push({engine,path:new URL(r.url()).pathname,failure:r.failure()?.errorText,headerNames:Object.keys(r.headers())});save();});page.on('pageerror',e=>{report.errors.push({engine,message:e.message});save();});
  let refreshRequests=0;page.on('request',r=>{if(r.url().includes('/requests')&&r.headers().rsc==='1')refreshRequests++;});
  try {
   await login(page);
   for(const route of ['requests','transactions']) await check(engine+': '+route+' defaults, ranges, sort controls, scrolling and responsive access',async()=>{
    await go(page,'/'+route);
    assert.equal(await page.locator('tbody tr').count(),10);
    assert.deepEqual(await page.getByLabel('Rows per page').locator('option').allTextContents(),['10','20','30','50','100']);
    assert.equal(await page.getByLabel('Sort by',{exact:true}).inputValue(),route==='requests'?'reference':'created');
    assert.equal(await page.getByLabel('Direction',{exact:true}).inputValue(),route==='requests'?'asc':'desc');
    const tabs=page.getByRole('group',{name:route==='requests'?'Request status':'Payment status'});
    assert.equal(await tabs.getByRole('button').first().innerText(),'All');
    assert.equal(await tabs.getByRole('button',{name:route==='requests'?'Active':'All',exact:true}).getAttribute('aria-pressed'),'true');
    await change(page,()=>page.getByRole('button',{name:'Last',exact:true}).click());await range(page,'Showing 1501–1505 of 1505');assert.equal(await page.locator('tbody tr').count(),5);
    for(const size of ['20','30','50','100','10']) {await change(page,()=>page.getByLabel('Rows per page').selectOption(size));assert.equal(await page.locator('tbody tr').count(),Number(size));assert.equal(new URL(page.url()).searchParams.get('page'),'1');}
    const body=page.getByRole('region',{name:(route==='requests'?'Requests':'Transactions')+' rows and columns',exact:true});
    await body.focus();await body.press('ArrowRight');assert.ok(await body.evaluate(e=>e.scrollLeft)>0);await body.press('Tab');assert.ok(!await body.evaluate(e=>e===document.activeElement));
    await page.getByRole('button',{name:'Scroll columns right'}).click();assert.ok(await body.evaluate(e=>e.scrollLeft)>0);
    await body.evaluate(e=>{e.scrollTop=0;e.scrollLeft=0;});
    const widthBefore=await page.locator('thead th').first().evaluate(e=>e.getBoundingClientRect().width);
    const separator=page.getByRole('separator').first();await separator.focus();await separator.press('ArrowRight');const widthAfter=await page.locator('thead th').first().evaluate(e=>e.getBoundingClientRect().width);assert.ok(widthAfter>widthBefore);
    await change(page,()=>page.getByRole('button',{name:'Next',exact:true}).click());assert.ok(Math.abs(await page.locator('thead th').first().evaluate(e=>e.getBoundingClientRect().width)-widthAfter)<1);
    await page.setViewportSize({width:600,height:450});assert.ok(await page.locator('main').evaluate(e=>e.scrollWidth-e.clientWidth)<=1);await page.setViewportSize({width:1440,height:1000});
    await page.getByLabel('Search',{exact:true}).fill('Beyond Cap Needle');await range(page,'Showing 1–1 of 1');assert.equal(await page.locator('tbody tr').count(),1);assert.ok((await page.locator('tbody').innerText()).includes('Beyond Cap Needle'));
    await page.getByLabel('Search',{exact:true}).fill('no match fixture');await range(page,'Showing 0–0 of 0');assert.ok(await page.getByRole('button',{name:'Next',exact:true}).isDisabled());
    assert.ok(!(await page.locator('.table-browse-pagination').first().innerText()).includes('Page 1 of 0'));
    await page.screenshot({path:path.join(import.meta.dirname,engine+'-'+route+'-'+Date.now()+'.png')});
   });
   if(engine!=='chrome') continue;
   await check('Chrome: every advertised sort in both directions matches the database before paging',async()=>{
    for(const route of ['requests','transactions']) {
     await go(page,'/'+route+'?tab=all&pageSize=100');
     const sorts=await page.getByLabel('Sort by',{exact:true}).locator('option').evaluateAll(opts=>opts.map(o=>o.value));
     for(const sort of sorts) for(const dir of ['asc','desc']) {
      if(await page.getByLabel('Sort by',{exact:true}).inputValue()!==sort)await change(page,()=>page.getByLabel('Sort by',{exact:true}).selectOption(sort));
      if(await page.getByLabel('Direction',{exact:true}).inputValue()!==dir)await change(page,()=>page.getByLabel('Direction',{exact:true}).selectOption(dir));
      const field=route==='requests'?"row->>'reference_number'":"row#>>'{service_requests,reference_number}'";
      const expected=JSON.parse(sqlAsAdmin(`select json_agg(ref) from(select ${field} ref from admin_${route}_browse order by s_${sort} ${dir} nulls last,id asc limit 100)s`));
      assert.deepEqual((await refs(page,route)).map(t=>t.trim().replace(/^#/,'')),expected,route+': '+sort+' '+dir);
     }
    }
   });
   await check('Chrome: concatenated 1505-row pages on both routes have no gaps or duplicate records',async()=>{
    for(const route of ['requests','transactions']) {
     await go(page,'/'+route+'?tab=all&pageSize=100');
     const field=route==='requests'?"row->>'reference_number'":"row#>>'{service_requests,reference_number}'";
     const key=route==='requests'?'s_reference asc':'s_created desc';
     const expected=JSON.parse(sqlAsAdmin(`select json_agg(ref) from(select ${field} ref from admin_${route}_browse order by ${key} nulls last,id asc)s`));
     const combined=[];
     for(let i=1;i<=16;i++){combined.push(...(await refs(page,route)).map(t=>t.trim().replace(/^#/,'')));if(i<16)await change(page,()=>page.getByRole('button',{name:'Next',exact:true}).click());}
     assert.deepEqual(combined,expected);assert.equal(new Set(combined).size,1505);
    }
   });
   await check('Chrome: delayed rapid changes merge the draft, cancel history debounce and commit only the latest query',async()=>{
    await go(page,'/requests?tab=all&page=3');fault({delay:180});
    await page.getByLabel('Search',{exact:true}).fill('Beyond Cap');
    await page.getByLabel('Sort by',{exact:true}).selectOption('resident');
    await page.getByLabel('Direction',{exact:true}).selectOption('desc');
    await range(page,'Showing 1–1 of 1');
    const url=new URL(page.url());assert.equal(url.searchParams.get('q'),'Beyond Cap');assert.equal(url.searchParams.get('sort'),'resident');assert.equal(url.searchParams.get('dir'),'desc');assert.equal(url.searchParams.get('page'),'1');
    await page.getByLabel('Search',{exact:true}).fill('cancel this draft');await page.goBack();await ready(page);await page.waitForTimeout(400);assert.ok(!page.url().includes('cancel'));
    fault({});
   });
   await check('Chrome: query, summary and option failures are independent and retries retain the full query',async()=>{
    const query='/transactions?tab=all&q=REQ-PHASE0-01505&sort=amount&dir=asc&pageSize=20';
    fault({fail:['admin_transactions_browse']});await go(page,query);assert.equal(await page.getByRole('alert').filter({hasText:'Could not load table results'}).count(),1);assert.equal(await page.locator('tbody').count(),0);const original=page.url();fault({});await page.getByRole('button',{name:'Retry',exact:true}).click();await range(page,'Showing 1–1 of 1');assert.equal(page.url(),original);
    fault({fail:['admin_transactions_summary']});await go(page,query);assert.equal(await page.getByRole('button',{name:'Retry summary'}).count(),1);assert.equal(await page.locator('tbody tr').count(),1);fault({});await page.getByRole('button',{name:'Retry summary'}).click();await page.getByRole('button',{name:'Retry summary'}).waitFor({state:'hidden'});
    fault({options:true});await go(page,query);assert.equal(await page.getByRole('button',{name:'Retry options'}).count(),1);assert.ok(await page.getByRole('button',{name:'+ Add Transaction'}).isDisabled());assert.equal(await page.locator('tbody tr').count(),1);fault({});await page.getByRole('button',{name:'Retry options'}).click();await page.getByRole('button',{name:'Retry options'}).waitFor({state:'hidden'});
   });
   await check('Chrome: invalid pages are corrected once, including removal of the last matching row',async()=>{
    await go(page,'/transactions?q=REQ-PHASE0-01505&page=900000');await range(page,'Showing 1–1 of 1');await page.waitForURL(u=>u.searchParams.get('page')==='1');
    const before=refreshRequests;await page.waitForTimeout(400);assert.equal(refreshRequests,before);
   });
   // Capture state before mutations to retain a comparable complete browsing fixture.
   await check('Chrome: failed request save retains its draft, blocks navigation, then retries and audits the same record',async()=>{
    await go(page,'/requests?tab=all&q=REQ-PHASE0-01505');const cell=page.locator('tbody tr td').first();
    const deny=async route=>route.request().method()==='PATCH'?route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'Synthetic denied edit'})}):route.continue();
    await page.route('**/rest/v1/service_requests*',deny);await editCell(page,cell,'REQ-PILOT-EDIT');await cell.locator('input').press('Enter');await page.getByRole('button',{name:'Retry save'}).waitFor();assert.equal(await cell.locator('input').inputValue(),'REQ-PILOT-EDIT');
    const old=page.url();await page.getByLabel('Sort by',{exact:true}).selectOption('resident');await page.waitForTimeout(300);assert.equal(page.url(),old);assert.equal(await cell.locator('input').inputValue(),'REQ-PILOT-EDIT');
    await page.unroute('**/rest/v1/service_requests*',deny);await page.getByRole('button',{name:'Retry save'}).click();await range(page,'Showing 0–0 of 0');
    const changed=await trusted.from('service_requests').select('reference_number').eq('id','40000000-0000-4000-8000-000000001505').single();assert.ifError(changed.error);assert.equal(changed.data.reference_number,'REQ-PILOT-EDIT');
    const audit=await trusted.from('admin_audit_log').select('id').eq('entity_id','40000000-0000-4000-8000-000000001505').eq('action','update');assert.ifError(audit.error);assert.ok(audit.data.length>0);
    await patch('service_requests','40000000-0000-4000-8000-000000001505',{reference_number:'REQ-PHASE0-01505'});
   });
   await check('Chrome: request lifecycle actions refresh membership; legacy guards and v2 review stay intact',async()=>{
    await go(page,'/requests?q=REQ-PHASE0-01505');
    await page.getByRole('button',{name:'Move request REQ-PHASE0-01505 to processing',exact:true}).click();await range(page,'Showing 0–0 of 0');
    const record=await trusted.from('service_requests').select('status').eq('id','40000000-0000-4000-8000-000000001505').single();assert.equal(record.data.status,'in_progress');
    await go(page,'/requests?tab=processing&q=REQ-PHASE0-01505');await page.getByRole('button',{name:'Mark request REQ-PHASE0-01505 ready for pickup',exact:true}).click();await range(page,'Showing 0–0 of 0');
    sql(`set session_replication_role=replica;
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,reviewed_by,reviewed_at) values
('92000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000001504','10000000-0000-4000-8000-000000000001',1,'Fixture ID','fixture-front','fixture-back','verified','${users.admin.id}',now()) on conflict(id) do nothing;
update public.service_requests set contract_version=2,idempotency_key='92000000-0000-4000-8000-000000000002',submission_payload='{}',approved_id_submission_id='92000000-0000-4000-8000-000000000001',purpose_code='fixture',purpose_label='Fixture purpose',supporting_details='{}',timing_model='agency_minutes_v1',target_minutes_snapshot=60,sla_state='pre_processing',fee_assessment_state='pending',requirements_review_state='pending',pricing_mode_snapshot='fixed' where id='40000000-0000-4000-8000-000000001504';`);
    await go(page,'/requests?tab=all&q=REQ-PHASE0-01504');assert.equal(await page.getByRole('link',{name:'Review',exact:true}).getAttribute('href'),'/requests/40000000-0000-4000-8000-000000001504');assert.equal(await page.locator('tbody tr td').first().getAttribute('tabindex'),null);
    sql("set session_replication_role=replica;update public.service_requests set contract_version=1,idempotency_key=null,submission_payload=null,approved_id_submission_id=null,purpose_code=null,purpose_label=null,supporting_details=null,timing_model='legacy_hours',target_minutes_snapshot=null,sla_state='legacy',fee_assessment_state='legacy',requirements_review_state='legacy',pricing_mode_snapshot=null where id='40000000-0000-4000-8000-000000001504';");
   });
   await check('Chrome: transaction edits, paid amount guard, refund submission/retry/claim link and archive',async()=>{
    const id='50000000-0000-4000-8000-000000001505';
    await go(page,'/transactions?q=REQ-PHASE0-01505');const amount=page.locator('tbody tr td').nth(5);await editCell(page,amount,'12.34');await amount.locator('input').press('Enter');await page.waitForFunction(()=>document.querySelector('tbody tr td:nth-child(6)')?.textContent.includes('12.34'));
    await patch('payments',id,{method:'qrph',status:'paid',refund_status:'none',refund_transfer_link:null,paid_at:'2026-10-11T04:00:00Z'});await go(page,'/transactions?q=REQ-PHASE0-01505');assert.equal(await amount.getAttribute('tabindex'),null);
    await page.route('**/functions/v1/refund-payment',async route=>{
     const body=route.request().postDataJSON();assert.equal(body.paymentId,id);await patch('payments',id,{refund_status:'pending',refund_amount_centavos:1234,refund_reason:'requested_by_customer'});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({paymentId:id,status:'pending'})});
    });
    await page.getByRole('button',{name:'Refund REQ-PHASE0-01505',exact:true}).click();await page.getByRole('button',{name:'Refund full amount?',exact:true}).click();await page.getByText('Refund submitted to PayMongo — status will update once confirmed.',{exact:true}).waitFor();await ready(page);
    await patch('payments',id,{refund_status:'pending',refund_transfer_link:'https://example.invalid/fixture-refund'});await go(page,'/transactions?q=REQ-PHASE0-01505');assert.equal(await page.getByRole('link',{name:'Claim link',exact:true}).getAttribute('href'),'https://example.invalid/fixture-refund');await patch('payments',id,{refund_status:'failed'});await go(page,'/transactions?q=REQ-PHASE0-01505');await page.getByRole('button',{name:'Retry refund for REQ-PHASE0-01505',exact:true}).click();await page.getByRole('button',{name:'Refund?',exact:true}).click();await ready(page);
    await page.getByRole('button',{name:'Archive REQ-PHASE0-01505',exact:true}).click();await page.getByRole('button',{name:'Archive?',exact:true}).click();await range(page,'Showing 0–0 of 0');
    const archived=await trusted.from('payments').select('deleted_at').eq('id',id).single();assert.ok(archived.data.deleted_at);
    await patch('payments',id,{deleted_at:null,status:'pending',method:'pickup',amount_centavos:100,paid_at:null,refund_status:'none',refund_transfer_link:null});
   });
   sql("set session_replication_role=replica;update public.service_requests set status='submitted' where id='40000000-0000-4000-8000-000000001505';");
   await page.screenshot({path:path.join(import.meta.dirname,'chrome-final-'+Date.now()+'.png')});
  } finally {fault({});await page.waitForTimeout(500);await context.close();await browser.close();}
 }
 report.passed=report.failures.length===0 && report.errors.length===0;save();assert.ok(report.passed);
} catch(e) {report.failures.push({label:'run',message:e.message});save();console.error(e);process.exitCode=1;}
finally {fault({});clearTimeout(deadline);}

