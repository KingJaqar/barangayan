// Finite checks using installed tooling. Logs stay here; no production entry points.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir = import.meta.dirname;
const root = path.resolve(dir, '../../..');
const results = [];
function run(name, executable, args, cwd = root, timeout = 30000, input) {
  const start = Date.now();
  const result = spawnSync(executable, args, { cwd, timeout, input, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(dir, name + '.log'), (result.stdout ?? '') + (result.stderr ?? ''));
  const record = { name, status: result.status, error: result.error?.code ?? null, elapsedMs: Date.now() - start, timeoutMs: timeout };
  results.push(record); console.log(JSON.stringify(record));
  return result;
}
for (const name of fs.readdirSync(dir).filter(name => name.endsWith('.mjs'))) run('syntax-' + name, process.execPath, ['--check', path.join(dir, name)], root, 10000);
run('fixtures', process.execPath, ['--test', '--test-timeout=30000', path.join(dir, 'verify.mjs')]);
run('admin-typecheck', process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--incremental', 'false'], path.join(root, 'apps/admin-web'), 60000);
run('admin-lint', process.execPath, [path.join(root, 'node_modules/eslint/bin/eslint.js'), '.'], path.join(root, 'apps/admin-web'), 60000);
// Read the existing local catalog once. Do not start, reset, migrate, seed or stop it.
const catalogSQL = fs.readFileSync(path.join(root, 'plans/evidence/admin-table-phase0/hosted-schema-query.sql'), 'utf8');
const args = ['exec', '-i', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'];
const catalog = run('local-catalog', 'docker', args, root, 15000, catalogSQL);
if (catalog.status === 0) {
  const data = JSON.parse(catalog.stdout.trim());
  fs.writeFileSync(path.join(dir, 'local-schema.json'), JSON.stringify(data, null, 2) + '\n');
  const hosted = JSON.parse(fs.readFileSync(path.join(root, 'plans/evidence/admin-table-phase0/hosted-schema.json'), 'utf8'));
  const normalize = array => JSON.stringify(array.map(row => JSON.stringify(row)).sort());
  const alignment = Object.fromEntries(['columns', 'constraints', 'indexes', 'policies', 'rls', 'collations', 'migrations'].map(key => [key, normalize(data[key]) === normalize(hosted[key])]));
  fs.writeFileSync(path.join(dir, 'schema-alignment.json'), JSON.stringify({ alignment, localVersion: data.version, hostedCaptureIsHistorical: true, note: 'Affected catalog equality does not prove every function/trigger or current hosted state. Statistics are estimates.' }, null, 2) + '\n');
  const comparison = run('sql-comparison', 'docker', args, root, 15000, fs.readFileSync(path.join(dir, 'comparison-fixture.sql'), 'utf8'));
  if (comparison.status === 0) {
    const evidence = JSON.parse(comparison.stdout.trim());
    assert.equal(evidence.case_tie, true); assert.equal(evidence.accents_retained, true);
    assert.equal(evidence.timestamp_instants_equal, true); assert.equal(evidence.row_count_identity, true);
    assert.equal(evidence.size_combinations, 45);
    assert.deepEqual(evidence.name_ascending.slice(-3), [6, 7, 8]); assert.deepEqual(evidence.name_descending.slice(-3), [6, 7, 8]);
    assert.deepEqual(evidence.numeric_suffix_values.slice(0, 3).map(row => row.numeric), [2, 10, 2]);
    assert.equal(evidence.manila_midnight_date, '2026-10-11');
    fs.writeFileSync(path.join(dir, 'comparison-fixture-results.json'), JSON.stringify({ assertions: 11, evidence, boundary: 'Independent read-only CTE oracle; not application sorting/pagination.' }, null, 2) + '\n');
  }
}
run('diff-whitespace', 'git', ['diff', '--check'], root, 15000);
fs.writeFileSync(path.join(dir, 'check-results.json'), JSON.stringify(results, null, 2) + '\n');
if (results.some(result => result.status !== 0)) process.exitCode = 1;
