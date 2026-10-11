// One bounded read-only catalog and one independent CTE. No resources created.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const dir = import.meta.dirname;
const args = ['exec', '-i', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'];
function readSQL(name, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 15000, windowsHide: true });
  fs.writeFileSync(new URL(name + '.log', import.meta.url), (result.stdout ?? '') + (result.stderr ?? ''));
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout.trim());
}
const local = readSQL('local-catalog-approved', fs.readFileSync(new URL('../admin-table-phase0/hosted-schema-query.sql', import.meta.url), 'utf8'));
fs.writeFileSync(new URL('./local-schema.json', import.meta.url), JSON.stringify(local, null, 2) + '\n');
const hosted = JSON.parse(fs.readFileSync(new URL('./hosted-schema.json', import.meta.url), 'utf8'));
const normalize = array => JSON.stringify(array.map(row => JSON.stringify(row)).sort());
const alignment = Object.fromEntries(['columns', 'constraints', 'indexes', 'policies', 'rls', 'collations', 'migrations'].map(key => [key, normalize(local[key]) === normalize(hosted[key])]));
fs.writeFileSync(new URL('./schema-alignment.json', import.meta.url), JSON.stringify({ alignment, localVersion: local.version, hostedCaptureIsHistorical: false, note: 'Fresh catalog comparison is read-only and does not prove authenticated acceptance or full function/trigger equality.' }, null, 2) + '\n');
const evidence = readSQL('sql-comparison', fs.readFileSync(new URL('./comparison-fixture.sql', import.meta.url), 'utf8'));
assert.equal(evidence.case_tie, true); assert.equal(evidence.accents_retained, true);
assert.equal(evidence.timestamp_instants_equal, true); assert.equal(evidence.row_count_identity, true);
assert.equal(evidence.size_combinations, 45);
assert.deepEqual(evidence.name_ascending.slice(-3), [6, 7, 8]); assert.deepEqual(evidence.name_descending.slice(-3), [6, 7, 8]);
assert.deepEqual(evidence.numeric_suffix_values.slice(0, 3).map(row => row.numeric), [2, 10, 2]);
assert.equal(evidence.manila_midnight_date, '2026-10-11');
fs.writeFileSync(new URL('./comparison-fixture-results.json', import.meta.url), JSON.stringify({ assertions: 11, evidence, boundary: 'Independent read-only CTE oracle; not application sorting/pagination.' }, null, 2) + '\n');
console.log(JSON.stringify({ alignment, comparisonAssertions: 11 }));
