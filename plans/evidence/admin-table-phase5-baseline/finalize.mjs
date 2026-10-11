// Isolated evidence consistency and strict scope gate. No services or app writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const dir = import.meta.dirname;
const root = path.resolve(dir, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const normalize = rows => JSON.stringify(rows.map(row => JSON.stringify(row)).sort());
function node(args, timeout = 15000) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8',
    timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result;
}
const syntax = fs.readdirSync(dir).filter(name => name.endsWith('.mjs')).map(name => {
  node(['--check', path.join(dir, name)], 10000);
  return { file: name, status: 0 };
});
node([path.join(dir, 'field-contracts.mjs')]);
const strictScope = spawnSync(process.execPath, [path.join(dir, 'audit.mjs'), 'verify'], {
  cwd: root, timeout: 30000, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024,
});
fs.writeFileSync(path.join(dir, 'strict-scope.log'), (strictScope.stdout ?? '') + (strictScope.stderr ?? ''));
const scope = read('scope-and-provenance.json');
const reviewed = read('concurrent-change-review.json');
assert.equal(strictScope.status, 1, 'Strict preservation failure must remain explicit for inspected concurrent document drift');
assert.deepEqual(scope.changed.sort(), reviewed.files.map(row => row.file).sort());
assert.deepEqual(scope.missing, []); assert.deepEqual(scope.addedOutsideScope, []);
for (const row of reviewed.files) {
  const actualHash = createHash('sha256').update(fs.readFileSync(path.join(root, row.file))).digest('hex');
  assert.equal(actualHash, row.sha256, `New drift requires investigation: ${row.file}`);
}
const retained = JSON.parse(fs.readFileSync(path.join(root,
  'plans/evidence/admin-table-phase4-baseline/scope-and-provenance.json'), 'utf8'));
assert.deepEqual(scope.provenance.map(item => [item.file, item.sha256]),
  retained.provenance.map(item => [item.file, item.sha256]));
const fixtureLog = fs.readFileSync(path.join(dir, 'fixtures.log'), 'utf8');
assert.match(fixtureLog, /tests 55/); assert.match(fixtureLog, /fail 0/);
const results = ['fixtures', 'typecheck', 'local'].map(name => read(name + '-result.json'));
assert.ok(results.every(result => result.status === 0));
const lint = [0, 1].map(batch => read(`lint-batch${batch}.json`));
assert.ok(lint.every(result => result.status === 0));
const lintFiles = lint.flatMap(result => result.files);
assert.equal(new Set(lintFiles).size, 66); assert.equal(lintFiles.length, 66);
const local = read('local-schema.json'), hosted = read('hosted-schema.json');
const historical = JSON.parse(fs.readFileSync(path.join(root,
  'plans/evidence/admin-table-phase0/hosted-schema.json'), 'utf8'));
const keys = ['columns', 'constraints', 'indexes', 'policies', 'rls', 'collations', 'migrations'];
const localHostedAlignment = Object.fromEntries(keys.map(key =>
  [key, normalize(local[key]) === normalize(hosted[key])]));
const hostedHistoricalAlignment = Object.fromEntries(keys.map(key =>
  [key, normalize(hosted[key]) === normalize(historical[key])]));
assert.ok(Object.values(hostedHistoricalAlignment).every(Boolean));
assert.ok(keys.filter(key => key !== 'policies').every(key => localHostedAlignment[key]));
const reads = catalog => catalog.policies.filter(row => ['SELECT', 'ALL'].includes(row.cmd));
assert.equal(normalize(reads(local)), normalize(reads(hosted)));
const policyDifferences = {
  onlyInHosted: hosted.policies.filter(row => !local.policies.some(other => JSON.stringify(other) === JSON.stringify(row))),
  onlyInLocal: local.policies.filter(row => !hosted.policies.some(other => JSON.stringify(other) === JSON.stringify(row))),
};
assert.equal(policyDifferences.onlyInHosted.length, 1);
assert.equal(policyDifferences.onlyInHosted[0].cmd, 'INSERT');
assert.equal(policyDifferences.onlyInLocal.length, 0);
assert.equal(read('field-contracts.json').verifiedFieldDefinitions, 255);
assert.equal(read('comparison-fixture-results.json').assertions, 11);
const nested = read('nested-catalog.json');
assert.equal(nested.columns.length, 50); assert.equal(nested.functions.length, 11);
const hostedNested = read('hosted-nested-catalog.json');
const nestedKeys = ['columns','constraints','policies','functions','publications'];
const nestedRawAlignment = Object.fromEntries(nestedKeys.map(key =>
  [key, normalize(nested[key]) === normalize(hostedNested[key])]));
const normalizedFunctions = catalog => catalog.functions.map(row => ({
  ...row, definition: row.definition.replaceAll('\r\n', '\n'),
}));
const functionAlignment = nested.functions.map(row => {
  const counterpart = hostedNested.functions.find(other => other.proname === row.proname && other.arguments === row.arguments);
  assert.ok(counterpart);
  return { name: row.proname, arguments: row.arguments,
    rawEqual: JSON.stringify(row) === JSON.stringify(counterpart),
    lineEndingNormalizedEqual: JSON.stringify({ ...row, definition: row.definition.replaceAll('\r\n', '\n') }) ===
      JSON.stringify({ ...counterpart, definition: counterpart.definition.replaceAll('\r\n', '\n') }) };
});
assert.ok(functionAlignment.every(row => row.lineEndingNormalizedEqual));
assert.equal(normalize(normalizedFunctions(nested)), normalize(normalizedFunctions(hostedNested)));
assert.ok(nestedKeys.filter(key => key !== 'functions').every(key => nestedRawAlignment[key]));
fs.writeFileSync(path.join(dir, 'supporting-alignment.json'), JSON.stringify({
  nestedRawAlignment, functionsEqualAfterLineEndingNormalization: true, functionAlignment,
  boundary: 'Only 11 captured helper definitions; not full trigger/function or execution equality.',
}, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'schema-alignment.json'), JSON.stringify({
  localHostedAlignment, hostedHistoricalAlignment, readPoliciesMatch: true, policyDifferences,
  freshHostedCapture: true, boundary: 'Metadata comparison only; no authenticated acceptance.',
}, null, 2) + '\n');
const diff = spawnSync('git', ['diff', '--check'], { cwd: root, encoding: 'utf8',
  timeout: 15000, windowsHide: true });
assert.equal(diff.status, 0, diff.stderr);
fs.writeFileSync(path.join(dir, 'diff-whitespace.log'), (diff.stdout ?? '') + (diff.stderr ?? ''));
const hashes = Object.fromEntries(fs.readdirSync(dir).filter(name => name !== 'final-verification.json')
  .map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex')]));
for (const name of Object.keys(hashes).filter(name => name.endsWith('.json'))) read(name);
const report = { checkedAt: new Date().toISOString(), baselineContractGateComplete: true,
  fixtureTests: 55, fixtureFailures: 0, independentSQLValueChecks: 11, syntax,
  results, lint, combinedLintAttemptThisStage: false, explicitLocalReadRetries: 1,
  localHostedAlignment, hostedHistoricalAlignment, readPoliciesMatch: true, policyDifferences,
  nestedRawAlignment, functionsEqualAfterLineEndingNormalization: true,
  indexedSourceFiles: scope.sourceParity.length,
  activeIndexEntries: read('source-inventory.json').reduce((sum, file) => sum + file.items.length, 0),
  verifiedFieldDefinitions: 255, supplementalColumns: nested.columns.length,
  supplementalFunctions: nested.functions.length,
  scope: { baselineFiles: scope.baselineFiles, changed: scope.changed, missing: scope.missing,
    addedOutsideScope: scope.addedOutsideScope, exactWorkspaceEquality: false,
    strictScopeStatus: strictScope.status, reviewedConcurrentChanges: reviewed.files,
    unchangedFiles: scope.baselineFiles - scope.changed.length },
  highestRepositoryMigration: read('baseline.json').highestMigration,
  historicalRuntimeCounts: scope.historicalCounts, retainedRuntimeReportHashesMatch: true,
  freshHostedCatalogAndScaleRead: true, freshAuthenticatedBrowserRealtimeRun: false,
  resourcesCreated: [], temporaryObjectsCreated: [], applicationChangesByThisTask: [],
  trackedWhitespaceStatus: diff.status, artifactHashes: hashes,
  limitations: ['AST/VM checks do not execute every mutation, SQL ordering, RLS or Realtime.',
    'Retained isolated authenticated/browser/feed evidence is historical with verified source linkage.',
    'Hosted metadata/scale reads are not authenticated hosted acceptance or performance tests.',
    'Production build, physical input, cross-browser/accessibility and large-data benchmarks were not run.'],
};
fs.writeFileSync(path.join(dir, 'final-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ complete: true, tests: 55, sqlChecks: 11,
  syntaxChecks: syntax.length, preservedFiles: scope.baselineFiles, lintFiles: lintFiles.length }));


