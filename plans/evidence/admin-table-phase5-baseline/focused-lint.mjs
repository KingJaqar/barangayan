// Two finite batches; the preceding audit established that combined lint can time out.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../../..');
const files = JSON.parse(fs.readFileSync(new URL('./source-inventory.json', import.meta.url), 'utf8')).map(item => item.file).filter(file => /\.tsx?$/.test(file) && file.startsWith('apps/admin-web/'));
const start = Date.now();
const batch = Number(process.argv[2]);
if (![0, 1].includes(batch)) throw new Error('Choose batch 0 or 1');
const selected = files.slice(batch * 33, (batch + 1) * 33);
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/eslint/bin/eslint.js'), ...selected.map(file => path.join(root, file))], { cwd: path.join(root, 'apps/admin-web'), encoding: 'utf8', timeout: 45000, windowsHide: true });
fs.writeFileSync(new URL(`./lint-batch${batch}.log`, import.meta.url), (result.stdout ?? '') + (result.stderr ?? ''));
const report = { files: selected, status: result.status, error: result.error?.code ?? null, elapsedMs: Date.now() - start, timeoutMs: 45000, boundary: 'Affected source batch only; no combined lint attempt in this stage.' };
fs.writeFileSync(new URL(`./lint-batch${batch}.json`, import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (result.status !== 0) process.exitCode = 1;
