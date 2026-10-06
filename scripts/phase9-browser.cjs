/* global __dirname, Buffer */
// Full synthetic local UI journey. Never opens deployed URLs or uses production identities.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),run=process.argv[2]||'browser';assert.match(run,/^[a-z0-9-]+$/);
const output=path.join(root,'plans/evidence/phase9',run);fs.mkdirSync(output,{recursive:true});assert.ok(!fs.existsSync(path.join(output,'results.json')));
const fixture=JSON.parse(fs.readFileSync(path.join(root,'dist/phase9-tools/services/ui-users.json'),'utf8'));
const config=require('./phase7-local-config.cjs')();
const trusted=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(10000)})}});
const report={passed:false,assertions:[],consoleErrors:[],journeys:[]};
const prove=(value,label)=>{assert.ok(value,label);report.assertions.push(label);};
const read=async id=>{const r=await trusted.from('service_requests').select('*').eq('id',id).single();assert.ifError(r.error);return r.data;};
async function login(page,base,role){
 await page.goto(base+'/login',{waitUntil:'networkidle',timeout:60000});
 await page.locator('input[type=email]').fill(fixture[role].email);await page.locator('input[type=password]').fill(fixture[role].password);
 await page.locator('button[type=submit]').click();await page.waitForURL(role==='admin'?'**/dashboard':/\/(home|onboarding)$/,{timeout:45000});
 if(new URL(page.url()).pathname==='/onboarding'){await page.getByRole('button',{name:'Continue to Barangayan',exact:true}).click();await page.waitForURL('**/home');}
}
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const resident=await browser.newPage({viewport:{width:1280,height:950}}),admin=await browser.newPage({viewport:{width:1440,height:1100}});
 for(const page of [resident,admin]){page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>report.consoleErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});}
 try{
  await login(resident,'http://127.0.0.1:3117','resident');await login(admin,'http://127.0.0.1:3118','admin');
  const catalogs=await trusted.from('document_types').select('*').eq('barangay_id','00000000-0000-0000-0000-000000000001').in('service_kind',['business','indigency','first_time_job_seeker','certified_true_copy']);assert.ifError(catalogs.error);assert.equal(catalogs.data.length,4);
  for(const doc of catalogs.data){
   await resident.goto('http://127.0.0.1:3117/services/requests/new/'+doc.id,{waitUntil:'networkidle',timeout:60000});
   await resident.getByRole('button',{name:'Submit request',exact:true}).waitFor();
   await resident.getByText('Valid ID Verified',{exact:false}).first().waitFor({timeout:15000});
   prove(await resident.getByRole('heading',{name:'Resident Details'}).isVisible(),doc.service_kind+': resident details retained');
   const purpose=doc.purposes[0];await resident.getByLabel('Purpose of request',{exact:true}).selectOption(purpose.code);
   if(doc.service_kind==='business'){
    await resident.getByLabel('Business name',{exact:true}).fill('Phase Nine Browser Shop');await resident.getByLabel('Establishment address',{exact:true}).fill('9 Synthetic Street');
    await resident.getByLabel('DTI registration',{exact:true}).setInputFiles({name:'dti.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64')});
   }
   if(doc.service_kind==='certified_true_copy'){await resident.getByLabel('Record/document reference',{exact:true}).fill('Synthetic record 9');await resident.getByLabel('Number of copies',{exact:true}).fill('3');}
   if(doc.requirement_rules.personalAppearance)await resident.getByRole('checkbox',{name:/I understand that personal appearance/}).check();
   await resident.getByRole('button',{name:'Submit request',exact:true}).click();await resident.waitForURL(/\/services\/payment\/[0-9a-f-]+$/,{timeout:30000});
   const id=new URL(resident.url()).pathname.split('/').pop();
   await resident.getByText('Awaiting fee assessment',{exact:true}).waitFor({timeout:15000});
   prove(await resident.getByRole('button',{name:'Continue',exact:true}).count()===0,doc.service_kind+': pending assessment blocks payment');
   await resident.screenshot({path:path.join(output,doc.service_kind+'-submitted.png')});
   await admin.goto('http://127.0.0.1:3118/requests/'+id,{waitUntil:'networkidle',timeout:60000});
   await admin.getByRole('checkbox',{name:'Required documents checked and complete'}).check();await admin.getByLabel(/^Eligibility/).selectOption('eligible');
   await admin.getByRole('checkbox',{name:/Applicant appeared in person/}).check();await admin.getByLabel('Review findings / missing requirements / eligibility basis').fill('Synthetic originals and eligibility checked');
   await admin.getByRole('button',{name:'Record review and appearance',exact:true}).click();
   await admin.getByRole('button',{name:'Accept complete requirements',exact:true}).waitFor({state:'visible'});
   await admin.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Accept complete requirements');return b&&!b.disabled;},{},{timeout:20000});
   const waived=doc.service_kind==='first_time_job_seeker';
   if(waived)await admin.getByRole('checkbox',{name:/Explicit fee waiver/}).check();
   else if(doc.service_kind==='certified_true_copy')await admin.getByLabel('Total billable pages across all requested copies').fill('4');
   else await admin.getByLabel('Confirmed amount (₱)',{exact:true}).fill('40');
   await admin.getByLabel('Fee or exemption basis',{exact:true}).fill(waived?'Confirmed first-job exemption':'Confirmed synthetic fee');
   await admin.getByRole('button',{name:'Confirm assessment',exact:true}).click();
   await admin.getByText(waived?'Fee waived':'Confirmed amount: ₱40.00',{exact:true}).waitFor();
   await resident.reload({waitUntil:'networkidle'});
   if(waived)await resident.getByText('Fee waived — no payment required',{exact:true}).waitFor();
   else{await resident.getByRole('button',{name:'Continue',exact:true}).click();await resident.getByText('Pay at Pickup',{exact:false}).first().waitFor();}
   await admin.reload({waitUntil:'networkidle'});await admin.getByRole('button',{name:'Accept complete requirements',exact:true}).click();
   await admin.getByRole('button',{name:'Mark ready for pickup',exact:true}).waitFor();
   await admin.getByRole('button',{name:'Mark ready for pickup',exact:true}).click();
   await admin.getByRole('button',{name:'Record document release',exact:true}).waitFor();
   if(!waived){prove(await admin.getByRole('button',{name:'Record document release',exact:true}).isDisabled(),doc.service_kind+': unpaid release disabled');await admin.getByRole('button',{name:'Record pickup collection',exact:true}).click();await admin.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Record document release');return b&&!b.disabled;},{},{timeout:20000});}
   await admin.getByRole('button',{name:'Record document release',exact:true}).click();await admin.getByText('Document released.',{exact:true}).waitFor();
   const final=await read(id);prove(final.status==='completed'&&final.sla_state==='released'&&!!final.ready_at&&!!final.released_at,doc.service_kind+': actual UI records readiness and release');
   prove(final.approved_id_submission_id!==null,doc.service_kind+': approved evidence snapshotted');
   const ledger=await trusted.from('payments').select('*').eq('service_request_id',id);assert.ifError(ledger.error);prove(waived?ledger.data.length===0:ledger.data.length===1&&ledger.data[0].amount_centavos===4000&&ledger.data[0].status==='paid',doc.service_kind+': exact amount or waiver ledger');
   await resident.goto('http://127.0.0.1:3117/services/requests/'+id,{waitUntil:'networkidle'});await resident.getByText('Completed Within Target',{exact:false}).first().waitFor();
   const paymentCard=resident.locator('div.rounded-2xl').filter({has:resident.getByText('Payment',{exact:true})});
   prove(await paymentCard.getByText(waived?'Waived':'Paid',{exact:true}).isVisible(),doc.service_kind+': tracking reflects actual payment or waiver');
   prove(await paymentCard.getByText('Pending',{exact:true}).count()===0,doc.service_kind+': settled tracking does not imply pending payment');
   await resident.screenshot({path:path.join(output,doc.service_kind+'-released.png')});await admin.screenshot({path:path.join(output,doc.service_kind+'-admin-released.png')});
   report.journeys.push({kind:doc.service_kind,id,status:final.status,payment:final.payment_status,agencyReady:final.ready_at,released:final.released_at});
  }
  prove(report.consoleErrors.length===0,'No observed browser runtime/console errors');report.passed=true;
 }catch(e){fs.writeFileSync(path.join(output,'failure-resident.txt'),await resident.locator('body').innerText().catch(()=>''));fs.writeFileSync(path.join(output,'failure-admin.txt'),await admin.locator('body').innerText().catch(()=>''));await admin.screenshot({path:path.join(output,'failure-admin.png')}).catch(()=>{});throw e;}finally{await browser.close();}
}
main().then(()=>console.log('PASS '+report.assertions.length+' browser assertions')).catch(e=>{report.error=e.message;console.error(e.message);process.exitCode=1;}).finally(()=>fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2)));
