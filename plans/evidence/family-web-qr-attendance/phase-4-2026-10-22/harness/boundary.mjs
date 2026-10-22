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
 const resident=process.env.ATTENDANCE_OTHER_TEST_TOKEN;
 browser=await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true});page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>report.consoleErrors.push(e.message));await page.goto(base+'/#'+resident);await page.evaluate(()=>window.fixtureProfile('dfb21000-0000-4000-8000-000000000003'));await page.getByText('1 person',{exact:true}).waitFor();
 const members=Array.from({length:30},(_,i)=>({id:'ababab00-0000-4000-8000-'+String(i).padStart(12,'0'),name:'Boundary '+i,relation:'Child'}));
 const canonical=await rpc('save_resident_household_if_unchanged',{p_members:members,p_expected:[]},resident);assert.equal(canonical.length,30);
 await page.getByRole('button',{name:'Refresh household'}).click();await page.getByText('31 people',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Add Family Member'}).isDisabled(),true);
 const before=writes().length;await page.getByRole('button',{name:'Add Family Member'}).evaluate(b=>{b.disabled=false;b.click()});await page.waitForTimeout(100);assert.equal(await page.getByRole('dialog').count(),0);assert.equal(writes().length,before);
 const denied=await fetch(`http://127.0.0.1:${port}/rpc/save_resident_household_if_unchanged`,{method:'POST',headers:{authorization:'Bearer '+resident,'content-type':'application/json'},body:JSON.stringify({p_members:[...members,{id:'ababab00-0000-4000-8000-000000000031',name:'Thirty First',relation:'Child'}],p_expected:canonical})});assert.equal(denied.ok,false);
 await rpc('save_resident_household_if_unchanged',{p_members:[],p_expected:canonical},resident);await page.getByRole('button',{name:'Refresh household'}).click();await page.getByText('1 person',{exact:true}).waitFor();
 report.pass=true;report.checks.push('Zero/30 roster boundary in actual Family UI; disabled Add at 30 and forced disabled click sends no write and direct 31st API payload is rejected; zero restored via canonical expected snapshot');assert.deepEqual(report.consoleErrors,[]);
}catch(e){report.failure=String(e.stack??e);process.exitCode=1;}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'boundary-browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,failure:report.failure}));}
