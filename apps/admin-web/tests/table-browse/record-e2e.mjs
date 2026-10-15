// Actual Next.js routes, session cookies, Server Actions, Supabase REST/RPC and
// PostgreSQL. No application adapters or data requests are mocked.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../../../..');
const app = path.join(root, 'apps/admin-web');
const require = createRequire(path.join(app, 'package.json'));
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const evidence = path.join(root, 'plans/evidence/admin-record-lifecycle');
const sql = statement => {
  const result = spawnSync('docker', ['exec','-i','supabase_db_barangayan','psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],
    { input: statement, encoding:'utf8', windowsHide:true });
  if (result.status !== 0) throw new Error(result.stderr || 'Local database query failed.');
  return result.stdout.trim();
};
const statusResult = spawnSync('cmd.exe',['/d','/s','/c','npx supabase status -o json'], { cwd:root,encoding:'utf8',windowsHide:true });
if (statusResult.status !== 0) throw new Error('Local Supabase is unavailable.');
const local = JSON.parse(statusResult.stdout);
assert.ok(['127.0.0.1','localhost'].includes(new URL(local.API_URL).hostname), 'Never seed or test against a hosted database');
const admin = createClient(local.API_URL,local.SERVICE_ROLE_KEY,{ auth:{ persistSession:false,autoRefreshToken:false } });
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL:local.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY, BARANGAYAN_PREVIEW_DIST_DIR:'.next-record-e2e', NEXT_TELEMETRY_DISABLED:'1' };
const nextBin = require.resolve('next/dist/bin/next');
const baseUrl = 'http://127.0.0.1:4196';
const accounts = [];
const report = { checks:[],pageErrors:[],consoleErrors:[],httpErrors:[],limitations:['Local Supabase with synthetic accounts and records; no live payment/refund provider request.'] };
let browser, page, server;
let serverLog = '';
const save = () => fs.writeFileSync(path.join(evidence,'e2e-results.json'),JSON.stringify(report,null,2));
async function runNext(args) {
  console.log(`Next.js ${args[0]} starting with local Supabase.`);
  const process = spawn(env.NODE_BINARY ?? globalThis.process.execPath,[nextBin,...args],{ cwd:app,env,windowsHide:true,stdio:['ignore','pipe','pipe'] });
  let log = '';
  process.stdout.on('data',chunk => { log += chunk; }); process.stderr.on('data',chunk => { log += chunk; });
  const code = await new Promise(resolve => process.once('exit',resolve));
  fs.writeFileSync(path.join(evidence,'e2e-build.txt'),log);
  if (code !== 0) throw new Error(log.slice(-4000));
}
const uuid = (prefix,number) => `${prefix}1180000-0000-0000-0000-${String(number).padStart(12,'0')}`;
const entity = { requests:['service_requests',uuid('d',1)],transactions:['payments',uuid('e',1)],
  incidents:['incidents',uuid('f',1)],health:['medical_drives',uuid('f',2)],applicants:['drive_registrations',uuid('f',3)],
  households:['household_members',uuid('f',4)] };
async function databaseRow(screen) {
  const [table,id] = entity[screen]; const { data,error } = await admin.from(table).select('*').eq('id',id).maybeSingle();
  assert.equal(error,null,`${screen}: independent database read`); return data;
}
async function closeDetails() {
  await page.getByRole('dialog').first().getByRole('button',{name:'Close form',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'detached'});
}
async function toast(message) {
  await page.getByRole('alert').filter({hasText:message}).last().waitFor();
  // Success is reported after the write, while router.refresh is still rendering.
  // Wait for that response before a hard test navigation aborts its RSC stream.
  await page.waitForLoadState('networkidle');
}
function rowAction(screen, name) {
  const scope = screen === 'staff' ? page.locator('tbody tr').filter({hasText:/Lifecycle Staff|E2E staff/}) : page;
  return scope.getByRole('button',{name,exact:true}).first();
}
async function open(screen) {
  const routes = { requests:'/requests',transactions:'/transactions',residents:'/residents',incidents:'/incident-reports',
    health:'/health',applicants:'/health/applicants',households:'/households-residents',staff:'/staff' };
  await page.waitForLoadState('networkidle');
  await page.goto(baseUrl+routes[screen]+'?tab=all');
  await rowAction(screen,'View Details').waitFor();
}
try {
  // Use the existing PostgreSQL fixture shape with new IDs and genuine Auth users.
  for (const role of ['admin','resident','staff','foreign']) {
    const email = `row-e2e-${role}-${randomUUID()}@example.test`;
    const password = randomUUID()+'Aa1!';
    const { data,error } = await admin.auth.admin.createUser({email,password,email_confirm:true});
    if (error) throw error;
    accounts.push({id:data.user.id,email,password});
  }
  let seed = fs.readFileSync(path.join(root,'supabase/tests/admin_record_lifecycle.test.sql'),'utf8');
  seed = seed.slice(seed.indexOf('insert into public.barangays'),seed.indexOf('create temp table lifecycle_fixture'));
  seed = seed.replace(/insert into auth\.users[\s\S]+?;\r?\n/,'');
  seed = seed.replaceAll('1150000','1180000');
  for (let index=0;index<accounts.length;index++) seed = seed.replaceAll(uuid('b',index+1),accounts[index].id);
  sql('begin;\n'+seed+'\ncommit;');
  entity.residents=['profiles',accounts[1].id];
  entity.staff=['barangay_officials',sql(`select id from public.barangay_officials where profile_id='${accounts[2].id}';`)];
  sql(`update public.service_requests set payment_method='pickup' where id='${entity.requests[1]}';
    update public.profiles set sex='female' where id='${accounts[1].id}'; notify pgrst,'reload schema';`);
  if (process.env.RECORD_E2E_REUSE_BUILD !== '1') await runNext(['build','--webpack']);
  server = spawn(process.execPath,[nextBin,'start','--port','4196','--hostname','127.0.0.1'],{ cwd:app,env,windowsHide:true,stdio:['ignore','pipe','pipe'] });
  server.stdout.on('data',chunk => { serverLog += chunk; }); server.stderr.on('data',chunk => { serverLog += chunk; });
  for (let attempt=0;attempt<60;attempt++) {
    if (await fetch(baseUrl+'/login').then(response=>response.ok).catch(()=>false)) break;
    await new Promise(resolve=>setTimeout(resolve,500));
    if (attempt===59) throw new Error('Local Admin Web did not start.');
  }
  browser = await chromium.launch({channel:'chrome',headless:true});
  page = await browser.newPage({viewport:{width:1600,height:1000}}); page.setDefaultTimeout(20000);
  page.on('pageerror',error=>report.pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)report.httpErrors.push({url:new URL(response.url()).pathname,status:response.status()});});
  // Refuse accidental hosted database access from the browser as well as the server.
  await page.route('https://*.supabase.co/**',route=>route.abort('blockedbyclient'));
  await page.goto(baseUrl+'/login');
  await page.getByLabel('Email',{exact:true}).fill(accounts[0].email);
  await page.getByLabel('Password',{exact:true}).fill(accounts[0].password);
  await page.getByRole('button',{name:'Log In',exact:true}).click();
  await page.waitForURL('**/dashboard');
  report.checks.push({screen:'authentication',status:'passed',checks:['real local Supabase Auth','admin session cookies','server route guard']}); save();

  for (const [screen,field,value,key] of [['requests','Notes','E2E saved note','requester_notes'],
    ['transactions','Amount (centavos)','6000','amount_centavos'],['residents','Occupation','E2E occupation','occupation'],
    ['incidents','Title','E2E incident','title'],['health','Location','E2E clinic','location'],['applicants','Age','35','age'],
    ['households','Name','E2E member','name'],['staff','Full name','E2E staff','full_name']]) {
    console.log(`Checking ${screen}: details → save → archive → restore.`);
    await open(screen);
    await rowAction(screen,'View Details').click();
    const sheet=page.getByRole('dialog').first();
    await sheet.getByRole('button',{name:'Edit',exact:true}).waitFor();
    await sheet.getByRole('button',{name:'Edit',exact:true}).click();
    await sheet.getByLabel(field,{exact:false}).first().fill(value);
    await sheet.getByRole('button',{name:'Save',exact:true}).click();
    await toast('Changes saved.'); await sheet.getByRole('button',{name:'Edit',exact:true}).waitFor();
    const saved = screen==='staff' ? (await admin.from('profiles').select('full_name').eq('id',accounts[2].id).single()).data : await databaseRow(screen);
    assert.equal(String(saved[key]),value,`${screen}: actual database saved value`);
    await page.screenshot({path:path.join(evidence,`e2e-${screen}-details.png`)});
    await closeDetails();
    await rowAction(screen,'Archive').click();
    await page.getByRole('dialog',{name:'archive record',exact:true}).getByRole('button',{name:'Archive record',exact:true}).click();
    await toast('Record archived.');
    assert.ok((await databaseRow(screen)).deleted_at,`${screen}: archive persisted`);
    await page.getByRole('link',{name:'Browse archived records',exact:true}).click();
    await page.waitForURL(`**/archive/${screen}**`);
    await page.getByRole('button',{name:'View Details',exact:true}).first().click();
    await page.getByRole('dialog').first().getByText('Archived record',{exact:true}).waitFor(); await closeDetails();
    await page.getByRole('button',{name:'Restore',exact:true}).first().click();
    await page.getByRole('dialog',{name:'restore record',exact:true}).getByRole('button',{name:'Restore record',exact:true}).click();
    await toast('Record restored.'); assert.equal((await databaseRow(screen)).deleted_at,null,`${screen}: restore persisted`);
    await open(screen);
    report.checks.push({screen,status:'passed',checks:['actual route and projection','read-only sheet','Server Action save','independent database readback','archive route','archived details','restore','active list refreshed']}); save();
  }

  await open('staff');
  const ownStaff = page.locator('tbody tr').filter({hasText:'Lifecycle Admin'});
  assert.ok(await ownStaff.getByRole('button',{name:'Archive',exact:true}).isDisabled());
  assert.ok(await ownStaff.getByRole('button',{name:'Delete',exact:true}).isDisabled());
  report.checks.push({screen:'staff self-protection',status:'passed',checks:['own Archive/Delete actions disabled']}); save();
  await open('health'); await rowAction('health','Delete').click();
  const blockedDeletion = page.getByRole('dialog',{name:'delete record',exact:true});
  await blockedDeletion.getByRole('button',{name:'Delete permanently',exact:true}).click();
  await blockedDeletion.getByRole('alert').filter({hasText:'related records'}).waitFor();
  assert.ok(await databaseRow('health'),'Related registrations prevent removal of the drive');
  await blockedDeletion.getByRole('button',{name:'Cancel',exact:true}).click(); await closeDetails();
  report.checks.push({screen:'related-record constraint',status:'passed',checks:['real foreign-key constraint','clear retryable feedback','record retained']}); save();

  console.log('Checking request workflow and incident withdrawal against PostgreSQL.');
  await open('requests');
  await page.getByRole('button',{name:'Move to Processing',exact:true}).click(); await toast('Request moved to processing.');
  assert.equal((await databaseRow('requests')).status,'in_progress');
  await page.getByRole('button',{name:'Mark as Ready for Pickup',exact:true}).click(); await toast('Request marked ready for pickup.');
  assert.equal((await databaseRow('requests')).status,'ready_for_pickup');
  await page.getByRole('button',{name:'Mark Payment Collected',exact:true}).click(); await toast('Payment marked as collected.');
  assert.equal((await databaseRow('requests')).payment_status,'paid');
  await page.getByRole('button',{name:'Mark as Completed',exact:true}).click(); await toast('Request marked as completed.');
  assert.equal((await databaseRow('requests')).status,'completed');
  report.checks.push({screen:'request workflow',status:'passed',checks:['processing','pickup readiness','payment ledger collection','completion','all independently read back']}); save();
  await open('incidents');
  await page.getByRole('button',{name:'Mark as In Progress',exact:true}).click(); await toast('Incident marked as in progress.');
  await page.getByRole('button',{name:'Withdraw',exact:true}).click(); await toast('Report withdrawn.');
  assert.equal((await databaseRow('incidents')).status,'withdrawn');
  report.checks.push({screen:'incident workflow',status:'passed',checks:['in progress','withdrawal','persisted withdrawn status']}); save();
  for(const operation of ['Withdraw','Mark as Resolved','Mark as Unresolved']) {
    sql(`update public.incidents set status='open',created_at='2020-01-01T00:00:00Z' where id='${entity.incidents[1]}';`);
    await open('incidents');
    if(operation==='Mark as Resolved') {
      await page.getByRole('button',{name:'Mark as In Progress',exact:true}).click(); await toast('Incident marked as in progress.');
    }
    await page.getByRole('button',{name:operation,exact:true}).click();
    await toast(operation==='Withdraw'?'Report withdrawn.':operation==='Mark as Resolved'?'Incident marked as resolved.':'Incident marked as unresolved.');
    assert.equal((await databaseRow('incidents')).status,operation==='Withdraw'?'withdrawn':operation==='Mark as Resolved'?'resolved':'unresolved');
  }
  report.checks.push({screen:'incident terminal transitions',status:'passed',checks:['old open-report withdrawal','resolution after processing','unresolved transition','persisted status']}); save();

  const cancelledId=uuid('d',2);
  sql(`insert into public.service_requests(id,barangay_id,resident_id,document_type_id,payment_method)
    values('${cancelledId}','${uuid('a',1)}','${accounts[1].id}','${uuid('c',1)}','pickup');`);
  await open('requests');
  await page.getByRole('button',{name:'Cancel Request',exact:true}).click();
  await page.getByLabel('Reason for cancellation',{exact:true}).fill('E2E resident requested cancellation');
  await page.getByRole('button',{name:'Confirm',exact:true}).click(); await toast('Request cancelled.');
  const {data:cancelled,error:cancelError}=await admin.from('service_requests').select('status,reference_number').eq('id',cancelledId).single();
  assert.equal(cancelError,null); assert.equal(cancelled.status,'cancelled');
  await page.locator('tbody tr').filter({hasText:cancelled.reference_number}).getByRole('button',{name:'Delete',exact:true}).click();
  await page.getByRole('dialog',{name:'delete record',exact:true}).getByRole('button',{name:'Delete permanently',exact:true}).click(); await toast('Record permanently deleted.');
  report.checks.push({screen:'request cancellation',status:'passed',checks:['required note','guarded RPC','persisted cancellation','cancelled request deletion']}); save();
  await open('applicants');
  await page.getByRole('button',{name:'Cancel Registration',exact:true}).click();
  await page.getByRole('button',{name:'Cancel registration?',exact:true}).click(); await toast('Registration cancelled.');
  assert.equal((await databaseRow('applicants')).status,'cancelled');
  report.checks.push({screen:'applicant workflow',status:'passed',checks:['confirmed registration cancellation','persisted status']}); save();
  // Respect actual related-record constraints instead of bypassing them for a test.
  for (const screen of ['transactions','requests','applicants','health','incidents','households','staff','residents']) {
    console.log(`Checking ${screen}: confirmed permanent deletion.`);
    await open(screen); await rowAction(screen,'Delete').click();
    const dialog=page.getByRole('dialog',{name:'delete record',exact:true});
    await dialog.getByText(/cannot be undone/).waitFor();
    await dialog.getByRole('button',{name:'Delete permanently',exact:true}).click(); await toast('Record permanently deleted.');
    assert.equal(await databaseRow(screen),null,`${screen}: permanently deleted in actual database`);
    report.checks.push({screen:`${screen} deletion`,status:'passed',checks:['irreversible confirmation','Server Action','database record absent']}); save();
  }
  assert.deepEqual(report.pageErrors,[]); assert.deepEqual(report.consoleErrors,[]); assert.deepEqual(report.httpErrors,[]);
  assert.ok(!serverLog.includes('⨯ Error:'),'Server log has no action/runtime errors');
  report.status='passed'; console.log('Real Admin Web → Supabase → PostgreSQL checks passed.');
} catch(error) {
  report.status='failed'; report.error=String(error);
  if(page) { report.pageText=(await page.locator('body').innerText().catch(()=>'')); await page.screenshot({path:path.join(evidence,'e2e-failure.png')}).catch(()=>{}); }
  console.error(report.error); globalThis.process.exitCode=1;
} finally {
  await browser?.close(); server?.kill();
  fs.writeFileSync(path.join(evidence,'e2e-server.txt'),serverLog);
  // Fixture cleanup stays explicitly scoped to this test tenant and user IDs.
  if(accounts.length) {
    try {
      sql(`begin;
        delete from public.admin_audit_log where barangay_id in ('${uuid('a',1)}','${uuid('a',2)}');
        delete from public.payments where barangay_id in ('${uuid('a',1)}','${uuid('a',2)}');
        delete from public.service_requests where barangay_id in ('${uuid('a',1)}','${uuid('a',2)}');
        delete from public.incidents where barangay_id in ('${uuid('a',1)}','${uuid('a',2)}');
        delete from public.drive_registrations where drive_id in (select id from public.medical_drives where barangay_id in ('${uuid('a',1)}','${uuid('a',2)}'));
        delete from public.medical_drives where barangay_id in ('${uuid('a',1)}','${uuid('a',2)}');
        delete from public.document_types where barangay_id in ('${uuid('a',1)}','${uuid('a',2)}');
        delete from public.profiles where id in (${accounts.map(account=>`'${account.id}'`).join(',')});
        delete from public.barangays where id in ('${uuid('a',1)}','${uuid('a',2)}'); commit;`);
      for(const account of accounts) { const {error}=await admin.auth.admin.deleteUser(account.id); if(error)throw error; }
      report.fixtureCleanup='passed';
    } catch(error) { report.fixtureCleanup=String(error); globalThis.process.exitCode=1; }
  }
  save();
}
