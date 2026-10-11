// Check evidence consistency without concealing concurrent workspace changes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const dir = import.meta.dirname;
const root = path.resolve(dir, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
function node(args, timeout = 15000) {
  return spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout,
    windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
}
const syntax = fs.readdirSync(dir).filter(name => name.endsWith('.mjs')).map(name => {
  const result = node(['--check', path.join(dir, name)], 10000);
  assert.equal(result.status, 0, result.stderr);
  return { file: name, status: result.status };
});
const fields = node([path.join(dir, 'field-contracts.mjs')]);
assert.equal(fields.status, 0, fields.stderr);
const scopeRun = node([path.join(dir, 'audit.mjs'), 'verify'], 30000);
fs.writeFileSync(path.join(dir, 'scope-final.log'), (scopeRun.stdout ?? '') + (scopeRun.stderr ?? ''));
const scope = read('scope-and-provenance.json');
assert.ok(scope.sourceParity.every(item => item.sameAsHistoricalRuntime));
assert.ok(scope.migrationParity.every(item => item.unchanged));
assert.ok(scope.adminSharedParity.every(item => item.unchanged));
assert.deepEqual(scope.missing, []);
const inspectedConcurrentFiles = new Set([
  'apps/resident-android-mobile/app.json',
  'apps/resident-android-mobile/scripts/prepare-release-native.mjs',
  'plans/Resident_Registration_Brevo_Supabase_OTP_Execution_Plan.md',
  'plans/evidence/resident-registration-otp/delivery-results.md',
  'plans/evidence/resident-registration-otp/live-acceptance.md',
]);
assert.ok([...scope.changed, ...scope.addedOutsideScope].every(file => inspectedConcurrentFiles.has(file)),
  'Investigate any new unexpected drift instead of automatically accepting it');
assert.equal(scopeRun.status, scope.changed.length || scope.addedOutsideScope.length ? 1 : 0);
const results = ['fixtures', 'typecheck', 'lint', 'local'].map(name => read(name + '-result.json'));
assert.ok(results.every(result => result.status === 0));
assert.match(fs.readFileSync(path.join(dir, 'fixtures.log'), 'utf8'), /tests 44/);
assert.match(fs.readFileSync(path.join(dir, 'fixtures.log'), 'utf8'), /fail 0/);
assert.equal(read('comparison-fixture-results.json').assertions, 11);
const local = read('local-schema.json');
const hosted = JSON.parse(fs.readFileSync(path.join(root, 'plans/evidence/admin-table-phase0/hosted-schema.json'), 'utf8'));
const normalize = rows => JSON.stringify(rows.map(row => JSON.stringify(row)).sort());
const readPolicies = schema => schema.policies.filter(row => ['SELECT', 'ALL'].includes(row.cmd));
assert.equal(normalize(readPolicies(local)), normalize(readPolicies(hosted)));
const policyDifferences = {
  onlyInRetainedHosted: hosted.policies.filter(row => !local.policies.some(other => JSON.stringify(other) === JSON.stringify(row))),
  onlyInFreshLocal: local.policies.filter(row => !hosted.policies.some(other => JSON.stringify(other) === JSON.stringify(row))),
};
const nested = read('nested-catalog.json');
assert.equal(nested.columns.length, 50);
assert.equal(nested.functions.length, 11);
const diff = spawnSync('git', ['diff', '--check'], { cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true });
fs.writeFileSync(path.join(dir, 'diff-whitespace.log'), (diff.stdout ?? '') + (diff.stderr ?? ''));
assert.equal(diff.status, 0, diff.stderr);
const artifactHashes = Object.fromEntries(fs.readdirSync(dir).filter(name => name !== 'final-verification.json')
  .map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex')]));
for (const name of Object.keys(artifactHashes).filter(name => name.endsWith('.json'))) read(name);
const report = { checkedAt: new Date().toISOString(), baselineContractGateComplete: true,
  fixtureTests: 44, fixtureFailures: 0, independentSQLValueChecks: 11,
  indexedSourceFiles: scope.sourceParity.length, activeIndexEntries: read('source-inventory.json').reduce((sum, file) => sum + file.items.length, 0),
  unchangedAdminSharedFiles: scope.adminSharedParity.length, unchangedHistoricalMigrations: scope.migrationParity.length,
  fieldDefinitions: read('field-contracts.json').verifiedFieldDefinitions,
  supplementalColumns: nested.columns.length, supplementalFunctions: nested.functions.length,
  syntax, results, focusedLint: read('focused-lint.json'),
  schemaAlignment: read('schema-alignment.json').alignment, readPoliciesMatchRetainedHosted: true, policyDifferences,
  scope: { baselineFiles: scope.baselineFiles, exactWorkspaceEquality: scopeRun.status === 0,
    status: scopeRun.status, changed: scope.changed, addedOutsideScope: scope.addedOutsideScope,
    missing: scope.missing, interpretation: 'Concurrent resident Android/registration OTP work observed, inspected and preserved; this task only wrote the plan and this evidence directory. No claim of full workspace equality.' },
  trackedWhitespaceStatus: diff.status, artifactHashes,
  resourcesCreated: [], temporaryObjectsCreated: [], applicationChangesByThisTask: [],
  freshHostedAuthenticatedBrowserRealtimeChecks: false,
  limitations: ['Retained hosted catalog/runtime observations are historical.',
    'No fresh authenticated browser/Realtime check; current hosted state is unknown.',
    'Whole-package lint/build, physical input, cross-browser/accessibility and large-data benchmarks were not run.',
    'Fixtures simulate API predicates/cap; they do not execute RLS, SQL joins or application pagination.'],
};
fs.writeFileSync(path.join(dir, 'final-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ baselineContractGateComplete: true, fixtureTests: report.fixtureTests,
  syntaxChecks: syntax.length, scopeStatus: scopeRun.status, scopeChanges: report.scope.changed,
  scopeAdditions: report.scope.addedOutsideScope, results }, null, 2));
