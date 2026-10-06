/* global __dirname */
// Real local browser + Auth/REST/database journeys. No remote site is accessed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),{createClient}=require('@supabase/supabase-js');
const {chromium}=require(process.env.BARANGAYAN_PLAYWRIGHT_PATH||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'plans/evidence/phase7/browser');fs.mkdirSync(output,{recursive:true});
const fixturePath=path.join(root,'dist/phase7-tools/fixtures.json'),fixtures=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
const config=require('./phase7-local-config.cjs')(),trusted=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const report={passed:false,assertions:[],consoleErrors:[]};
const prove=(value,label)=>{assert.ok(value,label);report.assertions.push(label);};
async function login(page,base,label){
 await page.goto(base+'/login',{waitUntil:'networkidle',timeout:60000});
 await page.locator('input[type=email]').fill(fixtures.users[label].email);await page.locator('input[type=password]').fill(fixtures.users[label].password);
 await page.locator('button[type=submit]').click();
 await page.waitForURL(label==='admin'||label==='foreignAdmin'?'**/dashboard':/\/(home|onboarding)$/,{timeout:45000});
 if(new URL(page.url()).pathname==='/onboarding') {await page.getByRole('button',{name:'Continue to Barangayan',exact:true}).click();await page.waitForURL('**/home',{timeout:15000});}
}
async function privatePresentation(page,label){
 const text=await page.locator('body').innerText();prove(!/priority score|\b\d+ pts\b/i.test(text),label+': no visible score');
 const accessibility=await page.locator('body').ariaSnapshot();prove(!/priority score|\b\d+ pts\b/i.test(accessibility),label+': no accessibility score');
 prove(await page.locator('[data-nextjs-dialog]').count()===0,label+': no error overlay');
}
async function main(){
 if(!fixtures.uiDrive){
  fixtures.uiDrive=randomUUID();
  const result=await trusted.from('medical_drives').insert({id:fixtures.uiDrive,barangay_id:'00000000-0000-0000-0000-000000000001',title:'Phase Seven Browser Registration',type:'consultation',drive_date:'2026-10-04',time_start:'08:00',time_end:'12:00',eligible_criteria:'Test residents',stock_total:5,stock_remaining:5});assert.ifError(result.error);fs.writeFileSync(fixturePath,JSON.stringify(fixtures,null,2));
 }
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});page.on('pageerror',e=>report.consoleErrors.push(e.message));
 try{
  await login(page,'http://127.0.0.1:3117','resident');
  await page.goto('http://127.0.0.1:3117/health/my-registrations',{waitUntil:'networkidle',timeout:60000});
  await page.getByRole('button',{name:/Phase Seven Privacy Drive/}).click();await page.getByText('Registration Details',{exact:true}).waitFor({timeout:15000});
  prove((await page.locator('body').innerText()).includes('Applicant Number'),'Resident detail keeps applicant identity');
  await privatePresentation(page,'Resident detail');await page.screenshot({path:path.join(output,'resident-details.png')});
  if(!fixtures.uiRegistration) {
  await page.goto('http://127.0.0.1:3117/health/register/'+fixtures.uiDrive,{waitUntil:'networkidle',timeout:60000});
  await page.getByRole('checkbox',{name:'I understand and consent',exact:true}).check();
  await page.getByRole('button',{name:'Submit Registration',exact:true}).click();await page.getByText('Registration Confirmed!',{exact:true}).waitFor({timeout:20000});
  await privatePresentation(page,'Resident confirmation');prove((await page.locator('body').innerText()).includes('Your Applicant Number'),'Confirmation retains applicant number');
  await page.screenshot({path:path.join(output,'resident-confirmation.png')});
  }
  const registration=await trusted.from('drive_registrations').select('id,applicant_number,score:drive_registration_scores!inner(priority_score)').eq('drive_id',fixtures.uiDrive).eq('user_id',fixtures.users.resident.id).single();assert.ifError(registration.error);
  prove(registration.data.score.priority_score===20,'Browser submission creates expected protected senior score');
  fixtures.uiRegistration=registration.data.id;fs.writeFileSync(fixturePath,JSON.stringify(fixtures,null,2));
  await page.goto('http://127.0.0.1:3117/health/my-registrations',{waitUntil:'networkidle',timeout:30000});
  await page.getByRole('button',{name:/Phase Seven Browser Registration/}).waitFor({timeout:15000});
  prove(await page.getByRole('button',{name:/Phase Seven Browser Registration/}).isVisible(),'Confirmation returns to saved registration list');
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/Phase Seven Browser Registration/}).waitFor({timeout:15000});prove(await page.getByRole('button',{name:/Phase Seven Browser Registration/}).isVisible(),'Reload preserves score-free registration');
  const adminPage=await browser.newPage({viewport:{width:1440,height:1000}});adminPage.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});adminPage.on('pageerror',e=>report.consoleErrors.push(e.message));
  await login(adminPage,'http://127.0.0.1:3118','admin');await adminPage.goto('http://127.0.0.1:3118/health/applicants',{waitUntil:'networkidle',timeout:60000});
  await adminPage.getByText('Priority Score',{exact:true}).waitFor({timeout:15000});
  const row=adminPage.locator('tr').filter({hasText:registration.data.applicant_number}).filter({hasText:'Phase Seven Browser Registration'});
  prove(await row.count()===1,'Administrator protected join renders browser applicant');prove((await row.innerText()).includes('20'),'Administrator table retains correct score');
  await row.getByRole('button',{name:'View registration '+registration.data.applicant_number,exact:true}).click();
  await adminPage.getByRole('dialog').getByText('Priority Score',{exact:true}).waitFor({timeout:15000});prove(/priority score/i.test(await adminPage.getByRole('dialog').innerText()),'Administrator detail retains score');
  await adminPage.screenshot({path:path.join(output,'admin-score-details.png')});
  // The older web resident portal shares the admin application but must receive
  // its resident role gate and remain unable to load the protected applicants.
  const legacy=await browser.newPage();await legacy.goto('http://127.0.0.1:3118/login',{waitUntil:'networkidle'});
  await legacy.locator('input[type=email]').fill(fixtures.users.resident.email);await legacy.locator('input[type=password]').fill(fixtures.users.resident.password);await legacy.locator('button[type=submit]').click();await legacy.waitForURL('**/resident',{timeout:45000});
  await legacy.goto('http://127.0.0.1:3118/health/applicants',{waitUntil:'networkidle'});prove(new URL(legacy.url()).pathname==='/login','Legacy web resident cannot open administrator scores');
  await legacy.goto('http://127.0.0.1:3118/resident',{waitUntil:'networkidle'});
  await privatePresentation(legacy,'Legacy resident portal');
  prove(report.consoleErrors.length===0,'No observed browser console or page errors');report.passed=true;
 }finally{await browser.close();}
}
main().then(()=>console.log('PASS '+report.assertions.length+' real browser/database assertions')).catch(e=>{report.error=e.message;console.error(e.message);process.exitCode=1;}).finally(()=>fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2)));
