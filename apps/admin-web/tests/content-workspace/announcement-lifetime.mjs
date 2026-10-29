// Actual publisher components, Supabase JS and audit action -> dedicated PostgREST -> disposable Docker DB.
// Only connection/session/routing adapters are supplied; production authentication UI is not exercised.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHmac,randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';

const root=process.cwd(),app=path.join(root,'apps/admin-web');
const evidence=path.join(root,'plans/evidence/resident-android-home-improvements/phase-1-2026-10-28');
const scratch=path.join(root,'tmp/resident-home-phase1-20261028/publisher');fs.mkdirSync(scratch,{recursive:true});
const database=process.env.HOME_REQUEST_TEST_DB;assert.match(database??'',/^resident_home_p1_\d{8}(?:_[a-z0-9]+)?$/u);
const visualOnly=process.argv.includes('--visual-only');
const docker=(args,options={})=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8*1024*1024,...options});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const query=sql=>docker(['exec','-i','supabase_db_barangayan','psql','-U','postgres','-d',database,'-X','-At','-v','ON_ERROR_STOP=1'],{input:sql});
const admin='b1490000-0000-4000-8000-000000000001',resident='b1490000-0000-4000-8000-000000000002';
const count=table=>Number(query(`select count(*) from ${table};`));
if(!visualOnly){assert.equal(count('public.profiles'),0);assert.equal(count('public.announcements'),0);}
else assert.equal(query('select title from public.announcements;'),'Synthetic updated advisory');
const beforeSchema=query("select count(*) from information_schema.columns where table_schema='public' and table_name='announcements' and column_name='alert_expires_at';");assert.equal(beforeSchema,visualOnly?'1':'0');
const seed=`begin;set local lock_timeout='5s';set local statement_timeout='60s';
${fs.readFileSync('supabase/migrations/0148_resident_home_request_priority.sql','utf8')}
${fs.readFileSync('supabase/migrations/0149_announcement_alert_expiry.sql','utf8')}
insert into public.barangays(id,name) values ('a1490000-0000-4000-8000-000000000001','Publisher synthetic A');
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values ('${admin}','publisher-admin@test.local','{}',now()),('${resident}','publisher-resident@test.local','{}',now());
insert into public.profiles(id,barangay_id,role,full_name) values ('${admin}','a1490000-0000-4000-8000-000000000001','admin','Publisher synthetic admin'),('${resident}','a1490000-0000-4000-8000-000000000001','resident','Publisher synthetic resident');
commit;`;
if(!visualOnly)query(seed);
const existing=JSON.parse(docker(['inspect','supabase_rest_barangayan']))[0];
const envs=Object.fromEntries(existing.Config.Env.map(item=>{const at=item.indexOf('=');return [item.slice(0,at),item.slice(at+1)];}));
assert.ok(envs.PGRST_DB_URI);const uri=new URL(envs.PGRST_DB_URI);uri.pathname='/'+database;
const secret=randomBytes(32).toString('hex');
const token=(role,sub)=>{const body=[{alg:'HS256',typ:'JWT'},{role,sub,aud:'authenticated',exp:Math.floor(Date.now()/1000)+1800}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');};
const adminToken=token('authenticated',admin),residentToken=token('authenticated',resident),anonToken=token('anon',undefined);
const container='resident-home-p1-rest-'+Date.now();let restStarted=false,server,browser;
const report={checks:[],errors:[],expectedDiagnostics:[],limitations:['Synthetic local session/connection/routing adapters; actual publisher, Supabase JS, audit action, PostgreSQL RLS and event triggers. No production login or hosted access.']};
let writeMode='normal',writes=0,auditAction,js,css,page;
const counts=()=>Object.fromEntries(['public.announcements','public.admin_audit_log','public.announcement_reads','public.notification_inbox','barangayan_private.notification_events','barangayan_private.notification_outbox','barangayan_private.notification_deliveries'].map(t=>[t,count(t)]));
try {
  docker(['run','--detach','--rm','--pull=never','--name',container,'--network','supabase_network_barangayan','-p','127.0.0.1::3000','-e','PGRST_DB_URI','-e','PGRST_JWT_SECRET','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_CONFIG=false',existing.Config.Image],{env:{...process.env,PGRST_DB_URI:uri.href,PGRST_JWT_SECRET:secret}});restStarted=true;
  const port=JSON.parse(docker(['inspect',container]))[0].NetworkSettings.Ports['3000/tcp'][0].HostPort;
  const rest='http://127.0.0.1:'+port;
  // Finite readiness wait (no failure retries in production code).
  let ready=false;for(let attempt=0;attempt<20;attempt++){try{const response=await fetch(rest+'/announcements?select=id',{headers:{Authorization:'Bearer '+adminToken}});if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}assert.ok(ready,'Isolated PostgREST did not start');
  server=http.createServer(async(req,res)=>{
    try {
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
      if(req.url.startsWith('/rest/v1/')) {
        const mutating=['POST','PATCH'].includes(req.method)&&req.url.includes('/announcements');
        const headers={...req.headers};delete headers.host;delete headers['content-length'];
        if(mutating){writes++;if(writeMode==='deny'){headers.authorization='Bearer '+residentToken;writeMode='normal';}else if(writeMode==='server-error'){writeMode='normal';res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({message:'Service temporarily unavailable'}));return;}await new Promise(resolve=>setTimeout(resolve,120));}
        const response=await fetch(rest+req.url.slice('/rest/v1'.length),{method:req.method,headers,body:body.length?body:undefined});
        res.writeHead(response.status,{'content-type':response.headers.get('content-type')??'application/json'});res.end(Buffer.from(await response.arrayBuffer()));
      }else if(req.url==='/auth/v1/user'){
        assert.equal(req.headers.authorization,'Bearer '+adminToken);res.setHeader('content-type','application/json');res.end(JSON.stringify({id:admin,aud:'authenticated',role:'authenticated',email:'publisher-admin@test.local',app_metadata:{},user_metadata:{}}));
      }else if(req.url==='/audit'){
        assert.equal(req.headers.authorization,'Bearer '+adminToken);await auditAction(JSON.parse(body.toString()));res.setHeader('content-type','application/json');res.end('{}');
      }else if(req.url==='/fixture.js'){res.setHeader('content-type','text/javascript');res.end(js);}
      else if(req.url==='/fixture.css'){res.setHeader('content-type','text/css');res.end(css);}
      else if(req.url==='/favicon.ico'){res.writeHead(204);res.end();}
      else{res.setHeader('content-type','text/html');res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Publisher lifetime integration</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script>globalThis.__publisherConnection=${JSON.stringify({anonToken,adminToken})}</script><script src="/fixture.js"></script></body></html>`);}
    }catch(error){report.errors.push(error.message);res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({message:'Integration test server failed'}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
  process.env.PUBLISHER_TEST_URL=url;process.env.PUBLISHER_TEST_ANON=anonToken;process.env.PUBLISHER_TEST_ADMIN=adminToken;
  const actionFile=path.join(scratch,'audit.mjs');
  await build({entryPoints:['apps/admin-web/src/actions/admin-audit-actions.ts'],outfile:actionFile,bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'local-audit-session',setup(b){b.onResolve({filter:/^@\/lib\/supabase\/server$/},()=>({path:'server',namespace:'local'}));b.onLoad({filter:/.*/,namespace:'local'},()=>({contents:`import {createClient} from '@supabase/supabase-js';export async function createSupabaseServerClient(){const c=createClient(process.env.PUBLISHER_TEST_URL,process.env.PUBLISHER_TEST_ANON,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+process.env.PUBLISHER_TEST_ADMIN}}});return {from:c.from.bind(c),auth:{getUser:()=>c.auth.getUser(process.env.PUBLISHER_TEST_ADMIN)}};}`,resolveDir:root}));}}]});
  auditAction=(await import(pathToFileURL(actionFile).href)).logAdminAction;
  const appRequire=createRequire(path.join(app,'package.json'));
  const bundle=await build({entryPoints:[path.join(import.meta.dirname,'announcement-lifetime.jsx')],bundle:true,write:false,outdir:'fixture',jsx:'automatic',tsconfig:path.join(app,'tsconfig.json'),define:{'process.env.NODE_ENV':'"development"'},alias:{react:path.dirname(appRequire.resolve('react/package.json')),'react-dom':path.dirname(appRequire.resolve('react-dom/package.json'))},plugins:[{name:'local-publisher-session',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'fixture'}));b.onResolve({filter:/^@\/lib\/supabase\/client$/},()=>({path:'client',namespace:'fixture'}));b.onResolve({filter:/^@\/actions\/admin-audit-actions$/},()=>({path:'audit',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='router'?`export const useRouter=()=>({refresh(){window.dispatchEvent(new Event('publisher-refresh'));}});`:args.path==='audit'?`export async function logAdminAction(value){const r=await fetch('/audit',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+globalThis.__publisherConnection.adminToken},body:JSON.stringify(value)});if(!r.ok)throw new Error('Audit rejected');}`:`import {createClient} from '@supabase/supabase-js';const c=createClient(location.origin,globalThis.__publisherConnection.anonToken,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:'Bearer '+globalThis.__publisherConnection.adminToken}}});export const createSupabaseBrowserClient=()=>c;`,resolveDir:root}));}}]});
  js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents;
  const globals=path.join(app,'src/app/globals.css');css=(await postcss([tailwind({base:app})]).process(fs.readFileSync(globals,'utf8'),{from:globals})).css+'\n'+bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
  const executable=['C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe','C:/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe'].find(fs.existsSync);assert.ok(executable,'Brave is required');
  browser=await chromium.launch({executablePath:executable,headless:true});report.browser=await browser.version();
  page=await browser.newPage({viewport:{width:1280,height:900},timezoneId:'Asia/Manila'});page.setDefaultTimeout(10000);
  page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(['error','warning'].includes(message.type())){if(message.text().includes('503 (Service Unavailable)'))report.expectedDiagnostics.push(message.text());else report.errors.push(message.text());}});
  await page.goto(url);
  if(visualOnly){
    await page.getByRole('button',{name:'Edit Synthetic updated advisory',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Edit announcement',exact:true});await dialog.waitFor();
    for(const [width,dark,font] of [[1280,false,'Arial, sans-serif'],[390,true,'Georgia, serif'],[320,false,'Arial, sans-serif']]){
      await page.setViewportSize({width,height:800});await page.evaluate(({dark,font})=>{document.documentElement.classList.toggle('dark',dark);document.documentElement.style.setProperty('--accent','#6854b8');document.documentElement.style.setProperty('--font-app',font);},{dark,font});
      const bounds=await dialog.getByLabel(/^Advisory expires at/).boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1);
      assert.notEqual(await dialog.locator('section[data-visible]').evaluate(element=>getComputedStyle(element).backgroundColor),'rgba(0, 0, 0, 0)');
      await page.screenshot({path:path.join(evidence,`publisher-${width}-${dark?'dark':'light'}.png`)});
    }
    assert.equal(writes,0);assert.equal(report.errors.length,0);report.checks.push('read-only theme/layout review with actual workspace surface variables');report.pass=true;
  }else{
  await page.getByRole('button',{name:'Create announcement',exact:true}).click();let dialog=page.getByRole('dialog',{name:'New announcement',exact:true});await dialog.waitFor();
  await dialog.getByLabel('Title',{exact:true}).fill('Synthetic lifetime advisory');await dialog.getByLabel('Body',{exact:true}).fill('Synthetic guidance for isolated integration only.');
  await dialog.getByRole('combobox').click();await page.getByRole('option',{name:'Emergency',exact:true}).click();
  await dialog.getByLabel('Publish At (optional)',{exact:true}).fill('2026-10-28T12:00');const expiry=dialog.getByLabel(/^Advisory expires at/);
  await expiry.fill('2026-10-27T12:00');await dialog.getByRole('button',{name:'Publish Announcement',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'after publication'}).waitFor();assert.equal(count('public.announcements'),0);report.checks.push('invalid ordering rejected before write');
  await expiry.fill('2026-10-29T12:00');await dialog.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  await page.getByRole('button',{name:'Edit Synthetic lifetime advisory',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('form[aria-busy="true"]'));await new Promise(resolve=>setTimeout(resolve,200));
  let state=counts();assert.equal(state['public.announcements'],1);assert.equal(state['public.admin_audit_log'],1);assert.equal(writes,1);assert.equal(state['barangayan_private.notification_events'],1);assert.equal(state['public.announcement_reads'],0);
  let row=JSON.parse(query("select row_to_json(a) from public.announcements a;"));assert.equal(new Date(row.alert_expires_at).toISOString(),'2026-10-29T04:00:00.000Z');const id=row.id;report.checks.push('double create writes once with actual audit, UTC expiry and one insert fanout');
  // The existing create sheet retains its draft surface after publishing; close it explicitly.
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Edit Synthetic lifetime advisory',exact:true}).click();dialog=page.getByRole('dialog',{name:'Edit announcement',exact:true});await dialog.waitFor();await dialog.getByLabel('Title',{exact:true}).fill('Synthetic updated advisory');await dialog.getByLabel(/^Advisory expires at/).fill('2026-10-30T13:15:22.125');
  writeMode='deny';await dialog.getByRole('button',{name:'Save Changes',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'permission'}).waitFor();assert.equal(count('public.admin_audit_log'),1);assert.equal(query(`select title from public.announcements where id='${id}';`),'Synthetic lifetime advisory');report.checks.push('RLS-denied edit retains draft and produces no false success/audit');
  writeMode='server-error';await dialog.getByRole('button',{name:'Save Changes',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Service temporarily unavailable'}).waitFor();assert.equal(count('public.admin_audit_log'),1);report.checks.push('server error remains visible with retained draft');
  await dialog.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await page.getByRole('button',{name:'Edit Synthetic updated advisory',exact:true}).waitFor();await new Promise(resolve=>setTimeout(resolve,200));
  row=JSON.parse(query("select row_to_json(a) from public.announcements a;"));assert.equal(row.id,id);assert.equal(new Date(row.alert_expires_at).toISOString(),'2026-10-30T05:15:22.125Z');assert.equal(count('public.admin_audit_log'),2);assert.equal(count('barangayan_private.notification_events'),1);assert.equal(count('barangayan_private.notification_outbox'),state['barangayan_private.notification_outbox']);assert.equal(count('public.announcement_reads'),0);report.checks.push('double edit saves once, preserves ID and records expiry before/after without fanout');
  await page.getByRole('button',{name:'Edit Synthetic updated advisory',exact:true}).click();dialog=page.getByRole('dialog',{name:'Edit announcement',exact:true});await dialog.waitFor();
  await dialog.getByRole('combobox').click();await page.getByRole('option',{name:'Health',exact:true}).click();await dialog.getByRole('button',{name:'Save Changes',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Clear advisory expiry'}).waitFor();
  for(const [width,dark,font] of [[1280,false,'Arial, sans-serif'],[390,true,'Georgia, serif'],[320,false,'Arial, sans-serif']]){await page.setViewportSize({width,height:800});await page.evaluate(({dark,font})=>{document.documentElement.classList.toggle('dark',dark);document.documentElement.style.setProperty('--accent','#6854b8');document.documentElement.style.setProperty('--font-app',font);},{dark,font});const bounds=await dialog.getByLabel(/^Advisory expires at/).boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1);await page.screenshot({path:path.join(evidence,`publisher-${width}-${dark?'dark':'light'}.png`)});}report.checks.push('expiry field fits 1280/390/320 light/dark and inherited fonts/accents');
  await dialog.getByLabel(/^Advisory expires at/).fill('');await dialog.getByRole('button',{name:'Save Changes',exact:true}).click();await dialog.waitFor({state:'hidden'});await new Promise(resolve=>setTimeout(resolve,200));row=JSON.parse(query("select row_to_json(a) from public.announcements a;"));assert.equal(row.category,'health');assert.equal(row.alert_expires_at,null);assert.equal(count('public.admin_audit_log'),3);report.checks.push('explicitly clearing expiry permits ordinary category');
  report.finalCounts=counts();report.rowId=id;report.writes=writes;report.audit=JSON.parse(query("select json_agg(json_build_object('action',action,'entity_id',entity_id,'changes',changes,'metadata',metadata) order by created_at) from public.admin_audit_log;"));
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.pass=true;
  }
}finally{
  if(page&&!report.pass){report.visibleAlerts=await page.getByRole('alert').allTextContents();await page.screenshot({path:path.join(evidence,'publisher-integration-failure.png')});}
  if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
  if(restStarted){fs.writeFileSync(path.join(evidence,'publisher-rest.log'),docker(['logs',container]));docker(['stop',container]);}
  fs.writeFileSync(path.join(evidence,visualOnly?'publisher-visual.json':'publisher-integration.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify({pass:report.pass,checks:report.checks,browser:report.browser,errors:report.errors}));
