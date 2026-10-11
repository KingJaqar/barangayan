// One finite follow-up after two concurrent large batches timed out.
// Four smaller batches run sequentially by the caller, with no automatic retry.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const dir = import.meta.dirname;
const root = path.resolve(dir, '../../..');
const batch = Number(process.argv[2]);
if (![0, 1, 2, 3].includes(batch)) throw new Error('Choose batch 0..3');
const files = JSON.parse(fs.readFileSync(path.join(dir, 'source-inventory.json'), 'utf8'))
  .map(row => row.file).filter(file => /\.tsx?$/.test(file) && file.startsWith('apps/admin-web/'))
  .slice(batch * 17, (batch + 1) * 17);
const started = Date.now();
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/eslint/bin/eslint.js'),
  ...files.map(file => path.join(root, file))], { cwd: path.join(root, 'apps/admin-web'),
  timeout: 45000, windowsHide: true, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
fs.writeFileSync(path.join(dir, `lint-small${batch}.log`), (result.stdout ?? '') + (result.stderr ?? ''));
const report = { files, status: result.status, error: result.error?.code ?? null,
  elapsedMs: Date.now() - started, timeoutMs: 45000, retries: 0,
  boundary: 'One sequential smaller-workload follow-up; original timeouts retained, cause unproven.' };
fs.writeFileSync(path.join(dir, `lint-small${batch}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ batch, ...report, files: files.length }));
if (result.status !== 0) process.exitCode = 1;
