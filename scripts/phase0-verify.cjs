// Verify Phase 0 evidence integrity; this is not a feature or release test gate.
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const evidence = path.join(root, 'plans/evidence/phase0');
const checks = [];
function assert(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
}
const json = file => JSON.parse(fs.readFileSync(path.join(evidence, file), 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const index = json('source-index.json');
const record = fs.readFileSync(path.join(root, 'plans/Phase_0_Baseline_and_Change_Boundaries.md'), 'utf8');
assert('Source inventory hashes still identify the inspected files', index.files.every(file => hash(file.file) === file.sha256));
assert('Every indexed line reference exists', index.references.every(ref => {
  const lines = fs.readFileSync(path.join(root, ref.file), 'utf8').split(/\r?\n/);
  return ref.line > 0 && ref.line <= lines.length && ref.calls.every(call => lines[ref.line - 1].includes(call.name));
}));
for (const platform of ['resident-web', 'admin-web', 'resident-android-mobile', 'resident-ios-mobile']) {
  assert(`${platform} UI and data consumers indexed`, index.files.some(file => file.file.startsWith(`apps/${platform}/`) && file.route) && index.references.some(ref => ref.file.startsWith(`apps/${platform}/`) && ref.calls.length));
}
for (const area of ['catalog', 'requests', 'identity', 'payments', 'sla', 'locality', 'auth', 'scores', 'realtime', 'exports']) {
  assert(`${area} boundary indexed`, index.files.some(file => file.areas.includes(area)));
}
const critical = [
  'apps/resident-web/src/components/services/document-request-modal/request-form-step.tsx',
  'apps/resident-web/src/app/(resident)/services/requests/new/[documentId]/new-request-form.tsx',
  'apps/admin-web/src/app/resident/requests/new/new-request-form.tsx',
  'apps/resident-android-mobile/src/app/(app)/services/request/[documentId].tsx',
  'apps/resident-ios-mobile/src/data/resident-api.ts',
  'apps/admin-web/src/app/(admin)/requests/requests-table.tsx',
  'apps/admin-web/src/app/(admin)/residents/resident-directory.tsx',
  'apps/resident-android-mobile/src/components/map-view.tsx',
  'packages/shared/src/constants/id-verification.ts',
  'packages/shared/src/lib/format.ts',
  'supabase/functions/create-payment-source/index.ts',
  'supabase/functions/paymongo-webhook/index.ts',
  'supabase/functions/export-my-data/index.ts',
  'supabase/migrations/0093_resident_ios_backend_safety.sql',
  'supabase/migrations/0094_resident_ios_tenant_write_guards.sql',
];
assert('Primary, legacy, iOS, correction, storage, map, financial and export boundaries present', critical.every(file => index.files.some(item => item.file === file)));
const ids = ['A1','A2','B1','B2','B3','B4','C1','C2','C3','C4','D1','D2','D3','D4','E1','E2','E3','E4','F1','F2','F3','G1','G2','G3','H1','H2','I1','I2','R1','R2'];
assert('All requirement checklist IDs have phase and verification mappings', ids.every(id => record.includes(`| ${id} /`)));
const runs = ['initial', 'unrestricted', 'mobile-lint', 'recheck', 'prerequisites', 'failure-repeat', 'root-lint-stream'];
const all = runs.flatMap(run => json(`${run}/results.json`).checks.map(check => ({ ...check, run })));
assert('Every attempted check retains timing, exit and log evidence', all.every(check => check.startedAt && check.finishedAt && fs.existsSync(path.join(evidence, check.run, check.log))));
const required = ['shared-tests','ios-tests','shared-types','resident-web-types','admin-web-types','android-types','ios-types','root-lint','resident-web-lint','admin-web-lint','android-lint','ios-lint','resident-web-build','admin-web-build','android-export','ios-export','ios-release','android-sdk','ios-sdk','database-tests','edge-types','supabase-cli','docker','database-client','android-device','deno'];
assert('All applicable baseline checks recorded, including blocked backend/device probes', required.every(id => all.some(check => check.id === id)));
function log(run, id) {
  const check = all.find(check => check.run === run && check.id === id);
  const bytes = fs.readFileSync(path.join(evidence, run, check.log));
  return check.log.endsWith('.gz') ? zlib.gunzipSync(bytes).toString() : bytes.toString();
}
const repeated = [
  ['ios-types','initial','recheck',/TS2307/, /expo-crypto/, /expo-secure-store/],
  ['ios-export','unrestricted','recheck',/PluginError/, /expo-secure-store/],
  ['ios-release','initial','recheck',/Missing release configuration/, /Release gates remain closed/],
  ['ios-lint','mobile-lint','failure-repeat',/import\/no-unresolved/, /expo-crypto/, /expo-secure-store/],
  ['android-sdk','prerequisites','failure-repeat',/react-native-view-shot@5\.1\.1/, /expected version: 5\.1\.0/],
  ['ios-sdk','prerequisites','failure-repeat',/expo-crypto/, /doesn't seem to be installed/],
  ['database-tests','prerequisites','failure-repeat',/not recognized/],
  ['edge-types','prerequisites','failure-repeat',/not recognized/],
];
for (const [id, first, second, ...patterns] of repeated) {
  assert(`${id} persistent diagnostic reproduced`, [first, second].every(run => patterns.every(pattern => pattern.test(log(run, id)))));
}
assert('Root lint generated-output diagnostic reproduced independently of build race', ['recheck', 'root-lint-stream'].every(run => /\.next/.test(log(run, 'root-lint')) && /no-var/.test(log(run, 'root-lint'))));
assert('Transient resident web route types recover without source changes', all.find(check => check.run === 'initial' && check.id === 'resident-web-types').exitCode !== 0 && all.find(check => check.run === 'recheck' && check.id === 'resident-web-types').exitCode === 0);
assert('Original user files are byte-for-byte preserved', json('initial/preservation.json').every(file => hash(file.file) === file.sha256));
const diff = spawnSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' });
assert('Tracked change boundary retains only the original migration edit', diff.status === 0 && diff.stdout.trim() === 'supabase/migrations/0094_resident_ios_tenant_write_guards.sql');
assert('External and feature checks remain explicitly unverified', record.includes('pending feature acceptance') && record.includes('no executed database proof') && record.includes('not native build qualification'));
const result = {
  verdict: checks.every(check => check.passed) ? 'complete' : 'partially complete',
  scope: 'Phase 0 inventory, baseline reproducibility and change boundaries only',
  head: index.head, checkedAt: new Date().toISOString(),
  inventory: { files: index.files.length, references: index.references.length, sqlDeclarations: index.sqlDefinitions.length },
  baselineAttempts: all.length, checks,
  manualReview: 'Journey/requirement closure and findings recorded in Phase_0_Baseline_and_Change_Boundaries.md; index integrity does not prove runtime semantics.',
  limitations: ['No isolated database/migration/RLS/storage/concurrency execution', 'No connected Android device or signed native build', 'No authenticated E2E/provider financial or Google OAuth execution', 'iOS installation/release gates remain blocked', 'Root lint traverses generated output; its bounded execution is recorded without a passing claim'],
};
fs.writeFileSync(path.join(evidence, 'gate.json'), JSON.stringify(result, null, 2) + '\n');
const report = checks.map(check => `${check.passed ? 'PASS' : 'FAIL'}: ${check.name}`).join('\n') + `\nPhase 0 verdict: ${result.verdict}\n`;
fs.writeFileSync(path.join(evidence, 'verification.log'), report);
console.log(report);
process.exitCode = result.verdict === 'complete' ? 0 : 1;
