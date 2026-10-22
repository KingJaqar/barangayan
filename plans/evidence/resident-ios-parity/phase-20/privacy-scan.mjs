// P20-T02 (OD-06): a lead-finding scan for Apple privacy manifests and required-reason API use in the native iOS code of the dependencies the
// resident iOS app links. It is a source heuristic, not an Xcode privacy report (that needs macOS and a signed archive): a hit without a shipped
// `PrivacyInfo.xcprivacy` is a package to review, and a miss is not proof of absence.
//   node plans/evidence/resident-ios-parity/phase-20/privacy-scan.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ios = path.resolve(here, '../../../../apps/resident-ios-mobile');
const require = createRequire(path.join(ios, 'package.json'));
const pkg = JSON.parse(fs.readFileSync(path.join(ios, 'package.json'), 'utf8'));

const categories = {
  'file timestamp': /\b(NSFileCreationDate|NSFileModificationDate|fileModificationDate|fileCreationDate|NSURLContentModificationDateKey|NSURLCreationDateKey|contentModificationDateKey|creationDateKey|getattrlist|getattrlistbulk|fstatat|lstat|fstat)\b/,
  'system boot time': /\b(systemUptime|mach_absolute_time|clock_gettime_nsec_np)\b/,
  'disk space': /\b(volumeAvailableCapacityKey|volumeAvailableCapacityForImportantUsageKey|volumeAvailableCapacityForOpportunisticUsageKey|volumeTotalCapacityKey|NSFileSystemFreeSize|NSFileSystemSize|systemFreeSize|systemSize|statfs|statvfs|fstatfs)\b/,
  'active keyboard': /\bactiveInputModes\b/,
  'user defaults': /\b(NSUserDefaults|UserDefaults)\b/,
};
const nativeExtensions = /\.(swift|m|mm|h|c|cpp)$/;

function packageDirectory(name) {
  try { return path.dirname(require.resolve(`${name}/package.json`)); } catch { /* fall through to a manual lookup for packages that do not export package.json */ }
  let dir = ios;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

function scan(dir, state) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'android' || entry.name === 'build' || entry.name === 'Pods') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full, state);
    else if (entry.name === 'PrivacyInfo.xcprivacy') state.manifests.push(path.relative(state.root, full).split(path.sep).join('/'));
    else if (nativeExtensions.test(entry.name)) {
      state.nativeFiles += 1;
      const text = fs.readFileSync(full, 'utf8');
      for (const [category, pattern] of Object.entries(categories)) if (pattern.test(text)) state.categories.add(category);
    }
  }
}

const names = [...Object.keys(pkg.dependencies), 'react-native'].filter((name, index, all) => all.indexOf(name) === index && name !== '@barangayan/shared');
const rows = [];
for (const name of names) {
  const root = packageDirectory(name);
  if (!root) { rows.push({ package: name, status: 'not-installed' }); continue; }
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const state = { root, manifests: [], nativeFiles: 0, categories: new Set() };
  const iosDirectories = [path.join(root, 'ios'), path.join(root, 'apple'), ...(name === 'react-native' ? [path.join(root, 'React'), path.join(root, 'ReactCommon'), path.join(root, 'third-party-podspecs')] : [])];
  for (const dir of iosDirectories) if (fs.existsSync(dir)) scan(dir, state);
  const hasNative = state.nativeFiles > 0;
  const hits = [...state.categories].sort();
  rows.push({
    package: name,
    version,
    native_ios_files: state.nativeFiles,
    privacy_manifests: state.manifests.length,
    required_reason_categories_seen: hits,
    status: !hasNative ? 'javascript-only' : hits.length && !state.manifests.length ? 'REVIEW: required-reason API symbols with no shipped manifest' : state.manifests.length ? 'manifest shipped' : 'native, no required-reason symbols found',
  });
}
const review = rows.filter((row) => String(row.status).startsWith('REVIEW'));
const results = { date: new Date().toISOString().slice(0, 10), packages: rows, review: review.map((row) => row.package) };
fs.writeFileSync(path.join(here, 'privacy-scan-results.json'), `${JSON.stringify(results, null, 2)}\n`);
for (const row of rows) console.log(`${String(row.status).padEnd(58)} ${row.package}@${row.version ?? '?'}  native=${row.native_ios_files ?? 0} manifests=${row.privacy_manifests ?? 0} ${row.required_reason_categories_seen?.join(',') ?? ''}`);
console.log(`\n${rows.length} packages scanned; ${review.length} to review: ${review.map((row) => row.package).join(', ') || 'none'}`);
