/* Isolated local PostgreSQL rehearsal. Requires the workspace test server on 55439. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist/valid-id-qa/database');
fs.mkdirSync(output, { recursive: true });
const bin = path.join(root, 'dist/phase1-tools/postgres/pgsql/bin');
const database = 'valid_id_0118_test';
function run(name, args) {
  const result = spawnSync(path.join(bin, name + '.exe'), ['-h','127.0.0.1','-p','55439','-U','postgres',...args], { cwd:root, encoding:'utf8', windowsHide:true });
  fs.appendFileSync(path.join(output,'database.log'),result.stdout+result.stderr);
  if (result.status !== 0) throw new Error(result.stderr.slice(-1500));
  return result.stdout;
}
run('createdb',[database]);
const sql = args => run('psql',['-X','-v','ON_ERROR_STOP=1','-d',database,...args]);
sql(['-c','create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;']);
sql(['-f','dist/phase1-tools/baseline-schema.sql']);
// Baseline is a schema-only dump through 0094, not an Auth or Storage server.
for (const file of fs.readdirSync(path.join(root,'supabase/migrations')).filter(file=>/^\d{4}_.*\.sql$/.test(file) && Number(file.slice(0,4))>=95).sort()) {
  sql(['-c','set search_path=public,extensions','-f',path.join(root,'supabase/migrations',file)]);
}
sql(['-c','create extension if not exists pgtap with schema extensions']);
const tests = sql(['-c','set search_path=public,extensions','-f','supabase/tests/resident_front_id_submission.test.sql']);
if (/not ok|Looks like you failed/.test(tests)) throw new Error(tests);
const assertions = (tests.match(/\bok \d+ - /g)||[]).length;
if (assertions!==24) throw new Error('Expected 24 assertions, received '+assertions);
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:true,assertions,database,baseline:'schema-only through 0094',migrations:'0095–0118'},null,2));
console.log('PASS: 24 database assertions, front-only publication, staff approval, service request, legacy compatibility, and OCR limits');
