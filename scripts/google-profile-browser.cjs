/* global __dirname */
const {chromium}=require(process.env.BARANGAYAN_PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),output=path.join(root,'plans/evidence/phase6/google-minimal-browser');
fs.mkdirSync(output,{recursive:true});
const users=JSON.parse(fs.readFileSync(path.join(root,'dist/phase6-tools/google-minimal-users.json'),'utf8'));
const report={passed:false,assertions:[],consoleErrors:[]};
const prove=(condition,label)=>{assert.ok(condition,label);report.assertions.push(label);};
function sql(source) {
 const result=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker','exec','-i','supabase_db_barangayan','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{input:source,encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,'Synthetic local database command failed');return result.stdout.trim();
}
async function main() {
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  page.on('pageerror',error=>report.consoleErrors.push(error.message));
  await page.goto('http://127.0.0.1:3107/login',{waitUntil:'networkidle',timeout:60000});
  await page.screenshot({path:path.join(output,'login.png')});
  if(process.argv[2]==='inspect') {
   console.log(JSON.stringify({labels:await page.locator('label').allTextContents(),buttons:await page.getByRole('button').allTextContents()},null,2));return;
  }
  const fixture=users.incomplete;
  assert.match(fixture.id,/^[a-f0-9-]{36}$/);assert.match(fixture.email,/^google-profile-other-.*@test\.local$/);
  assert.equal(sql(`select email from auth.users where id='${fixture.id}'`),fixture.email,'Only task-created fixture may be changed');
  sql(`delete from public.profiles where id='${fixture.id}';`);
  prove(sql(`select count(*) from public.profiles where id='${fixture.id}'`)==='0','Prepare earlier Google account without a profile');
  await page.locator('input[type=email]').fill(fixture.email);
  await page.locator('input[type=password]').fill(fixture.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/home',{timeout:45000});
  await page.getByRole('link',{name:'Complete profile',exact:true}).waitFor({timeout:30000});
  prove(sql(`select count(*) from public.profiles where id='${fixture.id}'`)==='1','Web session startup repairs missing Google profile');
  prove((await page.locator('body').innerText()).includes('Browser'),'Home uses the saved Google account name');
  await page.screenshot({path:path.join(output,'incomplete-home.png')});
  await page.goto('http://127.0.0.1:3107/reports/new',{waitUntil:'networkidle',timeout:45000});
  prove(new URL(page.url()).pathname==='/complete-profile','Direct report link still requires resident details');
  prove(new URL(page.url()).searchParams.get('next')==='/reports/new','Completion retains the intended report route');
  prove(await page.locator('input').evaluateAll(inputs=>inputs.some(input=>input.value==='Browser')&&inputs.some(input=>input.value==='Resident')),'Completion prefills persisted first and last names');
  await page.getByRole('button',{name:'Skip for now — browse information',exact:true}).click();
  await page.waitForURL('**/home',{timeout:30000});
  prove(await page.getByRole('link',{name:'Complete profile',exact:true}).isVisible(),'Skip retains incomplete account browsing and reminder');
  prove(sql(`select profile_completed_at is null from public.profiles where id='${fixture.id}'`)==='t','Skip keeps the minimal row incomplete');
  await page.reload({waitUntil:'networkidle',timeout:45000});
  prove(await page.getByRole('link',{name:'Complete profile',exact:true}).isVisible(),'Reload retains authenticated incomplete account');
  prove(sql(`select count(*) from public.profiles where id='${fixture.id}'`)==='1','Reload does not duplicate profiles');
  await page.screenshot({path:path.join(output,'skip-retains-profile.png')});
  prove(report.consoleErrors.length===0,'Browser has no observed console/page errors');
  report.passed=true;console.log(`PASS: ${report.assertions.length} browser/database assertions (synthetic linked identity, not Google consent).`);
 } finally {await browser.close();}
}
main().catch(error=>{report.error=error.message;console.error(error.message);process.exitCode=1;})
 .finally(()=>fs.writeFileSync(path.join(output,process.argv[2]==='inspect'?'inspection.json':'results.json'),JSON.stringify(report,null,2)));
