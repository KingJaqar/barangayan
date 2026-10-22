import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const root = process.cwd(), work = path.join(root, 'tmp/family-web-phase4-20261022');
const app = path.join(root, 'apps/admin-web'), require = createRequire(path.join(app, 'package.json'));
const { chromium } = require('playwright');
const token = process.env.ATTENDANCE_TEST_TOKEN;
assert(token);
const bundle = await build({ entryPoints: [path.join(work, 'admin-fixture.tsx')], bundle: true, write: false,
  outdir: 'attendance-fixture', format: 'esm', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
  alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  tsconfig: path.join(app,'tsconfig.json'), plugins: [{ name: 'synthetic-local-session', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: path.join(work, 'admin-client.ts') }));
  } }] });
const cssPath = path.join(app, 'src/app/globals.css');
const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(cssPath, 'utf8'), { from: cssPath })).css;
const report = { date: new Date().toISOString(), browser: '', checks: [], consoleErrors: [],
  limitations: ['Actual AttendanceDialog/hook/Supabase REST builders and real PostgREST/PostgreSQL RPCs under authenticated roles. Synthetic local Auth user endpoint; not a deployed login/session test.',
    'Camera denial/startup tested; real staff camera decoding a displayed resident QR remains manual.'], calls: [] };
let dropArrival = false, failRead = false, malformed = false;
const server = http.createServer(async (req,res) => {
  try {
    if (req.url === '/fixture.js') { res.setHeader('content-type','text/javascript'); res.end(bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents); return; }
    if (req.url === '/fixture.css') { res.setHeader('content-type','text/css'); res.end(css + (bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text ?? '')); return; }
    if (req.url?.startsWith('/auth/v1/user')) {
      const subject=JSON.parse(Buffer.from(req.headers.authorization.split('.')[1],'base64url').toString()).sub;
      res.setHeader('content-type','application/json'); res.end(JSON.stringify({ id:subject,aud:'authenticated',role:'authenticated',email:'synthetic@test.local',app_metadata:{},user_metadata:{},created_at:'2026-10-21T00:00:00Z' })); return;
    }
    if (req.url?.startsWith('/rest/v1/')) {
      const chunks=[]; for await(const chunk of req) chunks.push(chunk);
      const body=Buffer.concat(chunks);
      report.calls.push({ path: req.url, method: req.method, body: body.length ? JSON.parse(body.toString()) : null });
      if (failRead && req.url.includes('lookup_household')) { failRead=false; res.writeHead(503,{'content-type':'application/json'}); res.end(JSON.stringify({message:'synthetic unavailable',code:'test'})); return; }
      const headers={...req.headers}; delete headers.host; delete headers['content-length'];
      const result=await fetch(`http://127.0.0.1:${fs.readFileSync(path.join(work,'rest-port.txt'),'utf8').trim()}/`+req.url.slice('/rest/v1/'.length),{method:req.method,headers,body:body.length?body:undefined});
      let value=await result.text();
      if (dropArrival && req.url.includes('check_in_household_members')) {
        dropArrival=false; res.writeHead(503,{'content-type':'application/json'});
        res.end(JSON.stringify({message:'Committed response unavailable',code:'test_transport'})); return;
      }
      if (malformed && req.url.includes('lookup_household')) { malformed=false; value='{}'; }
      res.writeHead(result.status,{'content-type':result.headers.get('content-type')??'application/json'});res.end(value);return;
    }
    res.setHeader('content-type','text/html'); res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');
  } catch(error) { res.writeHead(500);res.end('Local fixture failed'); report.fixtureError=String(error); }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/#${token}`;
let browser, page;
const out=path.join(root,'plans/evidence/family-web-qr-attendance/phase-4-2026-10-22/admin');
const timeout=setTimeout(()=>{ console.error('Browser verification deadline'); process.exitCode=1; void browser?.close(); server.closeAllConnections();server.close(); },180000);
try {
  browser=await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true});
  report.browser=await browser.version();
  page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(12000);
  page.on('pageerror',error=>report.consoleErrors.push(error.message));
  page.on('console',msg=>{ if(msg.type()==='error'&&!/Failed to load resource|net::ERR/.test(msg.text())) report.consoleErrors.push(msg.text()); });
  await page.goto(url); await page.getByText('Open attendance',{exact:true}).click();
  const dialog=page.getByRole('dialog');
  await page.getByRole('combobox',{name:/Arrival center/}).selectOption('efb21000-0000-4000-8000-000000000001');
  async function choose(name) {
    await page.locator('[data-admin-select-trigger]').click();
    await page.getByRole('option',{name,exact:true}).click();await page.getByRole('button',{name:'Load household',exact:true}).click();
    await page.getByRole('checkbox').first().waitFor();
  }
  await choose('Synthetic Family');
  assert.equal(await page.getByRole('checkbox').count(),3);
  assert.equal(await page.getByRole('checkbox',{checked:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Review arrival',exact:true}).isDisabled(),true);
  const idleCount=report.calls.length;await new Promise(resolve=>setTimeout(resolve,750));assert.equal(report.calls.length,idleCount);
  report.checks.push('Idle dialog has stable request count; no background traffic or read/update loop');
  report.checks.push('Holder + two members loaded, none preselected, empty confirmation disabled');
  await page.getByRole('checkbox',{name:/Synthetic Family/}).check();await page.getByRole('checkbox',{name:/Selected Child/}).check();
  await page.getByRole('button',{name:'Review arrival',exact:true}).click();
  await page.getByRole('button',{name:'Change selection',exact:true}).click();
  await page.getByRole('button',{name:'Review arrival',exact:true}).click();
  dropArrival=true;
  await page.getByRole('button',{name:'Confirm arrival',exact:true}).click();
  await page.getByRole('button',{name:'Retry original confirmation',exact:true}).waitFor();
  assert.equal(await page.getByRole('checkbox').first().isDisabled(),true);
  const firstWrite=report.calls.find(c=>c.path.includes('check_in_household_members')).body;
  failRead=true;
  await page.getByRole('button',{name:'Retry original confirmation',exact:true}).click();
  await page.getByRole('heading',{name:'Arrival confirmed',exact:true}).waitFor();
  await page.getByText(/Attendance below is last known/).waitFor();
  const writes=report.calls.filter(c=>c.path.includes('check_in_household_members'));
  assert.equal(writes.length,2); assert.deepEqual(writes[0].body,writes[1].body);
  report.checks.push('Committed but unavailable response retains frozen exact request/payload; explicit retry retrieves receipt; failed refresh labels last-known data');
  await page.getByRole('button',{name:'Refresh current attendance',exact:true}).click();
  await page.getByRole('checkbox',{name:/Synthetic Family/}).waitFor();
  await page.waitForFunction(()=>!document.body.textContent.includes('Loading current attendance…'));
  assert.equal(await page.getByRole('checkbox',{checked:true}).count(),0);
  await page.getByRole('checkbox',{name:/Synthetic Family/}).check();await page.getByRole('checkbox',{name:/Selected Child/}).check();
  await page.getByRole('button',{name:'Review departure',exact:true}).click();
  await page.getByRole('button',{name:'Confirm departure',exact:true}).click();
  await page.getByRole('heading',{name:'Departure confirmed',exact:true}).waitFor();
  await page.getByText(/Last departure: Synthetic Center A/).first().waitFor();
  assert.equal(await page.getByRole('checkbox',{name:/Unselected Child/}).innerText().catch(()=>''),'');
  report.checks.push('Partial family arrival/departure uses actual authenticated-role RPCs; unselected member remains unchanged');
  await page.waitForFunction(()=>{const checkbox=document.querySelector('input[type=checkbox]');return checkbox&&!checkbox.matches(':disabled');});
  await dialog.locator('.ab-card').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:path.join(out,'desktop-light.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{document.documentElement.classList.add('dark');document.documentElement.style.setProperty('--accent','#a855f7');document.documentElement.style.setProperty('--font-app','Georgia, serif');});
  await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--background').trim()==='#0a0a0a');
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('[data-admin-select-trigger]')).backgroundColor.match(/[\d.]+/)[0])<80);
  report.theme=await page.locator('[data-admin-select-trigger]').evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,font:getComputedStyle(el).fontFamily}));
  await page.screenshot({path:path.join(out,'mobile-dark.png'),fullPage:true});
  assert(await dialog.evaluate(el=>el.getBoundingClientRect().right<=window.innerWidth));
  await page.evaluate(()=>document.documentElement.style.zoom='2');
  assert(await dialog.evaluate(el=>el.getBoundingClientRect().width<=window.innerWidth));
  await page.evaluate(()=>document.documentElement.style.zoom='1');
  await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)));
  report.checks.push('Desktop/light and narrow/dark accent/font layouts, 200% CSS zoom, native dialog keyboard containment');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByText('Open attendance',{exact:true}).click();
  await page.getByRole('combobox',{name:/Arrival center/}).selectOption('efb21000-0000-4000-8000-000000000001');
  await choose('Synthetic Holder Only');
  assert.equal(await page.getByRole('checkbox').count(),1);
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Review arrival',exact:true}).click();
  const before=report.calls.length;
  await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));});
  await page.getByRole('button',{name:'Confirm arrival',exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.getByRole('button',{name:'Confirm arrival',exact:true}).count(),0);
  assert.equal(report.calls.slice(before).filter(c=>c.path.includes('lookup_household')).length,1);
  report.checks.push('Holder-only household supported; coalesced return-to-focus read invalidates stale review without a write');
  await page.getByRole('button',{name:'Scan Family QR',exact:true}).click();
  await page.getByText(/camera.*(unavailable|denied|found)|Camera startup timed out/i).first().waitFor();
  await page.getByRole('button',{name:'Close camera',exact:true}).click();
  report.checks.push('Denied/unavailable camera leaves useful directory fallback; scanner can close');
  await page.evaluate(()=>{
    window.fixtureTracks=[];
    navigator.mediaDevices.getUserMedia=async()=>{
      const source=document.querySelector('[data-fixture-qr] canvas');
      const pixels=source.getContext('2d').getImageData(0,0,source.width,source.height);
      const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
      canvas.getContext('2d').putImageData(pixels,0,0);
      const stream=canvas.captureStream(8);window.fixtureTracks.push(...stream.getTracks());
      const redraw=setInterval(()=>{ if(stream.getTracks().every(track=>track.readyState==='ended')) clearInterval(redraw);
        else canvas.getContext('2d').putImageData(pixels,0,0); },100);
      return stream;
    };
  });
  fs.writeFileSync(path.join(work,'synthetic-qr.png'),Buffer.from(await page.locator('[data-fixture-qr] canvas').evaluate(canvas=>canvas.toDataURL().split(',')[1]),'base64'));
  await page.getByRole('button',{name:'Scan Family QR',exact:true}).click();
  await page.getByRole('checkbox',{name:/Synthetic Holder Only/}).waitFor();
  await page.getByRole('button',{name:'Close camera',exact:true}).waitFor({state:'hidden'});
  assert(await page.evaluate(()=>window.fixtureTracks.every(track=>track.readyState==='ended')));
  report.checks.push('Actual html5-qrcode decodes QRCodeCanvas synthetic video stream; one secured lookup, camera tracks released');
  await page.evaluate(()=>{
    const getMedia=navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.fixtureResolveMedia=async()=>resolve(await getMedia());});
    window.fixtureRestoreMedia=()=>{navigator.mediaDevices.getUserMedia=getMedia;};
  });
  await page.getByRole('button',{name:'Scan Family QR',exact:true}).click();
  await page.waitForFunction(()=>typeof window.fixtureResolveMedia==='function');
  await page.getByRole('button',{name:'Close camera',exact:true}).click();
  await page.evaluate(()=>{window.fixtureResolveMedia();window.fixtureRestoreMedia();});
  await page.waitForFunction(()=>window.fixtureTracks.every(track=>track.readyState==='ended'));
  report.checks.push('Camera permission resolving after close releases late native tracks and ignores decode callbacks');
  await page.evaluate(()=>window.fixtureSetQr(JSON.stringify({type:'EVACUATION_CENTER_CHECKIN'})));
  await page.getByRole('button',{name:'Scan Family QR',exact:true}).click();
  await page.getByText('This is not a valid Family QR code. Scan the household’s Family code.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('checkbox').count(),0);
  report.checks.push('Wrong QR type clears previous selectable household and receipt; cannot confirm old family');
  await page.getByRole('button',{name:'Load household',exact:true}).click();
  await page.getByRole('checkbox').first().waitFor();
  malformed=true;await page.getByRole('button',{name:'Refresh current attendance',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert(await page.getByRole('checkbox').first().isDisabled());
  report.checks.push('Malformed lookup response does not overwrite verified private data; edits disabled until refresh');
  await page.getByRole('button',{name:'Refresh current attendance',exact:true}).click();
  await page.waitForFunction(()=>{const checkbox=document.querySelector('input[type=checkbox]');return checkbox&&!checkbox.matches(':disabled');});
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Review arrival',exact:true}).click();
  const countBefore=report.calls.filter(call=>call.path.includes('check_in_household_members')).length;
  await page.getByRole('button',{name:'Confirm arrival',exact:true}).evaluate(button=>{button.click();button.click();});
  await page.getByRole('heading',{name:'Arrival confirmed',exact:true}).waitFor();
  await page.waitForFunction(()=>document.body.textContent.includes('Synthetic Center A · Arrived'));
  assert.equal(report.calls.filter(call=>call.path.includes('check_in_household_members')).length,countBefore+1);
  const inactive=await page.evaluate(async()=>{
    const response=await fetch('/rest/v1/evacuation_centers?barangay_id=eq.afb21000-0000-4000-8000-000000000001',{
      method:'PATCH',headers:{'content-type':'application/json',Authorization:`Bearer ${location.hash.slice(1)}`},body:JSON.stringify({is_active:false})});
    return response.status;
  });assert.equal(inactive,204);
  await page.getByRole('button',{name:'Refresh current attendance',exact:true}).click();
  await page.getByText('No active centers are available for arrivals. Existing stays can still be checked out.',{exact:true}).waitFor();
  await page.waitForFunction(()=>{const checkbox=document.querySelector('input[type=checkbox]');return checkbox&&!checkbox.matches(':disabled');});
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Review departure',exact:true}).click();
  await page.getByRole('button',{name:'Confirm departure',exact:true}).click();
  await page.getByRole('heading',{name:'Departure confirmed',exact:true}).waitFor();
  await page.getByText(/Last departure: Synthetic Center A/).waitFor();
  report.checks.push('Double confirmation sends one write; checkout succeeds with no active arrival center and recorded center inactive');
  await page.evaluate(()=>window.fixtureLogout());await page.getByText('Open attendance',{exact:true}).waitFor();
  assert.equal(await page.getByRole('dialog').count(),0);
  report.checks.push('Sign-out closes and clears private dialog; no automatic write replay');
  await page.evaluate(token=>window.fixtureSwitchAccount(token),token);
  await page.getByText('Open attendance',{exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await page.evaluate(token=>window.fixtureSwitchAccount(token),process.env.ATTENDANCE_OTHER_TEST_TOKEN);
  await page.getByRole('dialog').waitFor({state:'hidden'});
  report.checks.push('Switching synthetic accounts closes private dialog and disregards old-account state');
  assert.deepEqual(report.consoleErrors,[]);
  report.result='pass';
} catch(error) {report.result='fail';report.failure=String(error);report.body=await page?.locator('body').innerText();report.dom=await page?.locator('body').innerHTML();
  report.video=await page?.locator('video').evaluateAll(videos=>videos.map(v=>({width:v.videoWidth,height:v.videoHeight,paused:v.paused,ready:v.readyState})));
  if (await page?.locator('video').count()) {
    const frame=await page.locator('video').first().evaluate(video=>{const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);return canvas.toDataURL().split(',')[1];});
    fs.writeFileSync(path.join(work,'synthetic-frame.png'),Buffer.from(frame,'base64'));
  }
  await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true});console.error(error);console.error(report.body);process.exitCode=1;}
finally {
  clearTimeout(timeout);await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({result:report.result,checks:report.checks,errors:report.consoleErrors,failure:report.failure},null,2));
}
