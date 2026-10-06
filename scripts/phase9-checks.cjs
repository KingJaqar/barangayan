/* global __dirname */
// Fresh execution evidence; never contacts or migrates a hosted database.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const mode = process.argv[2];
assert.ok(['baseline', 'builds', 'edge', 'final'].includes(mode));
const run = process.argv[3] || mode;
assert.match(run, /^[a-z0-9-]+$/);
const output = path.join(root, 'plans/evidence/phase9', run);
fs.mkdirSync(output, { recursive: true });
assert.ok(!fs.existsSync(path.join(output, 'results.json')), 'Preserve prior evidence');
const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
if (mode === 'baseline') {
  const status = git(['status', '--porcelain=v1', '-uall']);
  fs.writeFileSync(path.join(output, 'working-tree.txt'), status.stdout);
  const files = [...new Set([...git(['diff', '--name-only']).stdout.trim().split(/\r?\n/), ...git(['ls-files', '--others', '--exclude-standard']).stdout.trim().split(/\r?\n/)])].filter(f => f && !f.startsWith('plans/evidence/phase9/') && !f.startsWith('scripts/phase9-') && f !== 'plans/Phase_9_Integration_Cleanup_Release.md');
  fs.writeFileSync(path.join(output, 'preservation.json'), JSON.stringify(files.map(file => ({file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')})), null, 2));
}
const checks = mode === 'baseline' ? [
  ['shared-tests', 'packages/shared', ['node_modules/vitest/vitest.mjs', 'run']],
  ['shared-types', 'packages/shared', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['resident-web-types', 'apps/resident-web', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['admin-web-types', 'apps/admin-web', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['android-types', 'apps/resident-android-mobile', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['ios-tests', 'apps/resident-ios-mobile', ['node_modules/vitest/vitest.mjs', 'run']],
  ['ios-types', 'apps/resident-ios-mobile', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['resident-web-lint', 'apps/resident-web', ['node_modules/eslint/bin/eslint.js', '.']],
  ['admin-web-lint', 'apps/admin-web', ['node_modules/eslint/bin/eslint.js', '.']],
  ['android-lint', 'apps/resident-android-mobile', ['node_modules/eslint/bin/eslint.js', '.']],
  ['android-sdk', 'apps/resident-android-mobile', ['node_modules/expo/bin/cli', 'install', '--check']],
] : mode === 'builds' ? [
  ['resident-web-build', 'apps/resident-web', ['node_modules/next/dist/bin/next', 'build']],
  ['admin-web-build', 'apps/admin-web', ['node_modules/next/dist/bin/next', 'build']],
  ['android-export', 'apps/resident-android-mobile', ['node_modules/expo/bin/cli', 'export', '--platform', 'android', '--output-dir', '../../dist/phase9-android']],
] : mode === 'final' ? [
  ['resident-web-types', 'apps/resident-web', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['android-types', 'apps/resident-android-mobile', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['resident-web-lint', 'apps/resident-web', ['node_modules/eslint/bin/eslint.js', '.']],
  ['android-lint', 'apps/resident-android-mobile', ['node_modules/eslint/bin/eslint.js', '.']],
  ['phase9-script-lint', '.', ['node_modules/eslint/bin/eslint.js', ...fs.readdirSync(path.join(root,'scripts')).filter(f=>/^phase9-.*\.cjs$/.test(f)).map(f=>'scripts/'+f)]],
  ['resident-web-build', 'apps/resident-web', ['node_modules/next/dist/bin/next', 'build']],
  ['android-export', 'apps/resident-android-mobile', ['node_modules/expo/bin/cli', 'export', '--platform', 'android', '--output-dir', '../../dist/phase9-android']],
] : fs.readdirSync(path.join(root, 'supabase/functions')).filter(name => fs.existsSync(path.join(root, 'supabase/functions', name, 'index.ts'))).map(name => [name, '.', ['check', '--config', 'supabase/functions/deno.json', '--node-modules-dir=none', '--no-lock', `supabase/functions/${name}/index.ts`]]);
const results = [];
const selected=process.argv[4]?.split(',');
if(selected) assert.ok(selected.every(id=>checks.some(check=>check[0]===id)),'Only declared checks can be selected');
for (const [id, directory, args] of checks) {
  if(selected&&!selected.includes(id)) continue;
  const log = id + '.log', descriptor = fs.openSync(path.join(output, log), 'w');
  const startedAt = new Date().toISOString();
  const executable = mode === 'edge' ? path.join(root, 'dist/phase1-tools/deno/deno.exe') : process.execPath;
  const arguments_ = mode === 'edge' ? args : [path.join(root, args[0]), ...args.slice(1)];
  const result = spawnSync(executable, arguments_, {cwd:path.join(root,directory), windowsHide:true, timeout:300000,
    env:{...process.env, CI:'1', EXPO_NO_TELEMETRY:'1', NEXT_TELEMETRY_DISABLED:'1', ...(id === 'android-sdk' ? {EXPO_OFFLINE:'1'} : {})}, stdio:['ignore', descriptor, descriptor]});
  fs.closeSync(descriptor);
  results.push({id, directory, args, startedAt, finishedAt:new Date().toISOString(), exitCode:result.status, error:result.error?.message || null, log});
  fs.writeFileSync(path.join(output,'results.json'), JSON.stringify({head:git(['rev-parse','HEAD']).stdout.trim(),checks:results},null,2));
  console.log(`${id}: ${result.status === 0 ? 'PASS' : 'FAIL'}`);
}
process.exitCode = results.some(r => r.exitCode !== 0) ? 1 : 0;
