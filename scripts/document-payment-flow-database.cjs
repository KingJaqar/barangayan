/* Disposable local Postgres rehearsal; no hosted connection strings or real accounts. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname,'..'), output=path.join(root,'dist/document-flow-work');
const repairOnly=process.argv.includes('--repair-only');
fs.mkdirSync(output,{recursive:true});
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
let source=read('scripts/fixtures/phase1-supabase-bootstrap.sql');
const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).filter(file=>/^\d{4}.*\.sql$/.test(file)).sort();
for(const file of migrations){
  if(file.startsWith('0125_'))source+='\n'+read('scripts/fixtures/document-payment-flow/before-migration.sql');
  // Reproduce the hosted drift: migration recorded, but its automatic-payment DDL absent.
  if(repairOnly && file.startsWith('0125_'))continue;
  source+=`\n\\echo MIGRATION:${file}\n`+read('supabase/migrations/'+file)+'\n';
  if(file.startsWith(repairOnly?'0126_':'0125_'))source+='\n'+read('scripts/fixtures/document-payment-flow/after-migration.sql');
}
source+='\n'+read('supabase/tests/automatic_document_payments.test.sql');
for(const file of ['catalog_staff_workflows.test.sql','agency_sla.test.sql','service_foundations.test.sql','admin_request_row_workflows.test.sql','resident_ios_phase3_backend.test.sql','resident_front_id_submission.test.sql','admin_resident_document_requests.test.sql'])
  source+="\nset request.jwt.claims='{}';\nset request.jwt.claim.sub='';\n\\echo TEST:"+file+'\n'+read('supabase/tests/'+file);
const result=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--exec','docker','run','--rm','--interactive','--label','barangayan.task=document-flow-0125','--network','none','--memory','768m','--cpus','2','--user','postgres','--entrypoint','sh','public.ecr.aws/supabase/postgres:17.6.1.155','-c','initdb -D /tmp/document-flow-pg -A trust -U postgres > /tmp/init.log && pg_ctl -D /tmp/document-flow-pg -l /tmp/postgres.log -o "-c shared_preload_libraries=pg_cron -c cron.database_name=postgres" -w start > /tmp/start.log && psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -At'],{input:source,encoding:'utf8',timeout:240000,maxBuffer:32*1024*1024,windowsHide:true});
fs.writeFileSync(path.join(output,repairOnly?'database-repair.log':'database.log'),result.stdout+'\n'+result.stderr);
if(result.status!==0)console.error((result.stdout+'\n'+result.stderr).slice(-5000));
assert.equal(result.status,0,'Migration replay must succeed');
const failures=result.stdout.split(/\r?\n/).filter(line=>/^not ok|Looks like you failed/.test(line));
assert.deepEqual(failures,[]);
console.log(`PASS: ${repairOnly?'hosted-drift repair':migrations.length+' migrations'}, ${result.stdout.split(/\r?\n/).filter(line=>/^ok \d/.test(line)).length} database assertions, including pending-request recovery, front-only IDs and historical payment preservation.`);
