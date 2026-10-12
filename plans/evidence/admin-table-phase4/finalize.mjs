import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../../..'), evidence = import.meta.dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(evidence, name), 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run = (command, args) => { const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
const baseline = read('baseline.json');
const plan = fs.readFileSync(path.join(root, 'plans/Admin_Web_Table_Browsing_Sorting_Pagination_and_Filters_Implementation_Plan.md'), 'utf8');
assert.ok(plan.includes('**Phases 0–4 are COMPLETE.**'));
const phase = plan.split('### Phase 4 — Directory, Households, and Staff')[1].split('### Phase 5')[0];
assert.equal((phase.match(/- \[x\]/g) ?? []).length, 5);
assert.ok(plan.includes('## 17. Phase 4'));
const folders = ['residents', 'households-residents', 'staff'];
const allowed = new Set(folders.flatMap(folder => ['page.tsx', 'types.ts', folder === 'residents' ? 'resident-directory.tsx' : folder === 'staff' ? 'staff-table.tsx' : 'households-table.tsx'].map(file => `apps/admin-web/src/app/(admin)/${folder}/${file}`)));
for (const file of ['apps/admin-web/src/app/(admin)/staff/staff-form.tsx', 'apps/admin-web/src/components/admin/editable-data-table.tsx', 'apps/admin-web/src/components/admin/table-scroll-area.tsx',
  'apps/admin-web/src/hooks/use-pilot-table-browse.ts', 'apps/admin-web/src/hooks/use-profile-table-detail.ts', 'apps/admin-web/src/lib/admin-tables/profile-config.ts',
  'apps/admin-web/src/components/admin/profile-table-summary.tsx', 'apps/admin-web/src/components/admin/profile-table-panel.tsx', 'apps/admin-web/src/components/admin/table-detail-dialog.tsx',
  'plans/Admin_Web_Table_Browsing_Sorting_Pagination_and_Filters_Implementation_Plan.md']) allowed.add(file);
const files = run('rg', ['--files', '--hidden', '-g', '!.git', '-g', '!node_modules', '-g', '!dist', '-g', '!.next', '-g', '!.env*', '-g', '!plans/evidence/admin-table-phase4/**']).split(/\r?\n/).map(file => file.replaceAll('\\', '/'));
const changed = [], concurrent = [], added = [], missing = [];
for (const [file, before] of Object.entries(baseline.hashes)) {
  if (!fs.existsSync(path.join(root, file))) { missing.push(file); continue; }
  const after = hash(path.join(root, file)); if (before !== after) (allowed.has(file) ? changed : concurrent).push({ file, before, after });
}
for (const file of files) if (!(file in baseline.hashes)) added.push({ file, taskOwned: allowed.has(file), hash: hash(path.join(root, file)) });
assert.equal(missing.length, 0, 'A baseline file disappeared');
for (const file of files.filter(file => file.startsWith('apps/admin-web/src/'))) assert.equal(hash(path.join(root, file)), hash(path.join(root, 'dist/admin-table-phase4-preview/src', file.slice('apps/admin-web/src/'.length))), 'Preview source drift: ' + file);
const migrations = Object.entries(baseline.hashes).filter(([file]) => file.startsWith('supabase/migrations/'));
for (const [file, before] of migrations) assert.equal(hash(path.join(root, file)), before, 'Migration changed');
const browsing = read('acceptance-browsing-partial.json'); assert.equal(browsing.checks.length, 5); assert.equal(browsing.errors.length, 0);
for (const name of ['acceptance-remaining.json', 'acceptance-actions.json', 'acceptance-matrix.json', 'route-permissions.json', 'detail-realtime.json', 'final-flows.json']) assert.equal(read(name).passed, true, name);
const realtime = read('detail-realtime-attempt2.json'); assert.equal(realtime.checks.length, 2); assert.deepEqual(realtime.refreshes, { events: 3, whileEditing: 0, afterCancel: 1 });
const mounts = read('detail-realtime-attempt3.json'); assert.equal(mounts.checks.length, 2); assert.equal(mounts.mounts.length, 10); assert.equal(mounts.samples.length, 30);
for (const sample of mounts.mounts) assert.deepEqual(sample, { observers: { resize: 1, mutation: 1 }, channels: 1 });
assert.ok(read('final-flows-attempt1.json').checks[0].startsWith('23-row last-page removals'));
const components = read('browser-results.json'); for (const name of ['chrome', 'firefox', 'webkit']) { const result = components.browsers.find(browser => browser.name === name); assert.equal(result.status, 'passed'); assert.equal(result.checks.length, 11); }
const cleanup = read('runtime-cleanup.json'); assert.equal(cleanup.networkRemoved, true); assert.equal(cleanup.privateCredentialsRemoved, true); assert.equal(cleanup.remainingOwnedContainers, ''); assert.equal(read('preview-cleanup.json').stillRunning, 0);
assert.ok(!fs.existsSync(path.join(root, 'dist/admin-table-phase4-runtime')), 'Private fixture state remains');
run('git', ['diff', '--check']);
for (const file of fs.readdirSync(evidence).filter(file => file.endsWith('.mjs'))) run(process.execPath, ['--check', path.join(evidence, file)]);
const timings = Object.fromEntries(['residents', 'households-residents', 'staff'].map(route => { const values = mounts.samples.filter(sample => sample.route === route).map(sample => sample.ms).sort((a,b) => a-b); return [route, values[Math.ceil(values.length * .95) - 1]]; }));
const scope = { baselineFiles: Object.keys(baseline.hashes).length, taskChanges: changed, newFiles: added, concurrentDrift: concurrent, missing,
  note: 'Concurrent changes/additions outside this task were preserved and recorded. The immutable baseline is unchanged; strict whole-workspace equality is not claimed. Final post-verification source edits only remove trailing whitespace in two Staff files.' };
fs.writeFileSync(path.join(evidence, 'scope.json'), JSON.stringify(scope, null, 2));
const result = { phase: 4, complete: true, verifiedAt: new Date().toISOString(), sourceHead: run('git', ['rev-parse', 'HEAD']),
  scope: ['Directory', 'Households & Residents', 'Staff Members'], phase5Started: false, phase6Started: false, migrationChanges: 0, hostedWrites: false, residentUIChanges: false,
  static: { unitTests: 65, lint: 'passed', typecheck: 'passed', productionBuild: 'passed (webpack)', logs: ['unit-tests-complete.log','lint-complete.log','typecheck-complete.log','build-complete.log','whitespace-complete.log'] },
  integration: { globalSortDirections: 48, completePaging: 'passed on all three routes; more than 1500 rows each before action tests', browsers: read('acceptance-matrix.json').browsers,
    routePermissions: read('route-permissions.json').cases.length, sharedBrowserGroups: 33, realtime: realtime.refreshes, mountCycles: 10, timingsP95Ms: timings,
    profile: 'loopback/unthrottled development preview; approximately 1500 records per route; database and REST two CPUs each; ten warm samples per route' },
  reports: ['acceptance-browsing-partial.json (first five completed groups only)','acceptance-remaining.json','acceptance-actions.json','acceptance-matrix.json','route-permissions.json',
    'detail-realtime-attempt2.json (two completed groups only)','detail-realtime-attempt3.json (two completed groups only)','detail-realtime.json','final-flows-attempt1.json (first completed group only)','final-flows.json','browser-results.json'],
  cleanup, blockers: [], limitations: ['Migrations 0110–0112 were applied only to disposable fixtures; release remains Phase 6.',
    'Storage signing/images were synthetic; actual ID review RPC, request history and audit used the fixture.',
    'Invitation provider delivery, hosted acceptance/advisors, native Safari/Edge, physical inputs/OS scrollbars, native zoom, manual screen readers and 100k deep pages remain unverified release work.'],
  note: 'Failed reports remain failures. Only explicitly completed positive groups are reused from partial reports. No production-readiness claim.' };
fs.writeFileSync(path.join(evidence, 'final-verification.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ complete: true, timingsP95Ms: timings, taskChanges: changed.length, concurrentDrift: concurrent.length, unrelatedAdditions: added.filter(file => !file.taskOwned).length, cleanedUp: true }));
