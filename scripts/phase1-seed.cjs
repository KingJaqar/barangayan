/* global __dirname */
// Exercise the normal seed only on the fixed local empty-chain rehearsal.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const run = process.argv[2];
if (!/^[a-z0-9-]+$/.test(run || '')) throw new Error('Specify a fresh evidence directory');
const output = path.join(root, 'plans/evidence/phase1', run);
fs.mkdirSync(output, { recursive: true });
if (fs.existsSync(path.join(output, 'seed-results.json'))) throw new Error('Preserve previous evidence');
const binary = path.join(root, 'dist/phase1-tools/postgres/pgsql/bin/psql.exe');
const args = ['-X','-At','-h','127.0.0.1','-p','55431','-U','postgres','-d','phase1_empty','-v','ON_ERROR_STOP=1'];
function sql(extra) {
  const result = spawnSync(binary, [...args, ...extra], { cwd: root, encoding: 'utf8', timeout: 60000 });
  if (result.error) throw result.error;
  return result;
}
function snapshot() {
  const tables = sql(['-c', "select tablename from pg_tables where schemaname='public' order by tablename"]);
  if (tables.status !== 0) throw new Error(tables.stderr);
  return Object.fromEntries(tables.stdout.trim().split(/\r?\n/).map(table => {
    if (!/^[a-z_]+$/.test(table)) throw new Error('Unexpected table name');
    const result = sql(['-c', `select count(*) from public.${table}`]);
    if (result.status !== 0) throw new Error(result.stderr);
    return [table, Number(result.stdout.trim())];
  }));
}
const results = [];
const before = snapshot();
for (let attempt = 1; attempt <= 2; attempt++) {
  const result = sql(['--single-transaction','-f',path.join(root,'supabase/seed.sql')]);
  fs.writeFileSync(path.join(output, `seed-${attempt}.log`), result.stdout + result.stderr);
  results.push({attempt, exitCode:result.status, counts:result.status === 0 ? snapshot() : null});
  fs.writeFileSync(path.join(output,'seed-results.json'), JSON.stringify({before,results},null,2));
  if (result.status !== 0) throw new Error(`Seed ${attempt} failed: ${result.stderr.slice(-1000)}`);
}
const idempotent = JSON.stringify(results[0].counts) === JSON.stringify(results[1].counts);
const check = sql(['-f',path.join(root,'scripts/fixtures/phase1-seed-reads.sql')]);
fs.writeFileSync(path.join(output,'seed-reads.log'),check.stdout + check.stderr);
const assertions = (check.stdout.match(/\bok \d+ - /g) || []).length;
const passed = check.status === 0 && assertions === 12 && !/not ok|Looks like you failed|planned \d+ tests but ran/.test(check.stdout);
fs.writeFileSync(path.join(output,'seed-results.json'),JSON.stringify({before,results,idempotent,assertions,passed},null,2));
console.log(`Development seed twice: ${idempotent && passed ? 'PASS' : 'FAIL'} (${assertions} assertions)`);
if (!idempotent || !passed) process.exitCode = 1;
