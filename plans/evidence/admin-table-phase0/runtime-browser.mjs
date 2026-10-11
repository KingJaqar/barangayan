// Chromium baseline observations, not an assertion that the proposed UX exists.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {privateDir} from './runtime-stack.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const users=JSON.parse(fs.readFileSync(privateDir+'/users.json','utf8'));
const report={timestamp:new Date().toISOString(),passed:false,browser:null,screens:[],errors:[],networkFailures:[]};
const save=()=>fs.writeFileSync(new URL('./runtime-browser-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Manila'});
await context.addInitScript(()=>{
 window.__phase0={events:[],activeTopics:[]};
 const Native=window.WebSocket;
 window.WebSocket=class extends Native {
  constructor(...args){super(...args);this.addEventListener('message',event=>{try{const m=JSON.parse(event.data);window.__phase0.events.push({direction:'in',event:m.event,topic:m.topic,status:m.payload?.status});}catch{}});}
  send(data){try{const m=JSON.parse(data);window.__phase0.events.push({direction:'out',event:m.event,topic:m.topic});if(m.event==='phx_join')window.__phase0.activeTopics.push(m.topic);if(m.event==='phx_leave')window.__phase0.activeTopics=window.__phase0.activeTopics.filter(t=>t!==m.topic);}catch{}return super.send(data);}
 };
});
const page=await context.newPage();page.setDefaultTimeout(15000);
page.on('pageerror',error=>{report.errors.push(error.message);save();});
page.on('requestfailed',request=>{if(!request.failure()?.errorText.includes('ERR_ABORTED')){report.networkFailures.push({url:new URL(request.url()).pathname,error:request.failure()?.errorText});save();}});
try {
 await page.goto('http://127.0.0.1:3140/login',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>Object.keys(document.querySelector('input[type=email]')??{}).some(key=>key.startsWith('__reactProps')),{},{timeout:15000});
 await page.locator('input[type=email]').fill(users.admin.email);await page.locator('input[type=password]').fill(users.admin.password);
 await page.getByRole('button',{name:'Log In',exact:true}).click();await page.waitForURL('**/dashboard',{timeout:60000});
 console.log('Real browser password login succeeded');
 for(const route of ['/requests','/transactions','/residents','/incident-reports','/health','/health/applicants','/households-residents','/staff']){
  await page.goto('http://127.0.0.1:3140'+route,{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('table').waitFor({timeout:30000});
  const screen={route,heading:await page.locator('h1').first().innerText(),rows:await page.locator('tbody tr').count(),headers:await page.locator('thead th').allTextContents(),firstRow:(await page.locator('tbody tr').first().innerText()).slice(0,700),searchPlaceholder:await page.locator('input[placeholder^="Search"]').last().getAttribute('placeholder'),url:page.url(),websocket:await page.evaluate(()=>window.__phase0),bodySnippet:(await page.locator('main').innerText()).slice(0,350)};
  assert.ok(screen.rows>0&&screen.rows<=1000,route+': baseline returns at most one capped batch');
  assert.equal(await page.locator('[data-nextjs-dialog]').count(),0,route+': no development error overlay');
  report.screens.push(screen);save();console.log(`${route}: ${screen.rows} rows, ${screen.headers.length} columns`);
 }
 report.passed=true;save();
}catch(error){report.errors.push({name:error.name,message:error.message});save();console.error(error);process.exitCode=1;}
finally {await context.close();await browser.close();}
