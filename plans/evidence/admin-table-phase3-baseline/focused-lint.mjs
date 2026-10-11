// Reduced scope after the whole-package 60s timeout; no retry of the same check.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../../..');
const files = JSON.parse(fs.readFileSync(new URL('./source-inventory.json', import.meta.url), 'utf8')).map(item => item.file).filter(file => /\.tsx?$/.test(file) && file.startsWith('apps/admin-web/'));
const start = Date.now();
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/eslint/bin/eslint.js'), ...files.map(file => path.join(root, file))], { cwd: path.join(root, 'apps/admin-web'), encoding: 'utf8', timeout: 60000, windowsHide: true });
fs.writeFileSync(new URL('./focused-lint.log', import.meta.url), (result.stdout ?? '') + (result.stderr ?? ''));
const report = { files: files.length, status: result.status, error: result.error?.code ?? null, elapsedMs: Date.now() - start, timeoutMs: 60000, boundary: 'Focused affected source lint; whole-package timeout remains recorded.' };
fs.writeFileSync(new URL('./focused-lint.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (result.status !== 0) process.exitCode = 1;
