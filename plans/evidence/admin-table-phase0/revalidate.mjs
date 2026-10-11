// Phase 0 evidence only. Preserves historical reports and application files.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../../..');
const out = path.join(import.meta.dirname, 'revalidation');
fs.mkdirSync(out, { recursive: true });
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const write = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + '\n');
const owned = file => file === 'plans/Admin_Web_Table_Browsing_Sorting_Pagination_and_Filters_Implementation_Plan.md'
  || file === 'plans/evidence/admin-table-phase0/revalidate.mjs'
  || file.startsWith('plans/evidence/admin-table-phase0/revalidation/');
function run(executable, args, options = {}) {
  return spawnSync(executable, args, { cwd: root, encoding: 'utf8', windowsHide: true,
    timeout: 15000, maxBuffer: 16 * 1024 * 1024, ...options });
}
function files() {
  const result = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  assert.equal(result.status, 0, result.stderr);
  return [...new Set(result.stdout.split('\0').filter(file => file && !owned(file)))].sort();
}
function check(name, executable, args, options = {}) {
  const start = Date.now();
  const result = run(executable, args, options);
  fs.writeFileSync(path.join(out, name + '.log'), (result.stdout ?? '') + (result.stderr ?? ''));
  const report = { name, status: result.status, error: result.error?.code ?? null,
    elapsedMs: Date.now() - start, timeoutMs: options.timeout ?? 15000 };
  write(name + '.json', report);
  assert.equal(result.status, 0, `${name}: ${result.stderr || result.error?.message}`);
  return result.stdout;
}
const prior = 'plans/evidence/admin-table-phase6-baseline/';
const mode = process.argv[2];
if (mode === 'baseline') {
  assert.ok(!fs.existsSync(path.join(out, 'baseline.json')), 'Keep the immutable baseline');
  const status = run('git', ['status', '--short']);
  assert.equal(status.status, 0);
  fs.writeFileSync(path.join(out, 'baseline-status.txt'), status.stdout);
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
  write('baseline.json', { capturedAt: new Date().toISOString(), head: run('git', ['rev-parse', 'HEAD']).stdout.trim(),
    highestMigration: migrations.at(-1), nextPrefix: String(Number(migrations.at(-1).slice(0, 4)) + 1).padStart(4, '0'),
    hashes: Object.fromEntries(files().map(file => [file, hash(file)])) });
} else if (mode === 'checks') {
  check('fixtures', process.execPath, ['--test', '--test-timeout=30000', path.join(root, prior, 'verify.mjs')], { timeout: 35000 });
  check('typecheck', process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--incremental', 'false'],
    { cwd: path.join(root, 'apps/admin-web'), timeout: 60000 });
  const lint = read(prior + 'lint-host.json').files.map(file => path.join(root, file));
  check('lint', process.execPath, [path.join(root, 'node_modules/eslint/bin/eslint.js'), ...lint],
    { cwd: path.join(root, 'apps/admin-web'), timeout: 60000 });
} else if (mode === 'local') {
  for (const [name, sql] of [['local-schema', 'hosted-schema-query.sql'], ['comparison', 'comparison-fixture.sql']]) {
    const result = check(name, 'docker', ['exec', '-i', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'],
      { input: fs.readFileSync(path.join(root, prior, sql), 'utf8') });
    write(name + '-data.json', JSON.parse(result.trim()));
  }
} else if (mode === 'final') {
  const baseline = JSON.parse(fs.readFileSync(path.join(out, 'baseline.json'), 'utf8'));
  const changed = Object.entries(baseline.hashes).filter(([file, value]) => !fs.existsSync(path.join(root, file)) || hash(file) !== value).map(([file]) => file);
  const added = files().filter(file => !(file in baseline.hashes));
  const historical = read('plans/evidence/admin-table-phase0/runtime-baseline-hashes.json');
  const source = read(prior + 'source-inventory.json').map(({ file }) => ({ file, unchanged: hash(file) === historical[file] }));
  const migrations = Object.entries(historical).filter(([file]) => file.startsWith('supabase/migrations/')).map(([file, value]) => ({ file, unchanged: hash(file) === value }));
  const retained = read(prior + 'final-verification.json').historicalObservations;
  const reports = retained.reports.map(row => ({ file: row.file, unchanged: hash(row.file) === row.sha256 }));
  const checks = ['fixtures', 'typecheck', 'lint'].map(name => JSON.parse(fs.readFileSync(path.join(out, name + '.json'), 'utf8')));
  const canonical = value => JSON.stringify(Array.isArray(value) ? value.map(v => JSON.parse(canonical(v))).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value);
  const hosted = JSON.parse(fs.readFileSync(path.join(out, 'hosted-schema.json'), 'utf8'));
  const local = JSON.parse(fs.readFileSync(path.join(out, 'local-schema-data.json'), 'utf8'));
  const keys = ['columns', 'constraints', 'indexes', 'policies', 'rls', 'collations', 'migrations'];
  const hostedParity = Object.fromEntries(keys.map(key => [key, canonical(hosted[key]) === canonical(read(prior + 'hosted-schema.json')[key])]));
  const localAlignment = Object.fromEntries(keys.map(key => [key, canonical(hosted[key]) === canonical(local[key])]));
  const readPolicies = catalog => catalog.policies.filter(row => ['SELECT', 'ALL'].includes(row.cmd));
  assert.equal(canonical(readPolicies(hosted)), canonical(readPolicies(local)));
  assert.ok(Object.values(hostedParity).every(Boolean));
  assert.ok(keys.filter(key => key !== 'policies').every(key => localAlignment[key]));
  const comparison = JSON.parse(fs.readFileSync(path.join(out, 'comparison-data.json'), 'utf8'));
  assert.deepEqual(comparison, read(prior + 'comparison-fixture-results.json').evidence);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'hosted-scale.json'), 'utf8')), read(prior + 'hosted-scale.json'));
  const report = { checkedAt: new Date().toISOString(), baselineFiles: Object.keys(baseline.hashes).length,
    changed, added, source, migrations, historicalReports: reports, retainedRuntimeCounts: retained.counts, checks,
    hostedParity, localAlignment, readPoliciesMatch: true, comparisonAssertions: 11,
    knownDifference: 'Hosted-only payment INSERT policy; no affected read-policy difference',
    boundary: 'Fresh source tests/typecheck/lint and hash linkage; retained isolated Auth/browser/Realtime evidence. No new live user-flow run or production-readiness claim.',
    passed: changed.length === 0 && added.length === 0 && [...source, ...migrations, ...reports].every(row => row.unchanged) && checks.every(row => row.status === 0) };
  write('result.json', report);
  assert.equal(report.passed, true, 'Inspect result.json; do not relabel source drift or failures');
  console.log(JSON.stringify({ passed: true, baselineFiles: report.baselineFiles, sourceFiles: source.length, migrations: migrations.length, checks }));
} else {
  throw new Error('Use baseline, checks, local or final');
}
