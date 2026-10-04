// Local-only Phase 0 evidence collection. Never targets a hosted database or deploys.
// Database tests use the Supabase CLI's default local stack when it is available.
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.resolve(root, process.argv[2] || 'plans/evidence/phase0/initial');
if (!output.startsWith(root + path.sep)) throw new Error('Evidence must stay inside the workspace');
fs.mkdirSync(output, { recursive: true });
if (fs.existsSync(path.join(output, 'results.json'))) throw new Error('Use a new directory to preserve earlier evidence');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const status = git(['status', '--porcelain=v1', '-uall']);
fs.writeFileSync(path.join(output, 'working-tree.txt'), status.stdout + status.stderr);
const existing = [
  'supabase/migrations/0094_resident_ios_tenant_write_guards.sql',
  '.claude/settings.local.json',
  'barangayan project paper/Ampid1_CitizenCharter_DocumentProcessing_Context.pdf',
  'plans/Major_Web_AndroidMobile_Improvement_Plan.md',
];
const preservation = existing.map(file => ({ file, sha256: hash(path.join(root, file)) }));
fs.writeFileSync(path.join(output, 'preservation.json'), JSON.stringify(preservation, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'existing-migration.diff'), git(['diff', '--', existing[0]]).stdout);

const checks = [
  ['shared-tests', 'packages/shared', 'npm run test'],
  ['ios-tests', 'apps/resident-ios-mobile', 'npm run test'],
  ['shared-types', 'packages/shared', 'npx --no-install tsc --noEmit'],
  ['resident-web-types', 'apps/resident-web', 'npm run typecheck'],
  ['admin-web-types', 'apps/admin-web', 'npm run typecheck'],
  ['android-types', 'apps/resident-android-mobile', 'npx --no-install tsc --noEmit'],
  ['ios-types', 'apps/resident-ios-mobile', 'npm run typecheck'],
  ['root-lint', '.', 'npm run lint'],
  ['resident-web-lint', 'apps/resident-web', 'npm run lint'],
  ['admin-web-lint', 'apps/admin-web', 'npm run lint'],
  ['android-lint', 'apps/resident-android-mobile', 'npm run lint'],
  ['ios-lint', 'apps/resident-ios-mobile', 'npm run lint'],
  ['resident-web-build', 'apps/resident-web', 'npm run build'],
  ['admin-web-build', 'apps/admin-web', 'npm run build'],
  ['android-export', 'apps/resident-android-mobile', 'npx --no-install expo export --platform android --output-dir dist/phase0-android'],
  ['ios-export', 'apps/resident-ios-mobile', 'npm run export:ios -- --output-dir dist/phase0-ios'],
  ['ios-release', 'apps/resident-ios-mobile', 'npm run check:release'],
  ['android-sdk', 'apps/resident-android-mobile', 'npx --no-install expo install --check'],
  ['ios-sdk', 'apps/resident-ios-mobile', 'npx --no-install expo install --check'],
  ['database-tests', '.', 'supabase test db'],
  ['supabase-cli', '.', 'supabase --version'],
  ['docker', '.', 'docker version'],
  ['database-client', '.', 'psql --version'],
  ['android-device', '.', 'adb devices'],
  ['deno', '.', 'deno --version'],
  ['edge-types', '.', 'deno check supabase/functions/*/index.ts'],
];
const selected = process.argv.slice(3);
if (selected.some(id => !checks.some(check => check[0] === id))) throw new Error('Unknown check ID');
const results = [];
for (const [id, directory, command] of checks) {
  if (selected.length && !selected.includes(id)) continue;
  const startedAt = new Date().toISOString();
  console.log(`Running ${id}`);
  let log = `${id}.log`;
  const logPath = path.join(output, log);
  const descriptor = fs.openSync(logPath, 'w');
  const result = spawnSync(command, {
    cwd: path.join(root, directory), shell: true, encoding: 'utf8',
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1', NEXT_TELEMETRY_DISABLED: '1',
      ...(id.endsWith('-sdk') ? { EXPO_OFFLINE: '1' } : {}) },
    timeout: 300000, stdio: ['ignore', descriptor, descriptor],
  });
  fs.closeSync(descriptor);
  if (result.error) fs.appendFileSync(logPath, `\n${result.error.message}\n`);
  if (fs.statSync(logPath).size > 1024 * 1024) {
    const bytes = fs.readFileSync(logPath);
    fs.writeFileSync(`${logPath}.gz`, zlib.gzipSync(bytes));
    // Keep a readable excerpt and the complete lossless compressed diagnostic log.
    fs.writeFileSync(logPath, bytes.subarray(0, 8000).toString() + '\n[Full output in ' + log + '.gz]\n' + bytes.subarray(-8000).toString());
    log += '.gz';
  }
  results.push({ id, directory, command, startedAt, finishedAt: new Date().toISOString(),
    exitCode: result.status, signal: result.signal, error: result.error?.code || null, log });
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({
    node: process.version, platform: process.platform, head: git(['rev-parse', 'HEAD']).stdout.trim(), checks: results,
  }, null, 2) + '\n');
  console.log(`${id}: ${result.status === 0 ? 'PASS' : 'FAIL'} (exit ${result.status})`);
}
const after = preservation.map(({file, sha256}) => ({file, unchanged: hash(path.join(root, file)) === sha256}));
fs.writeFileSync(path.join(output, 'preservation-after.json'), JSON.stringify(after, null, 2) + '\n');
if (after.some(item => !item.unchanged)) throw new Error('An existing file changed during baseline collection');
process.exitCode = results.some(item => item.exitCode !== 0) ? 1 : 0;
