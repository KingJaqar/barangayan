import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const app = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(app, '../..');
const require = createRequire(path.join(app, 'package.json'));
const out = path.resolve(process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-navigation-')));
fs.mkdirSync(out, { recursive: true });
const browser = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const brave = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const env = { ...process.env, ...(browser ? {} : fs.existsSync(brave) ? { PLAYWRIGHT_CHROMIUM_EXECUTABLE: brave } : {}) };
const suites = [
  ['app-unit', app, [require.resolve('vitest/vitest.mjs'), 'run']],
  ['routing-unit', path.join(repo, 'packages/shared'), [require.resolve('vitest/vitest.mjs'), 'run', 'src/lib/evacuation-routing.test.ts', 'src/lib/connected-route-client.test.ts', 'src/lib/agency-sla.test.ts']],
  ...['refresh-ownership', 'hidden-work-ownership', 'map-state-bridge', 'root-navigation-isolation',
    'request-tracking-navigation', 'resident-shell-lifecycle', 'services-tab-stability', 'services-lists-ui',
    'health-presentation-ui', 'reports-announcements-ui', 'maps-presentation-ui', 'drrm-centers-ui',
    'tracking-payment-ui'].map(name => [name, repo, [path.join(app, 'tests', `${name}.mjs`)]]),
];
const results = [];
for (const [name, cwd, args] of suites) {
  const artifacts = path.join(out, name);
  fs.mkdirSync(artifacts, { recursive: true });
  const log = path.join(out, `${name}.log`);
  const fd = fs.openSync(log, 'w');
  try {
    const result = await new Promise(resolve => {
      const child = spawn(process.execPath, args, { cwd, env: { ...env, TEST_ARTIFACTS_DIR: artifacts }, stdio: ['ignore', fd, fd] });
      child.once('error', error => resolve({ status: 'fail', error: error.message }));
      child.once('close', (code, signal) => resolve({ status: code === 0 ? 'pass' : 'fail', code, signal }));
    });
    results.push({ name, ...result, log });
    console.log(`${name}: ${result.status} (${log})`);
  } finally {
    fs.closeSync(fd);
  }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ nativePerformanceVerified: false, results }, null, 2));
}
console.log(`Supporting behavioral evidence only. Android release/device acceptance is separate. Results: ${out}`);
if (results.some(result => result.status !== 'pass')) process.exitCode = 1;
