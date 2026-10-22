// P19-T09: records the identity of the source candidate (no build exists under OD-06) in candidate.json.
//   node plans/evidence/resident-ios-parity/phase-19/freeze.mjs
// Hashes are over file contents with line endings normalized, so they are stable across checkouts. Node, node_modules,
// env files and build output are not part of the candidate. Hosted facts are passed in because this script reads nothing remote.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..', '..');
const sha = (text) => createHash('sha256').update(text).digest('hex');
const normalized = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const SKIP = new Set(['node_modules', 'dist', '.expo']);
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (SKIP.has(e.name) || e.name.startsWith('.env') ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
function tree(paths) {
  const files = paths.map((p) => join(repo, p)).filter(existsSync).flatMap((p) => (statSync(p).isDirectory() ? walk(p) : [p])).sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(`${file.slice(repo.length + 1).replaceAll('\\', '/')}\0${sha(normalized(file))}\n`);
  return { files: files.length, sha256: hash.digest('hex') };
}
const migrations = readdirSync(join(repo, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).sort();
const ios = 'apps/resident-ios-mobile';
const candidate = {
  date: new Date().toISOString().slice(0, 10),
  base_commit: execSync('git rev-parse HEAD', { cwd: repo, encoding: 'utf8' }).trim(),
  working_tree: 'uncommitted on the base commit; nothing was committed',
  ios_workspace: tree([`${ios}/src`, `${ios}/tests`, `${ios}/app.config.ts`, `${ios}/package.json`, `${ios}/metro.config.js`, `${ios}/eas.json`, `${ios}/assets`, `${ios}/web`, `${ios}/scripts`]),
  shared_package: tree(['packages/shared/src']),
  supabase: { migrations: tree(['supabase/migrations']), functions: tree(['supabase/functions']), tests: tree(['supabase/tests']) },
  lockfile_sha256: sha(normalized(join(repo, 'package-lock.json'))),
  repository_migrations: { count: migrations.length, first: migrations[0], last: migrations.at(-1) },
  hosted_read_only_2026_10_21: {
    project: 'pwjbucnyqexiepoinoke', last_migration: '0134', not_applied: ['0135', '0136'],
    functions: { 'create-payment-source': 21, 'check-payment-status': 16, 'paymongo-webhook': 16, 'refund-payment': 13, 'cancel-payment': 11, 'export-my-data': 9, 'delete-my-account': 9, 'generate-household-qr': 9, 'verify-resident-email': 9, 'evacuation-route': 9, 'extract-resident-id': 9, 'extract-resident-id-ocrspace': 2, 'send-notifications': 'not deployed' },
  },
  toolchain: { node: process.version, expo: '57.0.10', reactNative: '0.86.2' },
  native_build: 'none (OD-06)',
  release_candidate_name: 'none: a source candidate only; no ios-rc-<version>-<build> name is issued',
};
writeFileSync(join(here, 'candidate.json'), `${JSON.stringify(candidate, null, 2)}\n`);
console.log(JSON.stringify({ ios: candidate.ios_workspace, shared: candidate.shared_package, base: candidate.base_commit, lock: candidate.lockfile_sha256 }, null, 1));
