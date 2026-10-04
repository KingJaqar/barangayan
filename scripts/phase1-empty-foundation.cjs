/* global __dirname */
// Separately verifies the additive migration on a schema-only pre-Phase-1 baseline.
// This does not repair or claim success for the broken full migration chain.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname,'..');
const bin = path.join(root,'dist/phase1-tools/postgres/pgsql/bin');
const run = process.argv[2] || 'database-reviewed';
if (!/^[a-z0-9-]+$/.test(run)) throw new Error('Invalid evidence directory');
const output = path.join(root,'plans/evidence/phase1',run);
const resultsFile = path.join(output,'empty-foundation.json');
fs.mkdirSync(output,{recursive:true});
if (fs.existsSync(resultsFile)) throw new Error('Use a new evidence directory to preserve results');
const common = ['-h','127.0.0.1','-p','55431','-U','postgres'];
const database = 'phase1_foundation_empty';
const results = [];
function command(name,args,label) {
  const startedAt = new Date().toISOString();
  const response = spawnSync(path.join(bin,name+'.exe'),[...common,...args],{cwd:root,encoding:'utf8',timeout:60000});
  fs.appendFileSync(path.join(output,'empty-foundation.log'),label+'\n'+response.stdout+response.stderr+'\n');
  results.push({label,startedAt,finishedAt:new Date().toISOString(),exitCode:response.status});
  fs.writeFileSync(resultsFile,JSON.stringify({database,results},null,2));
  if (response.status !== 0) throw new Error(response.stderr);
  return response.stdout;
}
const schema = path.join(root,'dist/phase1-tools/baseline-schema.sql');
if (!fs.existsSync(schema)) throw new Error('First run the representative rehearsal to produce a pre-foundation schema-only dump');
command('dropdb',['--if-exists',database],'Reset isolated empty-foundation database');
command('createdb',[database],'Create isolated empty-foundation database');
command('psql',['-X','-v','ON_ERROR_STOP=1','-d',database,'-f',schema],'Restore schema-only baseline through 0094');
const rows = command('psql',['-X','-At','-d',database,'-c',"select (select count(*) from public.barangays)+(select count(*) from public.profiles)+(select count(*) from public.document_types)+(select count(*) from public.service_requests)+(select count(*) from public.payments)"],'Verify no application records before additive migration');
if (rows.trim() !== '0') throw new Error('The empty-foundation baseline contains application data');
command('psql',['-X','-v','ON_ERROR_STOP=1','-d',database,'-f',path.join(root,'supabase/migrations/0095_phase1_shared_foundations.sql')],'Apply additive Phase 1 migration to empty application schema');
console.log('PASS: additive Phase 1 migration on empty application schema');
