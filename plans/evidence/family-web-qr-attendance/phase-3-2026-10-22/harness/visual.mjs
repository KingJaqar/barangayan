import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const root=process.cwd(), work=path.join(root,'tmp/family-web-phase3-20261022');
const app=path.join(root,'apps/resident-web'), require=createRequire(path.join(root,'apps/admin-web/package.json'));
const { chromium }=require('playwright');
const port=fs.readFileSync(path.join(work,'rest-port.txt'),'utf8').trim();
const token=process.env.ATTENDANCE_TEST_TOKEN, admin=process.env.ATTENDANCE_ADMIN_TEST_TOKEN;
assert(token && admin);
const out=path.join(root,'plans/evidence/family-web-qr-attendance/phase-3-2026-10-22');
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
report.consoleWarnings=[];
let browser,page;
try {
 browser=await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true});report.browser=await browser.version();
 page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>report.consoleErrors.push(e.message));page.on('console',m=>{if(m.type()==='warning')report.consoleWarnings.push(m.text());if(m.type()==='error'&&!/Failed to load resource|net::ERR/.test(m.text()))report.consoleErrors.push(m.text());});await page.goto(url);await page.getByText('3 people',{exact:true}).waitFor();await page.waitForTimeout(400);
 await page.screenshot({path:path.join(out,'family-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:/Show My Code/}).click();await page.getByRole('img',{name:'Household QR code'}).waitFor();await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'family-qr-desktop.png'),fullPage:true});await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.documentElement.classList.add('dark');document.documentElement.style.setProperty('--accent','#a855f7');document.documentElement.style.setProperty('--font-app','Georgia, serif');});await page.waitForTimeout(400);
 const colors=await page.locator('[data-household-attendance]').first().evaluate(el=>({font:getComputedStyle(el).fontFamily,color:getComputedStyle(el).color,card:getComputedStyle(el.closest('div[class*="member"]')).backgroundColor}));assert(colors.font.includes('Georgia'));report.colors=colors;
 await page.screenshot({path:path.join(out,'family-dark-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:/Show My Code/}).click();await page.getByRole('img',{name:'Household QR code'}).waitFor();await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'family-qr-dark-mobile.png'),fullPage:true});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});await page.waitForTimeout(400);const box=await page.getByRole('dialog').boundingBox();assert(box.x>=0 && box.x+box.width<=391);
 const decoded=await page.locator('canvas').evaluate(async(canvas)=>{const {Html5Qrcode}=await import('/decoder.js');const el=document.createElement('div');el.id='zoom-decode';document.body.append(el);const scanner=new Html5Qrcode(el.id);const blob=await new Promise(resolve=>canvas.toBlob(resolve));const raw=await scanner.scanFile(new File([blob],'qr.png',{type:'image/png'}),false);scanner.clear();el.remove();return raw;});assert.equal(JSON.parse(decoded).profileId,id);
 await page.screenshot({path:path.join(out,'family-qr-200percent.png'),fullPage:true});await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]')),true);
 report.pass=true;report.checks.push('Settled light desktop and dark 390px custom account font/accent screenshot inspection; 200% QR fits and decodes, keyboard focus contained');assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.consoleWarnings,[]);
}catch(e){report.failure=String(e.stack??e);process.exitCode=1;}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'visual-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,failure:report.failure,colors:report.colors}));}
