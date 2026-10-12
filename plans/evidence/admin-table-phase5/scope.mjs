import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../../..');
const baselinePath = path.join(import.meta.dirname, 'baseline.json');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
const hash = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const files = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))];
const allowed = file => file.startsWith('plans/evidence/admin-table-phase5/') ||
  file.startsWith('apps/admin-web/src/app/(admin)/incident-reports/') ||
  file.startsWith('apps/admin-web/src/app/(admin)/health/') ||
  ['apps/admin-web/src/lib/admin-tables/operations-config.ts', 'apps/admin-web/src/lib/admin-tables/queries/operations-options.ts',
   'apps/admin-web/src/components/admin/operations-table-summary.tsx', 'apps/admin-web/src/hooks/use-profile-table-detail.ts',
   'apps/admin-web/src/components/admin/table-detail-dialog.tsx', 'apps/admin-web/tests/table-browse/operations.test.ts',
   'plans/Admin_Web_Table_Browsing_Sorting_Pagination_and_Filters_Implementation_Plan.md'].includes(file);
if (process.argv.includes('--capture')) {
  if (fs.existsSync(baselinePath)) throw new Error('Preserve immutable baseline');
  fs.writeFileSync(baselinePath, JSON.stringify({ timestamp: new Date().toISOString(), status: git(['status', '--short']),
    hashes: Object.fromEntries(files.map(file => [file, hash(file)])) }, null, 2));
  console.log(`Captured ${files.length} repository files and existing dirty state`);
} else {
  const baseline = JSON.parse(fs.readFileSync(baselinePath));
  const changed = Object.keys(baseline.hashes).filter(file => !fs.existsSync(path.join(root, file)) || hash(file) !== baseline.hashes[file]);
  const added = files.filter(file => !(file in baseline.hashes));
  const outside = [...changed, ...added].filter(file => !allowed(file));
  const report = { timestamp: new Date().toISOString(), changed, added, outside, passed: outside.length === 0 };
  fs.writeFileSync(path.join(import.meta.dirname, 'scope.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (outside.length) process.exitCode = 1;
}
