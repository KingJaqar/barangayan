// Evidence only. Each invocation runs one finite check; never starts a service.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const dir = import.meta.dirname;
const root = path.resolve(dir, '../../..');
const commands = {
  fixtures: { args: ['--test', '--test-timeout=30000', path.join(dir, 'verify.mjs')], timeout: 35000 },
  typecheck: { args: [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--incremental', 'false'], cwd: path.join(root, 'apps/admin-web'), timeout: 60000 },
  local: { args: [path.join(dir, 'local-read.mjs')], timeout: 35000 },
};
const name = process.argv[2];
assert.ok(name in commands, 'Use fixtures, typecheck or local; run focused-lint.mjs with batch 0 or 1 separately');
const command = commands[name];
const started = Date.now();
const result = spawnSync(process.execPath, command.args, {
  cwd: command.cwd ?? root, timeout: command.timeout, windowsHide: true,
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
});
fs.writeFileSync(path.join(dir, name + '.log'), (result.stdout ?? '') + (result.stderr ?? ''));
const report = { name, status: result.status, error: result.error?.code ?? null,
  elapsedMs: Date.now() - started, timeoutMs: command.timeout, retries: 0 };
fs.writeFileSync(path.join(dir, name + '-result.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (result.status !== 0) process.exitCode = 1;
