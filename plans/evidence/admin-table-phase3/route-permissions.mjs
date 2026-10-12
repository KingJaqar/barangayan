import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {privateDir,statePath} from './runtime-stack.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const state=JSON.parse(fs.readFileSync(statePath,'utf8')),users=JSON.parse(fs.readFileSync(privateDir+'/users.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true}),report={passed:false,cases:[]};
try{
 for(const name of ['anon','resident','removedAdmin','foreignAdmin']){
  const context=await browser.newContext();
  if(name!=='anon'){
   const auth=createClient(state.api,state.anonKey,{auth:{persistSession:false,autoRefreshToken:false}}),login=await auth.auth.signInWithPassword(users[name]);assert.ifError(login.error);
   let cookies=[];const session=createServerClient(state.api,state.anonKey,{cookies:{getAll:()=>cookies,setAll:next=>{cookies=next;}}});assert.ifError((await session.auth.setSession({access_token:login.data.session.access_token,refresh_token:login.data.session.refresh_token})).error);
   await context.addCookies(cookies.map(c=>({name:c.name,value:c.value,url:'http://127.0.0.1:3140'})));
  }
  const page=await context.newPage();
  for(const route of ['requests','transactions']){
   await page.goto('http://127.0.0.1:3140/'+route,{timeout:60000});
   if(name==='foreignAdmin'){
    await page.waitForFunction(()=>document.querySelector('.table-browse-pagination')?.textContent.includes('Showing 0–0 of 0'));
    assert.ok(!(await page.locator('body').innerText()).includes('Beyond Cap Needle'));
   }else {await page.waitForURL('**/login');assert.equal(await page.locator('table').count(),0);}
   report.cases.push({user:name,route,result:name==='foreignAdmin'?'only own tenant; zero matching rows':'redirected to login'});
  }
  await context.close();
 }
 report.passed=true;console.log('All eight authenticated route permission checks passed');
}catch(e){report.error=e.message;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(new URL('./route-permissions.json',import.meta.url),JSON.stringify(report,null,2));await browser.close();}
