/* global __dirname */
// Synthetic loopback Auth/API transport. Exercises actual Next SSR, SDK and UI;
// it does not prove Google consent or database persistence/authorization.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {WebSocketServer}=require('ws');
const root=path.resolve(__dirname,'..'),output=path.join(root,'plans/evidence/web-auth-errors-2026-10-04');
fs.mkdirSync(output,{recursive:true});
const id='b6040000-0000-0000-0000-000000000090',tenant='a6040000-0000-0000-0000-000000000090';
const user={id,aud:'authenticated',role:'authenticated',email:'recovery@test.local',app_metadata:{providers:['google']},user_metadata:{name:'Recovery Resident'},identities:[{provider:'google',user_id:id}],created_at:'2026-01-01T00:00:00Z'};
let available=false,saved=false,calls=0;
const report={passed:false,assertions:[],consoleErrors:[]};
const prove=(value,label)=>{assert.ok(value,label);report.assertions.push(label);};
const profile=()=>({id,role:'resident',barangay_id:tenant,full_name:'Recovery Resident',first_name:'Recovery',last_name:'Resident',email:user.email,deleted_at:null,avatar_url:null,profile_completed_at:null,house_no:null,street:null,sex:null,employment_status:null,mobile_number:null,birth_date:null,approved_id_submission_id:null,email_verification_status:'verified',barangays:{name:'Synthetic Locality'}});
const api=http.createServer((req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://localhost:3108');res.setHeader('Access-Control-Allow-Headers',req.headers['access-control-request-headers']||'authorization,apikey,content-type');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 const url=new URL(req.url,'http://127.0.0.1:3119');let data=[];let status=200;
 if(url.pathname==='/auth/v1/user')data=user;
 else if(url.pathname==='/rest/v1/rpc/ensure_google_resident_profile'){
  calls++;if(available){saved=true;data=id;}else{status=404;data={code:'PGRST202',message:'Synthetic missing RPC',details:null,hint:null};}
 }else if(url.pathname==='/rest/v1/profiles')data=saved?(req.headers.accept?.includes('object+json')?profile():[profile()]):null;
 else if(url.pathname==='/rest/v1/barangay_localities')data={barangay_id:tenant,display_name:'Synthetic Locality',city:'Test City',province:'Test Province',resident_registration_enabled:true};
 else if(url.pathname==='/rest/v1/barangays')data={id:tenant,boundary:null};
 else if(url.pathname==='/rest/v1/announcements')data=null;
 else if(url.pathname.startsWith('/rest/v1/rpc/'))data=0;
 res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));
});
const realtime=new WebSocketServer({server:api,path:'/realtime/v1/websocket'});
realtime.on('connection',socket=>socket.on('message',raw=>{
 const [join,ref,topic,event]=JSON.parse(raw.toString());
 if(event==='phx_join'||event==='heartbeat')socket.send(JSON.stringify([join,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:[]}}]));
}));
async function main(){
 await new Promise((resolve,reject)=>{api.once('error',reject);api.listen(3119,'127.0.0.1',resolve);});
 const log=fs.createWriteStream(path.join(output,'preview.log'));
 const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','localhost','--port','3108'],{
  cwd:path.join(root,'apps/resident-web'),windowsHide:true,
  env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3119',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-only-public-key',BARANGAYAN_PREVIEW_DIST_DIR:'.next-auth-errors',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']
 });child.stdout.pipe(log);child.stderr.pipe(log);
 let browser;
 try{
  const start=Date.now();while(Date.now()-start<45000){try{const r=await fetch('http://localhost:3108/login',{signal:AbortSignal.timeout(1000)});if(r.ok)break;}catch{}if(child.exitCode!==null)throw new Error('Preview exited before readiness');await new Promise(r=>setTimeout(r,300));}
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();
  const encoded=object=>Buffer.from(JSON.stringify(object)).toString('base64url');const expires=Math.floor(Date.now()/1000)+3600;
  const session={access_token:`${encoded({alg:'HS256',typ:'JWT'})}.${encoded({sub:id,exp:expires,role:'authenticated',aud:'authenticated'})}.synthetic`,refresh_token:'synthetic-refresh',expires_at:expires,expires_in:3600,token_type:'bearer',user};
  await context.addCookies([{name:'sb-127-auth-token',value:`base64-${encoded(session)}`,domain:'localhost',path:'/'}]);
  await context.addInitScript(()=>{localStorage.setItem('barangayan-resident-web-theme','dark');localStorage.setItem('barangayan-resident-web-accent','#123456');localStorage.setItem('barangayan-resident-web-font','georgia');});
  const page=await context.newPage();page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});page.on('pageerror',e=>report.consoleErrors.push(e.message));
  let response=await page.goto('http://localhost:3108/home',{waitUntil:'networkidle',timeout:60000});
  prove(response.status()===200,'Expected missing-RPC error keeps public home SSR successful');
  await page.getByRole('button',{name:'Retry account setup',exact:true}).waitFor({timeout:15000});
  prove(!saved&&calls>0,'Setup failure is surfaced without falsely claiming a save');
  prove((await page.locator('body').innerText()).includes('You can still browse information'),'Public browsing displays recoverable status');
  const queue=await page.evaluate(()=>window.__next_s);
  prove(queue.filter(([,props])=>['theme-init','accent-init','font-init'].includes(props.id)).length===3,'All before-interactive theme scripts remain registered');
  prove(await page.locator('html').evaluate(el=>el.classList.contains('dark')&&el.style.getPropertyValue('--accent')==='#123456'&&el.style.getPropertyValue('--font-app').includes('Georgia')),'Saved theme, accent and font apply during rendering');
  await page.screenshot({path:path.join(output,'recoverable-home.png')});
  available=true;await page.getByRole('button',{name:'Retry account setup',exact:true}).click();
  await page.getByRole('link',{name:'Complete profile',exact:true}).waitFor({timeout:30000});
  prove(saved,'Retry invokes actual SDK operation and recovers the profile view');
  prove(await page.getByRole('button',{name:'Retry account setup',exact:true}).count()===0,'Successful setup clears the pending notice');
  await page.goto('http://localhost:3108/reports/new',{waitUntil:'networkidle',timeout:45000});
  prove(new URL(page.url()).pathname==='/complete-profile','Profile completion still gates report submission');
  prove(new URL(page.url()).searchParams.get('next')==='/reports/new','Completion preserves safe intended report destination');
  prove(await page.locator('input').evaluateAll(inputs=>inputs.some(i=>i.value==='Recovery')&&inputs.some(i=>i.value==='Resident')),'Recovered names prefill completion');
  prove(report.consoleErrors.length===0,'No observed React script, hydration or browser runtime errors');
  report.passed=true;console.log(`PASS: ${report.assertions.length} SSR/browser recovery assertions with synthetic loopback API.`);
 }finally{
  if(browser)await browser.close();
  // The only process tree stopped is the child preview spawned by this harness.
  if(child.exitCode===null)await new Promise(resolve=>{const stop=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});stop.once('exit',resolve);stop.once('error',resolve);});
  log.end();for(const socket of realtime.clients)socket.terminate();realtime.close();await new Promise(resolve=>api.close(resolve));
 }
}
main().catch(error=>{report.error=error.message;console.error(error.message);process.exitCode=1;}).finally(()=>fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify(report,null,2)));
