// P00-T01 read-only baseline inventory. Writes only baseline.json and baseline-status.txt beside this file.
// Run from any directory: node plans/evidence/resident-ios-parity/phase-00/inventory.mjs
import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const root = path.resolve(here, '../../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative));
const sha256 = (relative) => createHash('sha256').update(read(relative)).digest('hex').toUpperCase();
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const installed = (name) => {
  for (const base of ['node_modules', 'apps/resident-ios-mobile/node_modules']) {
    const file = path.join(root, base, name, 'package.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')).version;
  }
  return null;
};
function routes(relative) {
  const result = [];
  (function walk(folder) {
    for (const entry of fs.readdirSync(path.join(root, folder), { withFileTypes: true })) {
      const name = `${folder}/${entry.name}`;
      if (entry.isDirectory()) walk(name);
      else if (/\.tsx?$/.test(entry.name)) result.push(name.slice(relative.length + 1));
    }
  })(relative);
  return result.sort();
}

const hashed = [
  'plans/Resident_iOS_Implementation_Plan.md',
  'plans/Resident_iOS_UI_UX_Design_System_Handoff.md',
  'contexts/Resident_Android_Features&Functions_BreakdownList.md',
  'AGENTS.md',
  'package-lock.json',
  'apps/resident-ios-mobile/package.json',
  'apps/resident-ios-mobile/app.config.ts',
  'apps/resident-ios-mobile/src/lib/release-gates.ts',
  'apps/resident-android-mobile/package.json',
  'apps/resident-android-mobile/app.json',
  'packages/shared/package.json',
];

const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
const prefixes = migrations.map((name) => Number(name.slice(0, 4)));
const highest = Math.max(...prefixes);
const missingPrefixes = [];
for (let number = 1; number < highest; number++) if (!prefixes.includes(number)) missingPrefixes.push(String(number).padStart(4, '0'));
const duplicatePrefixes = [...new Set(prefixes.filter((value, index) => prefixes.indexOf(value) !== index))];

const gatesSource = read('apps/resident-ios-mobile/src/lib/release-gates.ts').toString();
const gates = Object.fromEntries([...gatesSource.matchAll(/^\s{2}(\w+): (true|false),/gm)].map((match) => [match[1], match[2] === 'true']));

const status = git('status', '--porcelain=v1', '--untracked-files=all');
const baseline = {
  capturedAt: new Date().toISOString(),
  timezoneNote: 'Asia/Manila is the project operating timezone; capturedAt is UTC.',
  head: git('rev-parse', 'HEAD'),
  headCommittedAt: git('log', '-1', '--format=%cI'),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  dirtyEntries: status ? status.split('\n').length : 0,
  toolchain: { node: process.version, npm: execSync('npm --version', { encoding: 'utf8' }).trim() },
  sha256: Object.fromEntries(hashed.map((file) => [file, sha256(file)])),
  installedVersions: Object.fromEntries(['expo', 'expo-router', 'react', 'react-native', '@expo/ui', 'expo-secure-store', 'expo-splash-screen', 'expo-crypto', '@supabase/supabase-js', 'react-native-screens', 'react-native-safe-area-context', 'typescript', 'vitest'].map((name) => [name, installed(name)])),
  iosDeclaredDependencies: JSON.parse(read('apps/resident-ios-mobile/package.json')).dependencies,
  migrations: {
    count: migrations.length,
    highestPrefix: String(highest).padStart(4, '0'),
    nextUnusedPrefix: String(highest + 1).padStart(4, '0'),
    missingPrefixes,
    duplicatePrefixes,
    highestFile: migrations.at(-1),
  },
  edgeFunctions: fs.readdirSync(path.join(root, 'supabase/functions'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(),
  androidRoutes: routes('apps/resident-android-mobile/src/app'),
  iosRoutes: routes('apps/resident-ios-mobile/src/app'),
  iosReleaseGates: gates,
};
baseline.androidRouteCount = baseline.androidRoutes.length;
baseline.iosRouteCount = baseline.iosRoutes.length;

fs.writeFileSync(path.join(here, 'baseline.json'), `${JSON.stringify(baseline, null, 2)}\n`);
fs.writeFileSync(path.join(here, 'baseline-status.txt'), `${baseline.head}\n${status}\n`);
console.log(`HEAD ${baseline.head}; ${baseline.dirtyEntries} dirty entries; ${baseline.androidRouteCount} Android routes; ${baseline.iosRouteCount} iOS routes; migrations to ${baseline.migrations.highestPrefix} (next ${baseline.migrations.nextUnusedPrefix}).`);
