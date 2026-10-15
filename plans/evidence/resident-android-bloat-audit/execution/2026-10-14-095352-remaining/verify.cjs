const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const qualification = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-01/qualification.json'), 'utf8'));
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-00/structure.json'), 'utf8'));
const final = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-05/structure.json'), 'utf8'));
const edited = new Set(qualification.edits.map(item => item.file));
const absent = new Set(qualification.orphanFiles.map(item => item.file));
const boundaryRemoved = !fs.existsSync(path.join(root, qualification.boundary.file));
if (boundaryRemoved) absent.add(qualification.boundary.file);
const checks = [];
const check = (name, passed, detail) => checks.push({ name, passed, detail });
for (const platform of ['android', 'web']) {
  for (const member of ['roots', 'reachable', 'externals', 'dynamic']) check(platform + ' exact ' + member, JSON.stringify(baseline.graphs[platform][member]) === JSON.stringify(final.graphs[platform][member]));
  const key = edge => JSON.stringify(edge);
  const beforeEdges = new Set(baseline.graphs[platform].edges.map(key));
  const afterEdges = new Set(final.graphs[platform].edges.map(key));
  const removed = [...beforeEdges].filter(edge => !afterEdges.has(edge)).map(edge => JSON.parse(edge));
  const added = [...afterEdges].filter(edge => !beforeEdges.has(edge));
  check(platform + ' dependency edges', added.length === 0 && removed.every(edge => edge.from === 'apps/resident-android-mobile/src/components/services/skeleton.tsx' && edge.specifier === 'react-native'), { removed, added });
}
check('Active assets preserved', JSON.stringify(baseline.assets) === JSON.stringify(final.assets));
for (const item of qualification.edits) {
  check('Exact deletion-only prepared content: ' + item.file, sha(fs.readFileSync(path.join(root, item.file))) === item.afterSha256);
  const before = baseline.structure[item.file], after = final.structure[item.file];
  const removed = item.selected.filter(entry => entry.kind === 'style property').map(entry => entry.name);
  check('Remaining style text: ' + item.file, Object.keys(after.styleKeys).every(name => after.styleKeys[name] === before.styleKeys[name]) && Object.keys(before.styleKeys).filter(name => !Object.hasOwn(after.styleKeys, name)).every(name => removed.includes(name)));
}
for (const item of qualification.orphanFiles) check('Qualified file absent: ' + item.file, !fs.existsSync(path.join(root, item.file)));
const originalHashes = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-00/hashes.json'), 'utf8'));
const changed = [];
for (const [file, expected] of Object.entries(originalHashes)) {
  const target = path.join(root, file);
  if (!fs.existsSync(target) || sha(fs.readFileSync(target)) !== expected) changed.push(file);
}
const unexpected = changed.filter(file => !edited.has(file) && !absent.has(file));
const concurrentDocumentation = unexpected.filter(file => file.startsWith('plans/'));
const unexpectedActiveInputs = unexpected.filter(file => !file.startsWith('plans/'));
check('Protected active source/config/backend', unexpectedActiveInputs.length === 0, { changed, unexpectedActiveInputs });
check('Historical verifier and original index preserved', ['scripts/phase0-verify.cjs', 'scripts/phase0-inventory.cjs', 'plans/evidence/phase0/source-index.json'].every(file => sha(fs.readFileSync(path.join(root, file))) === originalHashes[file]));
const lint = stage => JSON.parse(fs.readFileSync(path.join(__dirname, stage, 'lint.json'), 'utf8')).flatMap(file => file.messages.map(message => ({ file: file.filePath, rule: message.ruleId, severity: message.severity, message: message.message })));
check('Exact lint diagnostics', JSON.stringify(lint('dc-00')) === JSON.stringify(lint('dc-05')));
const beforeTests = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-00/tests.json'), 'utf8'));
const afterTests = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-05/tests.json'), 'utf8'));
const testRun = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-05/tests-result.json'), 'utf8'));
check('Existing mobile suite', beforeTests.numTotalTests === afterTests.numTotalTests && afterTests.numPassedTests === beforeTests.numPassedTests && afterTests.numFailedTests === 0 && afterTests.success === true && testRun.exitCode === 0, { baseline: beforeTests.numPassedTests, final: afterTests.numPassedTests, suites: afterTests.testResults.length, success: afterTests.success, exitCode: testRun.exitCode });
const result = { checkedAt: new Date().toISOString(), passed: checks.every(item => item.passed), boundaryRemoved, protectedFiles: Object.keys(originalHashes).length, concurrentDocumentation, checks };
fs.mkdirSync(path.join(__dirname, 'dc-06'), { recursive: true });
const resultPath = path.join(__dirname, 'dc-06/comparison.json');
const initialPath = path.join(__dirname, 'dc-06/comparison-initial.json');
if (fs.existsSync(resultPath) && !fs.existsSync(initialPath)) fs.copyFileSync(resultPath, initialPath);
fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, checks: checks.length, failures: checks.filter(item => !item.passed), concurrentDocumentation, boundaryRemoved, protectedFiles: result.protectedFiles }, null, 2));
process.exitCode = result.passed ? 0 : 1;
