// Baseline consistency gate. Reads sources/catalogs; writes only owned evidence.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const dir = import.meta.dirname;
const root = path.resolve(dir, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const normalize = rows => JSON.stringify(rows.map(row => JSON.stringify(row)).sort());
function run(executable, args, timeout = 15000) {
  const result = spawnSync(executable, args, { cwd: root, timeout, windowsHide: true,
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  return result.stdout;
}
const report = { checkedAt: new Date().toISOString(), stage: 'Requested Phase 6 baseline only',
  passed: false, noApplicationWrites: true, resourcesCreated: false };
try {
  report.syntax = fs.readdirSync(dir).filter(name => name.endsWith('.mjs')).map(name => {
    run(process.execPath, ['--check', path.join(dir, name)], 10000);
    return { file: name, status: 0 };
  });
  run(process.execPath, [path.join(dir, 'field-contracts.mjs')]);
  const strict = spawnSync(process.execPath, [path.join(dir, 'audit.mjs'), 'verify'], {
    cwd: root, timeout: 30000, windowsHide: true, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  fs.writeFileSync(path.join(dir, 'strict-scope.log'), (strict.stdout ?? '') + (strict.stderr ?? ''));
  const scope = read('scope-and-provenance.json');
  const reviewed = read('concurrent-change-review.json');
  assert.equal(strict.status, 1, 'Retain strict scope failure for reviewed concurrent changes');
  assert.deepEqual(scope.changed.sort(), reviewed.files.map(row => row.file).sort());
  assert.deepEqual(scope.missing, []); assert.deepEqual(scope.addedOutsideScope, []);
  for (const row of reviewed.files) assert.equal(hash(path.join(root, row.file)), row.sha256,
    `New drift requires investigation: ${row.file}`);
  assert.ok(scope.sourceParity.every(row => row.sameAsHistoricalRuntime));
  assert.ok(scope.adminSharedParity.every(row => row.unchanged));
  assert.ok(scope.migrationParity.every(row => row.unchanged));
  report.strictScopeStatus = strict.status;
  report.strictWorkspaceEquality = false;
  report.reviewedConcurrentChanges = reviewed;
  report.scope = { files: scope.baselineFiles, changed: scope.changed,
    missing: scope.missing, addedOutsideScope: scope.addedOutsideScope };
  const retained = JSON.parse(fs.readFileSync(path.join(root,
    'plans/evidence/admin-table-phase5-baseline/scope-and-provenance.json'), 'utf8'));
  assert.deepEqual(scope.provenance.map(row => [row.file, row.sha256]),
    retained.provenance.map(row => [row.file, row.sha256]));
  report.historicalObservations = { counts: scope.historicalCounts,
    boundary: scope.historicalEvidenceBoundary, reports: scope.provenance };
  const log = fs.readFileSync(path.join(dir, 'fixtures.log'), 'utf8');
  assert.match(log, /tests 55/); assert.match(log, /fail 0/);
  report.checks = ['fixtures', 'typecheck', 'local'].map(name => read(name + '-result.json'));
  assert.ok(report.checks.every(row => row.status === 0));
  report.initialLint = [0, 1].map(n => read(`lint-batch${n}.json`));
  assert.ok(report.initialLint.every(row => row.error === 'ETIMEDOUT'));
  report.smallLintFollowUp = [0, 1].map(n => read(`lint-small${n}.json`));
  assert.equal(report.smallLintFollowUp[0].error, 'ETIMEDOUT');
  assert.equal(report.smallLintFollowUp[1].status, 0);
  report.lintHost = read('lint-host.json');
  assert.equal(report.lintHost.status, 0);
  const lintFiles = report.lintHost.files;
  assert.equal(lintFiles.length, 66); assert.equal(new Set(lintFiles).size, 66);
  const local = read('local-schema.json'), hosted = read('hosted-schema.json');
  const historical = JSON.parse(fs.readFileSync(path.join(root,
    'plans/evidence/admin-table-phase0/hosted-schema.json'), 'utf8'));
  const keys = ['columns', 'constraints', 'indexes', 'policies', 'rls', 'collations', 'migrations'];
  report.catalogAlignment = Object.fromEntries(keys.map(key => [key,
    normalize(local[key]) === normalize(hosted[key])]));
  report.hostedHistoricalAlignment = Object.fromEntries(keys.map(key => [key,
    normalize(hosted[key]) === normalize(historical[key])]));
  assert.ok(Object.values(report.hostedHistoricalAlignment).every(Boolean));
  assert.ok(keys.filter(key => key !== 'policies').every(key => report.catalogAlignment[key]));
  const reads = catalog => catalog.policies.filter(row => ['SELECT', 'ALL'].includes(row.cmd));
  assert.equal(normalize(reads(local)), normalize(reads(hosted)));
  report.policyDifference = {
    onlyHosted: hosted.policies.filter(row => !local.policies.some(other => JSON.stringify(row) === JSON.stringify(other))),
    onlyLocal: local.policies.filter(row => !hosted.policies.some(other => JSON.stringify(row) === JSON.stringify(other))),
  };
  assert.equal(report.policyDifference.onlyHosted.length, 1);
  assert.equal(report.policyDifference.onlyHosted[0].cmd, 'INSERT');
  assert.equal(report.policyDifference.onlyLocal.length, 0);
  const nested = read('nested-catalog.json'), hostedNested = read('hosted-nested-catalog.json');
  const nestedKeys = ['columns', 'constraints', 'policies', 'functions', 'publications'];
  report.supportingRawAlignment = Object.fromEntries(nestedKeys.map(key => [key,
    normalize(nested[key]) === normalize(hostedNested[key])]));
  const functions = catalog => catalog.functions.map(row => ({ ...row,
    definition: row.definition.replaceAll('\r\n', '\n') }));
  report.supportingNormalizedFunctionsEqual = normalize(functions(nested)) === normalize(functions(hostedNested));
  assert.ok(nestedKeys.filter(key => key !== 'functions').every(key => report.supportingRawAlignment[key]));
  assert.equal(report.supportingNormalizedFunctionsEqual, true);
  report.rawFunctionDifferences = nested.functions.filter(row =>
    !hostedNested.functions.some(other => JSON.stringify(row) === JSON.stringify(other)));
  assert.equal(report.rawFunctionDifferences.length, 3);
  assert.equal(nested.columns.length, 50); assert.equal(nested.functions.length, 11);
  report.fieldDefinitions = read('field-contracts.json').verifiedFieldDefinitions;
  assert.equal(report.fieldDefinitions, 255);
  report.sqlAssertions = read('comparison-fixture-results.json').assertions;
  assert.equal(report.sqlAssertions, 11);
  assert.deepEqual(read('process-cleanup.json').matchingNodeProcesses, []);
  const baseline = read('baseline.json');
  assert.equal(baseline.highestMigration, '0109_invalidate_changed_profile_email_verification.sql');
  assert.equal(baseline.nextPrefix, '0110');
  report.hostedScale = read('hosted-scale.json');
  report.whitespace = run('git', ['diff', '--check']);
  report.jsonFiles = fs.readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'final-verification.json');
  report.jsonFiles.forEach(read);
  report.evidenceHashes = Object.fromEntries(fs.readdirSync(dir).filter(name => name !== 'final-verification.json')
    .map(name => [name, hash(path.join(dir, name))]));
  report.limits = ['No fresh authenticated/browser/Realtime replay', 'Hosted transport cap unavailable',
    'No complete trigger/function or mutation execution equality', 'No implemented global browse contract',
    'No whole-package lint/build/release, physical input, broad accessibility or 10k/100k performance'];
  report.planSha256 = hash(path.join(root, 'plans/Admin_Web_Table_Browsing_Sorting_Pagination_and_Filters_Implementation_Plan.md'));
  report.passed = true;
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1;
}
fs.writeFileSync(path.join(dir, 'final-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, failure: report.failure, scope: report.scope }));
