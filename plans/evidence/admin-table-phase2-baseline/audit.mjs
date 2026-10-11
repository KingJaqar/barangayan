// Evidence only. Never mutates application files, services, schema or data.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const dir = import.meta.dirname;
const root = path.resolve(dir, '../../..');
const prior = path.join(root, 'plans/evidence/admin-table-phase0');
const plan = 'plans/Admin_Web_Table_Browsing_Sorting_Pagination_and_Filters_Implementation_Plan.md';
const owned = file => file === plan || file.startsWith('plans/evidence/admin-table-phase2-baseline/');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n');
function command(executable, args, cwd = root, timeout = 15000) {
  const result = spawnSync(executable, args, { cwd, timeout, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
}

if (process.argv[2] === 'baseline') {
  assert.ok(!fs.existsSync(path.join(dir, 'baseline.json')), 'Never overwrite the original baseline');
  const files = [...new Set(command('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))];
  const hashes = Object.fromEntries(files.filter(file => !owned(file) && fs.existsSync(path.join(root, file))).sort().map(file => [file, hash(path.join(root, file))]));
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(file => /^\d{4}_.*\.sql$/.test(file)).sort();
  fs.writeFileSync(path.join(dir, 'baseline-status.txt'), command('git', ['status', '--short']));
  write('baseline.json', { capturedAt: new Date().toISOString(), timezone: 'Asia/Manila', head: command('git', ['rev-parse', 'HEAD']).trim(), branch: command('git', ['branch', '--show-current']).trim(), highestMigration: migrations.at(-1), nextPrefix: String(Number(migrations.at(-1).slice(0, 4)) + 1).padStart(4, '0'), hashes });
  console.log(`Baseline recorded: ${Object.keys(hashes).length} files; ${migrations.at(-1)}`);
} else if (process.argv[2] === 'verify') {
  const baseline = read(path.join(dir, 'baseline.json'));
  const changed = [], missing = [];
  for (const [file, expected] of Object.entries(baseline.hashes)) {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) missing.push(file);
    else if (hash(target) !== expected) changed.push(file);
  }
  const currentFiles = command('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean);
  const addedOutsideScope = currentFiles.filter(file => !owned(file) && !(file in baseline.hashes));
  const inventory = read(path.join(dir, 'source-inventory.json'));
  const historicalHashes = read(path.join(prior, 'runtime-baseline-hashes.json'));
  const sourceParity = inventory.map(({ file }) => ({ file, sameAsHistoricalRuntime: hash(path.join(root, file)) === historicalHashes[file] }));
  const migrationParity = Object.entries(historicalHashes).filter(([file]) => file.startsWith('supabase/migrations/')).map(([file, expected]) => ({ file, unchanged: fs.existsSync(path.join(root, file)) && hash(path.join(root, file)) === expected }));
  const adminSharedParity = Object.entries(historicalHashes).filter(([file]) => file.startsWith('apps/admin-web/') || file.startsWith('packages/shared/')).map(([file, expected]) => ({ file, unchanged: fs.existsSync(path.join(root, file)) && hash(path.join(root, file)) === expected }));
  const historicalReports = ['runtime-api-results.json', 'runtime-query-edges.json', 'runtime-browser-results.json', 'runtime-interaction-attempt3.json', 'runtime-interaction-results.json', 'runtime-subscription-results.json', 'runtime-route-permissions.json', 'runtime-completion.json', 'runtime-cleanup.json'];
  const provenance = historicalReports.map(name => {
    const report = read(path.join(prior, name));
    return { file: `plans/evidence/admin-table-phase0/${name}`, sha256: hash(path.join(prior, name)), passed: report.passed ?? null, assertions: report.checks?.length ?? null, timestamp: report.timestamp ?? null };
  });
  const completion = read(path.join(prior, 'runtime-completion.json'));
  const cleanup = read(path.join(prior, 'runtime-cleanup.json'));
  assert.equal(completion.phase0RuntimeEvidenceComplete, true);
  assert.deepEqual(completion.counts, { authenticatedApiAssertions: 42, queryEdgeAssertions: 11, renderedScreens: 8, browserInteractionAssertions: 30, realTableSubscriptionChecks: 5, browserPermissionChecks: 2 });
  assert.equal(cleanup.remainingOwnedPreviewProcesses, 0);
  assert.equal(cleanup.remainingTaskPortListeners, 0);
  assert.equal(cleanup.removed.length, 4);
  const report = { checkedAt: new Date().toISOString(), baselineFiles: Object.keys(baseline.hashes).length, changed, missing, addedOutsideScope, sourceParity, migrationParity, adminSharedParity, provenance, historicalCounts: completion.counts, historicalEvidenceBoundary: 'Prior isolated runtime observations retained with byte-identical indexed source, admin/shared and migration files; no fresh authenticated/browser/Realtime or hosted acceptance run. Hosted catalog captures are historical, not proof of current hosted state.', noResourcesCreated: true };
  write('scope-and-provenance.json', report);
  assert.equal(sourceParity.filter(item => !item.sameAsHistoricalRuntime).length, 0, 'Changed source invalidates historical source linkage');
  assert.equal(migrationParity.filter(item => !item.unchanged).length, 0, 'Migration source changed');
  assert.equal(adminSharedParity.filter(item => !item.unchanged).length, 0, 'Admin/shared source changed');
  assert.deepEqual({ changed, missing, addedOutsideScope }, { changed: [], missing: [], addedOutsideScope: [] }, 'Preserve unrelated work; investigate external changes without resetting');
  console.log(`Verified ${sourceParity.length} source files and ${migrationParity.length} migration files against historical evidence; ${report.baselineFiles} baseline files preserved.`);
} else {
  throw new Error('Use baseline or verify');
}
