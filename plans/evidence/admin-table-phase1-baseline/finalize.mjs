// Final evidence consistency and preservation check; finite, no application writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const dir = import.meta.dirname;
const root = path.resolve(dir, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
function node(args, timeout = 15000) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout, windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
}
const syntax = fs.readdirSync(dir).filter(name => name.endsWith('.mjs')).map(name => {
  node(['--check', path.join(dir, name)], 10000); return { file: name, status: 0 };
});
const fields = node([path.join(dir, 'field-contracts.mjs')]);
const scope = node([path.join(dir, 'audit.mjs'), 'verify']);
const local = read('local-schema.json');
const prior = JSON.parse(fs.readFileSync(path.join(root, 'plans/evidence/admin-table-phase0/hosted-schema.json'), 'utf8'));
const normalize = array => JSON.stringify(array.map(row => JSON.stringify(row)).sort());
const selectPolicies = data => data.policies.filter(row => ['SELECT', 'ALL'].includes(row.cmd));
assert.equal(normalize(selectPolicies(local)), normalize(selectPolicies(prior)));
assert.equal(read('comparison-fixture-results.json').assertions, 11);
assert.match(fs.readFileSync(path.join(dir, 'fixtures.log'), 'utf8'), /tests 41/);
assert.match(fs.readFileSync(path.join(dir, 'fixtures.log'), 'utf8'), /fail 0/);
assert.equal(read('focused-lint.json').status, 0);
assert.equal(read('check-results.json').find(check => check.name === 'admin-typecheck').status, 0);
const diff = spawnSync('git', ['diff', '--check'], { cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true });
assert.equal(diff.status, 0, diff.stderr);
const jsonReports = fs.readdirSync(dir).filter(name => name.endsWith('.json'));
for (const name of jsonReports) read(name);
const report = { checkedAt: new Date().toISOString(), passed: true, syntax, fields, scope, readPoliciesMatchHistoricalHosted: true, sqlValueChecks: 11, fixtureTests: 41, fixtureFailures: 0, affectedLintFiles: read('focused-lint.json').files, affectedLintStatus: 0, adminTypecheckStatus: 0, wholePackageLint: '60s timeout; not passed', parsedJSONReports: jsonReports.length, diffWhitespaceStatus: diff.status, noTemporaryResourcesCreated: true, historicalEvidenceReused: true, freshAuthenticatedBrowserRealtimeHostedChecks: false };
fs.writeFileSync(path.join(dir, 'final-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
