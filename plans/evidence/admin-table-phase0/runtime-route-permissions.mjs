// Real browser Auth/layout checks with synthetic resident and removed admin.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {privateDir} from './runtime-stack.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const users=JSON.parse(fs.readFileSync(privateDir+'/users.json','utf8'));
const report={passed:false,checks:[],failures:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const name of ['resident','removedAdmin']){
  const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(15000);
  try{
   await page.goto('http://127.0.0.1:3140/login',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>Object.keys(document.querySelector('input[type=email]')??{}).some(key=>key.startsWith('__reactProps')),{},{timeout:15000});
   await page.locator('input[type=email]').fill(users[name].email);await page.locator('input[type=password]').fill(users[name].password);await page.getByRole('button',{name:'Log In',exact:true}).click();
   await page.waitForURL(name==='resident'?'**/resident':'**/dashboard',{timeout:60000});
   await page.goto('http://127.0.0.1:3140/requests',{waitUntil:'domcontentloaded',timeout:60000});
   if(name==='resident'){
    await page.waitForURL('**/login',{timeout:15000});assert.equal(await page.locator('table').count(),0);
    report.checks.push({role:name,result:'redirected to login; no admin table'});
   }else{
    await page.locator('table').waitFor();assert.equal(await page.locator('tbody tr').count(),1000);
    report.checks.push({role:name,result:'baseline defect reproduced: removed administrator can render capped Requests table',rows:1000});
   }
  }finally{await context.close();}
 }
 report.passed=true;
}catch(error){report.failures.push(error.message);console.error(error);process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(new URL('./runtime-route-permissions.json',import.meta.url),JSON.stringify(report,null,2)+'\n');}
console.log(`Browser route permission observations: ${report.checks.length}, passed=${report.passed}`);
