const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../../..');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-00/hashes.json'), 'utf8'));
const allowed = [
  'apps/resident-android-mobile/src/components/resident-details-form.tsx',
  'plans/Resident_Android_Code_and_File_Bloat_Audit_2026_10_14.md',
  'plans/Resident_Android_Unused_Code_Deletion_Execution_Plan_2026_10_14.md',
];
const changed = [];
for (const [file, expected] of Object.entries(baseline)) {
  const target = path.join(root, file);
  if (!fs.existsSync(target) || crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== expected) changed.push(file);
}
const result = { filesCompared: Object.keys(baseline).length, changed, unexpected: changed.filter(file => !allowed.includes(file)), head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim() };
fs.writeFileSync(path.join(__dirname, 'dc-06/final-preservation.json'), JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'dc-06/git-status.txt'), spawnSync('git', ['status', '--porcelain=v1', '-uall'], { cwd: root, encoding: 'utf8' }).stdout);
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.unexpected.length ? 1 : 0;
