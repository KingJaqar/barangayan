import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
const require=createRequire(import.meta.url);process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('dist/admin-table-phase1-browsers');const {webkit}=require('playwright');
const user=JSON.parse(fs.readFileSync('dist/admin-table-phase3-runtime/users.json','utf8')).admin;
const state=JSON.parse(fs.readFileSync('dist/admin-table-phase3-runtime/state.json','utf8'));
const browser=await webkit.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(15000);
const report={stages:[],errors:[],console:[],responses:[],failures:[]};let stage='login';
page.on('pageerror',e=>report.errors.push({stage,name:e.name,message:e.message,stack:e.stack}));
page.on('console',m=>{if(m.type()==='error')report.console.push({stage,message:m.text()});});
page.on('requestfailed',r=>report.failures.push({stage,path:new URL(r.url()).pathname,error:r.failure()?.errorText,headers:Object.keys(r.headers())}));
page.on('response',async r=>{if(r.url().includes('admin_audit_log'))report.responses.push({stage,status:r.status(),origin:await r.request().headerValue('origin'),allowOrigin:await r.headerValue('access-control-allow-origin')});});
try{
 const auth=createClient(state.api,state.anonKey,{auth:{persistSession:false,autoRefreshToken:false}}),login=await auth.auth.signInWithPassword(user);if(login.error)throw login.error;
 let cookies=[];const session=createServerClient(state.api,state.anonKey,{cookies:{getAll:()=>cookies,setAll:next=>{cookies=next;}}});const saved=await session.auth.setSession({access_token:login.data.session.access_token,refresh_token:login.data.session.refresh_token});if(saved.error)throw saved.error;
 await context.addCookies(cookies.map(c=>({name:c.name,value:c.value,url:'http://127.0.0.1:3140'})));
 await page.goto('http://127.0.0.1:3140/dashboard',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(1500);report.stages.push('Authenticated untouched dashboard');
 stage='unchanged dashboard';for(let i=0;i<3;i++){await page.goto('http://127.0.0.1:3140/dashboard');await page.waitForTimeout(1000);}report.stages.push('Three untouched dashboard loads');
 stage='pilot';await page.goto('http://127.0.0.1:3140/requests');await page.waitForTimeout(1500);await page.getByRole('button',{name:'Next',exact:true}).click();await page.waitForURL('**page=2**');await page.waitForTimeout(1000);report.stages.push('Requests navigation');
}finally{fs.writeFileSync('plans/evidence/admin-table-phase3/webkit-notification-diagnostic.json',JSON.stringify(report,null,2));await context.close();await browser.close();}
console.log(JSON.stringify(report));
