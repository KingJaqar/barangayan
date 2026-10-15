// Local evidence runner; uses installed tools and never modifies prior evidence.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const run = __dirname;
const root = path.resolve(run, '../../../../..');
const app = path.join(root, 'apps/resident-android-mobile');
const [stage, id] = process.argv.slice(2);
const safety = JSON.parse(fs.readFileSync(path.join(root, 'plans/evidence/resident-android-bloat-audit/strict-deletion-safety-2026-10-14.json'), 'utf8'));
const affected = safety.modifiedInMemory.map(item => path.relative(app, item.file));
const checks = {
  types: [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', path.join(app, 'tsconfig.json'), '--pretty', 'false'],
  tests: [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', path.join(app, 'vitest.config.ts'), '--reporter=json', '--outputFile', path.join(run, stage, 'tests.json')],
  lint: [path.join(root, 'node_modules/eslint/bin/eslint.js'), ...affected, '--format', 'json', '--output-file', path.join(run, stage, 'lint.json')],
  'android-export': [path.join(root, 'node_modules/expo/bin/cli'), 'export', '--platform', 'android', '--output-dir', path.join(run, stage, 'android-export')],
  'android-export-temp': [path.join(root, 'node_modules/expo/bin/cli'), 'export', '--platform', 'android', '--output-dir', path.join(run, stage, 'android-export-temp')],
  'web-export': [path.join(root, 'node_modules/expo/bin/cli'), 'export', '--platform', 'web', '--output-dir', path.join(run, stage, 'web-export')],
  'web-export-unrestricted': [path.join(root, 'node_modules/expo/bin/cli'), 'export', '--platform', 'web', '--output-dir', path.join(run, stage, 'web-export-unrestricted')],
};
if (!/^dc-\d\d(?:-[a-z]+)?$/.test(stage) || !Object.hasOwn(checks, id)) throw new Error('Unknown stage or check');
const output = path.join(run, stage);
fs.mkdirSync(output, { recursive: true });
const resultPath = path.join(output, `${id}-result.json`);
if (fs.existsSync(resultPath)) throw new Error('Use a new stage or check name; evidence is immutable');
const args = checks[id];
const startedAt = new Date().toISOString();
const log = fs.openSync(path.join(output, `${id}.log`), 'wx');
// Hermes cannot write its output in the sandbox's redirected system temp folder.
// Use a run-local writable temp only for this documented retry.
const temporary = path.join(output, 'temporary');
if (id.endsWith('-temp')) fs.mkdirSync(temporary, { recursive: true });
const child = spawn(process.execPath, args, {
  cwd: app,
  env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1', ...(id.endsWith('-temp') ? { TEMP: temporary, TMP: temporary } : {}) },
  stdio: ['ignore', log, log],
  windowsHide: true,
});
child.once('error', error => {
  fs.writeFileSync(resultPath, JSON.stringify({ id, stage, startedAt, finishedAt: new Date().toISOString(), error: error.message }, null, 2) + '\n');
  fs.closeSync(log);
  process.exitCode = 1;
});
child.once('exit', (exitCode, signal) => {
  fs.closeSync(log);
  fs.writeFileSync(resultPath, JSON.stringify({ id, stage, args, cwd: app, startedAt, finishedAt: new Date().toISOString(), exitCode, signal }, null, 2) + '\n');
  console.log(`${stage} ${id}: exit ${exitCode}`);
  process.exitCode = exitCode ?? 1;
});
