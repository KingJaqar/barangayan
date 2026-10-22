import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const root=process.cwd(), work=path.join(root,'tmp/family-web-phase4-20261022');
const app=path.join(root,'apps/resident-web'), require=createRequire(path.join(root,'apps/admin-web/package.json'));
const { chromium }=require('playwright');
const port=fs.readFileSync(path.join(work,'rest-port.txt'),'utf8').trim();
const token=process.env.ATTENDANCE_TEST_TOKEN, admin=process.env.ATTENDANCE_ADMIN_TEST_TOKEN;
assert(token && admin);
const out=path.join(root,'plans/evidence/family-web-qr-attendance/phase-4-2026-10-22');
const report={checks:[],consoleErrors:[],calls:[],browser:'',limitations:['Synthetic Auth on loopback with actual components and real PostgREST/PostgreSQL; physical camera and deployed login/navigation remain manual.']};
const bundle=await build({entryPoints:[path.join(work,'browser-fixture.tsx')],bundle:true,write:false,outdir:'fixture',format:'esm',jsx:'automatic',
  define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},alias:{react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json'))},
  tsconfig:path.join(app,'tsconfig.json'),plugins:[{name:'local-auth',setup(b){b.onResolve({filter:/^@\/lib\/supabase\/client$/},()=>({path:path.join(work,'browser-client.ts')}));}}]});
const cssPath=path.join(app,'src/app/globals.css');
const css=(await postcss([tailwind({base:app})]).process(fs.readFileSync(cssPath,'utf8'),{from:cssPath})).css;
const decoder=await build({stdin:{contents:"export { Html5Qrcode } from 'html5-qrcode';",resolveDir:app},bundle:true,write:false,format:'esm'});
let malformed=false,failAttendance=false,dropSave=false,emptySave=false,holdSave=false;
const server=http.createServer(async(req,res)=>{
  try {
    if(req.url==='/fixture.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents);return;}
    if(req.url==='/decoder.js'){res.setHeader('content-type','text/javascript');res.end(decoder.outputFiles[0].contents);return;}
    if(req.url==='/fixture.css'){res.setHeader('content-type','text/css');res.end(css+(bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text??''));return;}
    if(req.url?.startsWith('/auth/v1/user')){
      const subject=JSON.parse(Buffer.from(req.headers.authorization.split('.')[1],'base64url').toString()).sub;
      res.setHeader('content-type','application/json');res.end(JSON.stringify({id:subject,aud:'authenticated',role:'authenticated',email:'synthetic@test.local',app_metadata:{},user_metadata:{},created_at:'2026-10-22T00:00:00Z'}));return;
    }
    if(req.url?.startsWith('/auth/v1/logout')){res.writeHead(204);res.end();return;}
    if(req.url?.startsWith('/rest/v1/')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
      report.calls.push({path:req.url,method:req.method,body:body.length?JSON.parse(body.toString()):null});
      if(failAttendance && req.url.includes('get_my_household_attendance')){failAttendance=false;res.writeHead(503,{'content-type':'application/json'});res.end('{"message":"synthetic failure"}');return;}
      const headers={...req.headers};delete headers.host;delete headers['content-length'];
      const result=await fetch(`http://127.0.0.1:${port}/`+req.url.slice('/rest/v1/'.length),{method:req.method,headers,body:body.length?body:undefined});let value=await result.text();
      if(malformed && req.url.includes('/profiles?')){malformed=false;value=JSON.stringify({...JSON.parse(value),household_members:[{name:'broken',relation:'Child'}]});}
      if(req.url.includes('save_resident_household_if_unchanged')){
        if(holdSave){holdSave=false;await new Promise(r=>setTimeout(r,17000));}
        if(emptySave){emptySave=false;value='null';}
        if(dropSave){dropSave=false;res.writeHead(503,{'content-type':'application/json'});res.end('{"message":"committed response unavailable","code":"test"}');return;}
      }
      res.writeHead(result.status,{'content-type':result.headers.get('content-type')??'application/json','cache-control':'no-store'});res.end(value);return;
    }
    if(req.url?.startsWith('/functions/'))throw Error('Retired image endpoint called');
    res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');
  }catch(e){report.fixtureError=String(e);res.writeHead(500);res.end('Fixture error');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`, url=base+'/#'+token;
const id='dfb21000-0000-4000-8000-000000000002', center='efb21000-0000-4000-8000-000000000001';
const rpc=async(name,body,key=admin)=>{
  const response=await fetch(`http://127.0.0.1:${port}/rpc/${name}`,{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();assert(response.ok,JSON.stringify(data));return data;
};
const writes=()=>report.calls.filter(c=>c.path.includes('save_resident_household_if_unchanged'));
const check=text=>report.checks.push(text);
let browser,page;
try {
  browser=await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true});report.browser=await browser.version();
  page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(15000);
  const watch=p=>{p.on('pageerror',e=>report.consoleErrors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR/.test(m.text()))report.consoleErrors.push(m.text());});};watch(page);
  await page.goto(url);await page.getByText('3 people',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-household-attendance]').count(),3);
  assert.equal(await page.getByText('No recorded check-in',{exact:true}).count(),3);
  const idle=report.calls.length;await page.waitForTimeout(700);assert.equal(report.calls.length,idle);check('StrictMode entry and idle have stable request counts; holder included, no false attendance');
  await page.getByRole('button',{name:/Show My Code/}).click();await page.getByRole('img',{name:'Household QR code'}).waitFor();
  const png=await page.getByRole('img',{name:'Household QR code'}).screenshot();fs.writeFileSync(path.join(out,'resident-qr.png'),png);
  await page.screenshot({path:path.join(out,'family-qr-desktop.png'),fullPage:true});
  const qr=await page.locator('canvas').evaluate(async(canvas)=>{
    const {Html5Qrcode}=await import('/decoder.js');const host=document.createElement('div');host.id='decode-test';document.body.append(host);
    const scanner=new Html5Qrcode(host.id);const blob=await new Promise(resolve=>canvas.toBlob(resolve));const result=await scanner.scanFile(new File([blob],'family.png',{type:'image/png'}),false);scanner.clear();host.remove();return result;
  });
  report.decoded=qr;
  assert.deepEqual(JSON.parse(qr),{type:'household',version:'1.0',profileId:id});
  const lookedUp=await rpc('lookup_household_for_attendance',{p_qr_payload:qr});assert.equal(lookedUp.household_profile_id,id);
  check('Actual rendered QR pixels decode with installed decoder and resolve through real secured staff lookup; no image endpoint');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  const arrival=await rpc('check_in_household_members',{p_profile_id:id,p_center_id:center,p_participants:[{kind:'holder'},{kind:'member',member_id:'cfb21000-0000-4000-8000-000000000001'}],p_request_id:crypto.randomUUID()});
  await page.getByRole('button',{name:'Refresh household'}).click();await page.getByText(/Checked in at Synthetic Center A/).first().waitFor();
  assert.equal(await page.getByText(/Checked in at Synthetic Center A/).count(),2);assert.equal(await page.getByText('No recorded check-in',{exact:true}).count(),1);
  check('Real staff partial arrival reaches resident display; holder/member selected and unselected person unchanged');
  await page.getByRole('button',{name:/Selected Child/}).click();await page.getByRole('button',{name:'Remove',exact:true}).click();
  await page.getByRole('dialog').getByText(/Ask staff to check this person out/).waitFor();assert.equal(await page.getByRole('dialog').isVisible(),true);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await rpc('check_out_household_attendance',{p_attendance_ids:arrival.stays.map(s=>s.attendance_id),p_request_id:crypto.randomUUID()});
  await page.getByRole('button',{name:'Refresh household'}).click();await page.getByText(/Last departure from Synthetic Center A/).first().waitFor();
  assert.equal(await page.getByText(/Last departure from Synthetic Center A/).count(),2);check('Active removal rejected with retained dialog; real checkout displays latest departure in Manila time');
  const tab=await browser.newPage({viewport:{width:1000,height:800}});watch(tab);await tab.goto(url);await tab.getByText('3 people',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Selected Child/}).click();await page.locator('#member-name').fill('Draft Child');
  await tab.evaluate(()=>window.fixtureMode('profile'));await tab.getByRole('button',{name:'Edit',exact:true}).nth(1).click();await tab.locator('#member-name').fill('Other Tab Child');
  await tab.getByRole('button',{name:'Update',exact:true}).click();await tab.getByRole('dialog').waitFor({state:'hidden'});
  await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});
  await page.waitForTimeout(300);
  await page.getByRole('button',{name:'Update',exact:true}).click();await page.getByRole('dialog').getByText(/The family list changed/).waitFor();
  assert.equal(await page.locator('#member-name').inputValue(),'Draft Child');await page.waitForFunction(()=>!document.querySelector('[role=dialog] button:last-child')?.disabled);
  await page.getByRole('button',{name:'Update',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByText('Other Tab Child',{exact:true}).waitFor();await page.getByText('Draft Child',{exact:true}).waitFor();check('Family/Profile two-tab CAS rejects stale draft, rereads once, retains inputs and preserves other edits on explicit save');
  await tab.getByRole('button',{name:'Edit',exact:true}).first().click();await tab.locator('#member-name').fill('Profile Draft');
  await page.getByRole('button',{name:/Other Tab Child/}).click();await page.locator('#member-name').fill('Family Other Child');
  await page.getByRole('button',{name:'Update',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await tab.getByRole('button',{name:'Update',exact:true}).click();await tab.getByRole('dialog').getByText(/The family list changed/).waitFor();
  assert.equal(await tab.locator('#member-name').inputValue(),'Profile Draft');
  await tab.getByRole('button',{name:'Update',exact:true}).waitFor();await tab.waitForTimeout(200);
  await tab.getByRole('button',{name:'Update',exact:true}).click();await tab.getByRole('dialog').waitFor({state:'hidden'});
  check('Settings Profile also rejects a stale editor; focus refresh cannot silently rebase an open draft');
  await tab.close();
  await page.getByRole('button',{name:'Refresh household'}).click();await page.getByText('Profile Draft',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Profile Draft/}).click();await page.locator('#member-name').fill('Draft Child');
  await page.getByRole('button',{name:'Update',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Add Family Member'}).click();await page.locator('#member-name').fill('Uncertain Add');dropSave=true;
  await page.getByRole('button',{name:'Add Member',exact:true}).click();await page.getByRole('dialog').getByText(/change may have saved/).waitFor();
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Add Member')?.disabled);
  const beforeRetry=writes().length;await page.getByRole('button',{name:'Add Member',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(writes().length,beforeRetry);assert.equal(await page.getByText('Uncertain Add',{exact:true}).count(),1);check('Committed lost response reconciles by read; explicit retry reuses added UUID without duplicate write');
  await page.getByRole('button',{name:/Uncertain Add/}).click();await page.locator('#member-name').fill('Empty Response Draft');emptySave=true;
  await page.getByRole('button',{name:'Update',exact:true}).click();await page.getByRole('dialog').getByText(/change may have saved/).waitFor();
  assert.equal(await page.locator('#member-name').inputValue(),'Empty Response Draft');await page.getByRole('button',{name:'Close',exact:true}).click();
  check('Error-free empty save response is unconfirmed, never a success or automatic replacement write');
  await page.getByRole('button',{name:/Empty Response Draft/}).click();await page.locator('#member-name').fill('Deadline Draft');holdSave=true;
  await page.getByRole('button',{name:'Update',exact:true}).click();await page.getByRole('dialog').getByText(/change may have saved/).waitFor({timeout:18000});
  await page.waitForTimeout(200);assert.equal(await page.getByRole('button',{name:'Update',exact:true}).isDisabled(),false);
  await page.getByRole('button',{name:'Close',exact:true}).click();check('Real 15-second response deadline ends busy state and reconciles committed roster using a read');
  malformed=true;await page.getByRole('button',{name:'Refresh household'}).click();await page.getByText(/Editing is paused/).waitFor();
  assert.equal(await page.getByRole('button',{name:'Add Family Member'}).isDisabled(),true);assert.equal(await page.getByText('Draft Child',{exact:true}).count(),1);
  await page.getByRole('button',{name:'Try again',exact:true}).click();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Add Family Member'))?.disabled);check('Malformed roster keeps verified same-account list and disables unsafe edits until successful retry');
  failAttendance=true;await page.getByRole('button',{name:'Refresh household'}).click();await page.getByText(/Could not update attendance/).waitFor();
  assert.equal(await page.getByText(/Last known status/).count(),4);check('Failed attendance refresh retains labeled last-known records, without false empty statuses');
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  const count=report.calls.filter(c=>c.path.includes('get_my_household_attendance')).length;
  await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});
  await page.waitForTimeout(400);assert.equal(report.calls.filter(c=>c.path.includes('get_my_household_attendance')).length,count+1);check('Genuine focus return coalesces visibility/focus callbacks into one attendance read');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.documentElement.classList.add('dark');document.documentElement.style.setProperty('--accent','#a855f7');document.documentElement.style.fontFamily='serif';});
  await page.screenshot({path:path.join(out,'family-dark-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('button',{name:/Show My Code/}).click();await page.getByRole('img',{name:'Household QR code'}).waitFor();await page.screenshot({path:path.join(out,'family-qr-dark-mobile.png'),fullPage:true});
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]')),true);await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.evaluate(()=>{document.documentElement.style.zoom='2';});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(()=>document.documentElement.style.zoom='1');check('390px dark/custom accent/font, QR contrast and keyboard focus; 200% zoom has no horizontal overflow');
  const beforeHidden=report.calls.length;await page.evaluate(()=>window.fixtureMode('guest'));await page.getByRole('heading',{name:'Log In to Manage Your Household'}).waitFor();await page.waitForTimeout(200);assert.equal(report.calls.length,beforeHidden);
  await page.evaluate(()=>window.fixtureMode('setup'));await page.getByText(/An active resident profile is required/).waitFor();check('Guest inline gate and unavailable-profile message issue no private household calls');
  await page.evaluate(()=>window.fixtureMode('family'));await page.getByText('4 people',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Draft Child/}).click();await page.getByRole('button',{name:'Remove',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('3 people',{exact:true}).waitFor();
  const afterRemoval=await rpc('lookup_household_for_attendance',{p_qr_payload:JSON.stringify({type:'household',version:'1.0',profileId:id})});assert.equal(afterRemoval.people.some(person=>person.member_id==='cfb21000-0000-4000-8000-000000000001'),false);check('After departure, Family removal excludes archived member from future staff selections');
  await page.getByRole('button',{name:/Show My Code/}).click();await page.getByRole('img',{name:'Household QR code'}).waitFor();
  await page.evaluate(token=>window.fixtureSwitchAccount(token),process.env.ATTENDANCE_OTHER_TEST_TOKEN);await page.getByText(/Your session or account changed/).waitFor();assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.getByText('Draft Child',{exact:true}).count(),0);check('Account switch clears dialogs, QR and roster; no stale-account results applied');
  await page.evaluate(()=>window.fixtureProfile('dfb21000-0000-4000-8000-000000000003'));await page.getByText('1 person',{exact:true}).waitFor();
  const holderArrival=await rpc('check_in_household_members',{p_profile_id:'dfb21000-0000-4000-8000-000000000003',p_center_id:center,p_participants:[{kind:'holder'}],p_request_id:crypto.randomUUID()});
  await page.getByRole('button',{name:'Refresh household'}).click();await page.getByText(/Checked in at Synthetic Center A/).waitFor();
  await rpc('check_out_household_attendance',{p_attendance_ids:holderArrival.stays.map(stay=>stay.attendance_id),p_request_id:crypto.randomUUID()});
  await page.getByRole('button',{name:'Refresh household'}).click();await page.getByText(/Last departure from Synthetic Center A/).waitFor();
  check('Holder-only household shows one person and displays real arrival and departure with no dependent row');
  await page.getByRole('button',{name:/Show My Code/}).click();await page.getByRole('img',{name:'Household QR code'}).waitFor();
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await page.getByText(/Your session or account changed/).waitFor();
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.getByText('1 person',{exact:true}).waitFor();
  assert.equal(await page.locator('canvas').count(),0);check('Persisted page restoration revalidates private state and closes QR; never replays writes');
  await page.getByRole('button',{name:/Show My Code/}).click();await page.getByRole('img',{name:'Household QR code'}).waitFor();await page.evaluate(()=>window.fixtureLogout());
  await page.getByText(/Your session or account changed/).waitFor();assert.equal(await page.locator('canvas').count(),0);check('Logout clears private QR and data immediately');
  assert.equal(report.calls.filter(c=>/check_in_household_members|check_out_household_attendance|evacuation_center_checkins/.test(c.path)).length,0);check('Resident components issue zero attendance mutations and no retired QR image request');
  assert.deepEqual(report.consoleErrors,[]);report.pass=true;
}catch(error){report.failure=String(error.stack??error);if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,failure:report.failure,consoleErrors:report.consoleErrors}));}
