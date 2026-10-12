import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('dist/admin-table-phase1-browsers');
const {chromium}=require('playwright');
const users=JSON.parse(fs.readFileSync('dist/admin-table-phase3-runtime/users.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Manila'});
const page=await context.newPage();page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:3140/login',{timeout:90000});
 await page.locator('input[type=email]').fill(users.admin.email);
 await page.locator('input[type=password]').fill(users.admin.password);
 await page.getByRole('button',{name:'Log In',exact:true}).click();
 await page.waitForURL('**/dashboard',{timeout:90000});
 for(const route of ['requests','transactions']) {
  await page.goto('http://127.0.0.1:3140/'+route,{timeout:90000});
  await page.getByRole('region',{name:(route==='requests'?'Requests':'Transactions')+' rows and columns',exact:true}).waitFor({timeout:60000});
  assert.equal(await page.locator('tbody tr').count(),10);
  console.log(route,await page.locator('.table-browse-pagination').first().innerText());
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.waitForURL('**page=2**');
  await page.waitForFunction(()=>document.querySelector('.table-browse-panel')?.getAttribute('aria-busy')==='false');
  console.log(route,'next',await page.locator('.table-browse-pagination').first().innerText());
  await page.getByLabel('Search',{exact:true}).fill('Beyond Cap Needle');
  await page.waitForFunction(()=>document.querySelector('.table-browse-pagination')?.textContent.includes('of 1') && document.querySelector('tbody')?.textContent.includes('Beyond Cap Needle'));
  console.log(route,'search beyond cap passed');
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync('plans/evidence/admin-table-phase3/smoke.json',JSON.stringify({passed:true,errors},null,2));
} catch(e) {
 await page.screenshot({path:'plans/evidence/admin-table-phase3/smoke-failure.png'});
 fs.writeFileSync('plans/evidence/admin-table-phase3/smoke.json',JSON.stringify({passed:false,error:e.message,errors,text:await page.locator('body').innerText()},null,2));
 throw e;
} finally {await context.close();await browser.close();}
