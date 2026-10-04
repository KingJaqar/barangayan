/* global __dirname */
// Only the isolated WSL project; never accepts a hosted URL or linked project.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'plans/evidence/phase1/completion-live-stack');
const commands = {
  help: ['--help'],
  'start-help': ['start', '--help'],
  'reset-help': ['db', 'reset', '--help'],
  'test-help': ['test', 'db', '--help'],
  'advisors-help': ['db', 'advisors', '--help'],
  // Keep all tested services and Realtime; omit optional dashboards/analytics.
  start: ['start', '--exclude', 'imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor'],
  reset: ['db', 'reset', '--local', '--yes'],
  test: ['test', 'db', '--local'],
  advisors: ['db', 'advisors', '--local', '--fail-on', 'error', '--output-format', 'json'],
  stop: ['stop'],
};
const command = process.argv[2];
if (!Object.hasOwn(commands, command)) throw new Error('Unknown isolated local check');
fs.mkdirSync(output, { recursive: true });
function redact(text) {
  return text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[LOCAL JWT REDACTED]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[LOCAL API KEY REDACTED]')
    .replace(/^.*(?:Access Key|Secret Key|JWT Secret|S3_ACCESS|S3_SECRET|PASSWORD).*$/gmi, '[LOCAL CREDENTIAL LINE REDACTED]')
    .replace(/postgresql:\/\/[^\s]+/g, '[LOCAL DATABASE URL REDACTED]');
}
const startedAt = new Date().toISOString();
const result = spawnSync('wsl.exe', ['--distribution', 'barangayan-phase1', '--user', 'root',
  '--cd', '/mnt/c/Users/User/barangayan', '--exec', '/opt/barangayan-tools/supabase', ...commands[command]],
{ cwd: root, encoding: 'utf8', timeout: 1800000, maxBuffer: 64 * 1024 * 1024 });
const log = redact(result.stdout + result.stderr);
const stamp = Date.now();
const basename = `${command}-${stamp}`;
fs.writeFileSync(path.join(output, basename + '.log'), log);
const record = { command, startedAt, finishedAt: new Date().toISOString(), exitCode: result.status,
  passed: result.status === 0 && !/not ok|Looks like you failed|planned \d+ tests but ran/.test(log),
  error: result.error?.message, log: `completion-live-stack/${basename}.log`,
  appliedMigrations: [...log.matchAll(/Applying migration ([^\s]+\.sql)/g)].map(match => match[1]),
  assertions: Number(log.match(/Tests=(\d+)/)?.[1] || 0) };
fs.writeFileSync(path.join(output, basename + '.json'), JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify(record));
if (!record.passed) process.exitCode = 1;
