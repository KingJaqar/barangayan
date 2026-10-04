/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname,'..');
const database = process.argv[2];
const run = process.argv[3] || 'database-reviewed';
if (!['phase1_existing','phase1_empty','phase1_foundation_empty'].includes(database) || !/^[a-z0-9-]+$/.test(run)) throw new Error('Only isolated Phase 1 rehearsal databases are allowed');
const output = path.join(root,'plans/evidence/phase1',run,database);
fs.mkdirSync(output,{recursive:true});
if (fs.existsSync(path.join(output,'tests.json'))) throw new Error('Use a new evidence directory to preserve results');
const checks = [
  ['foundations','supabase/tests/service_foundations.test.sql'],
  ['legacy-rls','supabase/tests/rls_isolation.test.sql'],
  // This historical filename covers shared backend tenant guards, not app code.
  ['tenant-write-guards','supabase/tests/resident_ios_tenant_write_guards.test.sql'],
  ...(database === 'phase1_existing' ? [['historical-reads','scripts/fixtures/phase1-history-reads.sql']] : []),
];
const results = checks.map(([name,file]) => {
  const response = spawnSync(path.join(root,'dist/phase1-tools/postgres/pgsql/bin/psql.exe'),['-X','-h','127.0.0.1','-p','55431','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-c','set search_path=public,extensions','-f',path.join(root,file)],{cwd:root,encoding:'utf8',timeout:60000});
  fs.writeFileSync(path.join(output,name+'.log'),response.stdout + response.stderr);
  const assertions = (response.stdout.match(/\bok \d+ - /g) || []).length;
  const passed = response.status === 0 && assertions > 0 && !/not ok|Looks like you failed|planned \d+ tests but ran/.test(response.stdout);
  return {name,file,exitCode:response.status,assertions,passed};
});
fs.writeFileSync(path.join(output,'tests.json'),JSON.stringify({database,finishedAt:new Date().toISOString(),results},null,2));
for (const check of results) console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}: ${check.assertions} assertions`);
if (results.some(r=>!r.passed)) process.exitCode=1;
