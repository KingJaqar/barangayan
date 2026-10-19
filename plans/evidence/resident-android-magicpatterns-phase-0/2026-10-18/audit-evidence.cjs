// Rebuild the Phase 0 inventories and verify the evidence without modifying application code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../../../..');
const planName = 'Resident_Android_MagicPatterns_Redesign_Implementation_Plan.md';
const recordName = 'Resident_Android_MagicPatterns_Prototype_Inspection_Record.md';
const specName = 'Resident_Android_MagicPatterns_Motion_and_Fidelity_Specification.md';
const planPath = path.join(root, 'plans', planName);
const read = file => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeJson = (file, value) => fs.writeFileSync(path.join(__dirname, file), JSON.stringify(value, null, 2) + '\n');

const motionIds = [
  'M01 M04 M11 M12 M16', 'M03 M12', 'M03 M12', 'M03 M12', 'M04 M05 M12 M16',
  'M06 M12 M16', 'M04 M06 M12 M16', 'M05 M12 M16', 'M12 M16', 'M05 M12 M15 M16',
  'M03 M06 M12', 'M02 M03 M07 M08', 'M02 M03 M07 M08', 'M04 M10 M11', 'M04 M05 M11 M12',
  'M03 M06 M11', 'M03 M07 M08', 'M03 M07 M08', 'M03 M04 M11 M12', 'M03 M04 M12',
  'M04 M12 M13 M16', 'M13 M16', 'M03 M12', 'M03 M12', 'M03 M12',
  'M04 M09 M10 M11 M12 M16', 'M07 M08 M10 M11 M12 M16', 'M03 M04 M12', 'M16',
  'M03 M04 M05 M11 M12', 'M04 M09 M12 M16', 'M04 M05 M10 M12 M16', 'M04 M05 M12 M16',
  'M04 M12 M16', 'M07 M08 M09 M12 M16', 'M03 M11 M12 M16', 'M12 M16', 'M03 M12 M16', 'M03 M12 M14 M16',
];
const previousRecord = read(path.join(__dirname, 'before', recordName));
const rows = previousRecord.split(/\r?\n/).filter(line => /^\| \d+ \|/.test(line)).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
if (rows.length !== 39 || motionIds.length !== 39) throw new Error('Expected the retained 39-entry inventory');
let coverage = '# Screen/state evidence status — Phase 0\n\n';
coverage += 'All 39 reference entries were reached in earlier walkthroughs according to the preserved [inspection record](../../../' + recordName + '). This session rechecked v32/artifact identity and only the next packet’s missing core variants. Earlier observations are inherited evidence, not newly executed tests. Motion IDs identify relevant presentation families, not proof of native execution.\n\n';
coverage += 'The owner confirmed the main MuMu session is disposable and subsequently authorized automated native checks. The SDK 57 development menu, connected Metro runtime and local project-root manifest qualify the development baseline; the production export was not installed. Observed native states below are before-state evidence, not redesign fidelity passes. All unlisted variations remain pending in their owning phase; no integration or motion-performance pass is inferred.\n\n';
coverage += '| # | Screen/state | Relevant motion IDs | Reference evidence status | Native before-state | Remaining named variants from inspection record |\n|---|---|---|---|---|---|\n';
for (const [index, row] of rows.entries()) {
  const id = Number(row[0]);
  const fresh = id === 30 ? 'This session: Settings/core controls, sheet cancel, confirmation cancel, font selection and too-light field. Other variants inherited.' : 'Earlier browser entry/selected states; not repeated this session.';
  const nativeStates = {
    1: '[Guest Home](native/guest-home/screen.png); signed-in Home in [earlier capture](native/owner-navigation-state.png).',
    2: '[Signed-in catalog](native/services-resumed/screen.png) and [guest catalog](native/guest-services/screen.png); unequal fixture counts retained.',
    3: '[Before-state screenshot](native/initial-screen.png): Requests/Active/All. Other filters pending.',
    6: '[Signed-in guide](native/indigency-guide/screen.png) and [guest login gate](native/guest-guide-settled/screen.png).',
    7: '[Form](native/request-form-top/screen.png), [purpose sheet](native/purpose-sheet-open/screen.png), [Back dismissal](native/purpose-sheet-back/screen.png); no submit.',
    30: '[Settings](native/settings-before.png), [color sheet](native/color-open/screen.png)/[Cancel](native/color-cancelled/screen.png), [format dialog](native/format-dialog-open/screen.png)/[Cancel](native/format-dialog-cancelled/screen.png); no save/export.',
    31: 'Profile before-state visible in [manual recording/contact sheet](native/manual-contact-sheet.jpg); save not pressed.',
    33: 'Manual recording shows existing password-status loading; no credential action or successful-flow claim.',
  };
  const native = nativeStates[id] ?? 'Deferred to owning phase; no current native capture.';
  coverage += `| ${id} | ${row[1]} | ${motionIds[index]} | ${fresh} | ${native} | ${row[3]} |\n`;
}
const planText = read(planPath);
const familyStart = planText.indexOf('### State coverage required for each screen family');
const familyEnd = planText.indexOf('## 5. Shared presentation work', familyStart);
if (familyStart < 0 || familyEnd < 0) throw new Error('State-family inventory moved');
const familyStates = planText.slice(familyStart, familyEnd).split(/\r?\n/).filter(line => line.startsWith('- **'));
coverage += '\n## State-variant status policy\n\nEvery variant named below is **native pending manual verification** in Phase 0, with no pass inferred from source/tests/prototype. The table above preserves narrower reference observations and the exact remaining browser gaps. Unavailable backend/account/permission variants are deferred to their owning packet, never simulated as product success. No additional fixture was created by changing real data.\n\n';
coverage += familyStates.join('\n') + '\n\n';
coverage += 'Later-phase-only variants stay explicitly deferred; Phase 0 does not execute all later workflows. Representative list/form/core controls and guest/signed-in fixtures are captured. Remaining reduced-motion, full-rate/interruption and theme/font/size variants must be qualified when the owning packet adopts the relevant controls. See [acceptance and handoff](README.md#phase-0-acceptance-and-handoff).\n';
fs.writeFileSync(path.join(__dirname, 'screen-state-evidence.md'), coverage);

const motionRows = [
  ['M01', 'Earlier sequence 01', 'No new run; reduced motion/rapid selection/timing deferred.'],
  ['M02', 'Earlier sequences 09–11', 'No new run; bar/overlay synchronization and native reset deferred.'],
  ['M03', 'Earlier 02–03 and 18; current Settings selected Light state', 'Native screenshot shows settled Services indicators only; no motion qualification.'],
  ['M04', 'New 01–02 reference color sheet; native color open/Cancel and purpose sheet/Android Back', 'Final states verified. Exact native durations, reversal, reduced motion and resource profiling deferred.'],
  ['M05', 'New 03–04 synthetic logout dialog open/Cancel; native export-format dialog/Cancel', 'Intermediate reference opacity samples inspected. Native OS dialog is a preserved adaptation; no confirm/export, reduced-motion or exact-duration pass.'],
  ['M06', 'Earlier 07–08 and 14', 'No new run; next owning phases retain interruption/height/date checks.'],
  ['M07', 'Earlier 12–13; direct-pin issue preserved in 11', 'No new run; latest selection/background/native event handling deferred.'],
  ['M08', 'Earlier incidental camera samples in 12; declared .5 s source', 'Standalone timing/easing, native fit and reduced motion deferred.'],
  ['M09', 'Earlier picker entry only', 'No new recording; permission/drag/cancel/full transition deferred to owning phases.'],
  ['M10', 'Earlier unavailable camera frame and viewer affordance', 'Successful feed/viewer recording and native camera lifecycle deferred; no permissions changed.'],
  ['M11', 'Earlier 06 shelf and wheel/photo affordances', 'No invented duration; native snapping/gesture arbitration deferred.'],
  ['M12', 'New 05 font selected state; new sheet/dialog button interactions and disabled Save Color', 'Source CSS/selection samples only; held-press .98 scale and switch interpolation not qualified.'],
  ['M13', 'Earlier local Health success interaction; declared 240 ms source', 'No new recording; native authoritative-success/replay checks deferred.'],
  ['M14', 'Earlier 16–17', 'No new run; preserve sequential text and immediate History adaptation.'],
  ['M15', 'Earlier QR entry; source waiting declaration', 'No new recording; expiry/provider/pulse states deferred; no payment performed.'],
  ['M16', 'Earlier 01, 15, 19–20', 'No new run; current native stack/Search adaptations preserved; no generic route-motion claim.'],
];
let motion = '# Motion evidence status — Phase 0\n\n';
motion += 'Targets remain in the unchanged [motion specification](../../../' + specName + '). “Earlier” refers to the retained [22-sequence index](../../resident-android-magicpatterns-inspection/fresh-motion/README.md). “New” refers to [this run’s capture summary](reference/capture-summary.json). Native before-state recordings/final states now exist for core controls; continuous smoothness, exact measured durations, profiler gates, reduced-motion playback and rapid interruption remain unverified. A source declaration and a screenshot sampling rate do not pass these gates.\n\n';
motion += '| ID | Reference status | Explicit remaining limit |\n|---|---|---|\n';
for (const row of motionRows) motion += '| ' + row.join(' | ') + ' |\n';
motion += '\nOnly missing next-packet core variants were added. No later implementation began. Existing 280/200 ms sheet/scrim, 200 ms confirmation, font/icon/dark/contrast and native-control adaptations remain binding; this execution changes no motion definition.\n';
fs.writeFileSync(path.join(__dirname, 'motion-status.md'), motion);

const referenceDir = path.join(__dirname, 'reference');
const captures = fs.readdirSync(referenceDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
  const metadata = JSON.parse(read(path.join(referenceDir, entry.name, 'capture.json')));
  const midpoints = metadata.frames.map(frame => (Date.parse(frame.started) + Date.parse(frame.ended)) / 2);
  const intervals = midpoints.slice(1).map((time, index) => time - midpoints[index]).sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  const files = metadata.frames.map(frame => path.join(referenceDir, entry.name, frame.filename));
  const jpegHeadersValid = files.every(file => { const bytes = fs.readFileSync(file); return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217; });
  return { name: entry.name, frameCount: files.length, approximateMedianSampleHz: Number((1000 / median).toFixed(2)), actionStarted: metadata.actionStarted, actionResolved: metadata.actionResolved, actionError: metadata.actionError ?? null, jpegHeadersValid, bytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0) };
});
writeJson('reference/capture-summary.json', { capturedAt: new Date().toISOString(), cssViewport: { width: 1666, height: 865, devicePixelRatio: 1.5 }, reducedMotion: false, version: 'v32', artifact: 'df178e1c-7b6e-4d98-8334-06f3a00f28c3', totalFrames: captures.reduce((sum, capture) => sum + capture.frameCount, 0), warning: 'Sampling frequency is not rendering FPS. JPEG signature validation is not a full-image decode. Selected frames were visually inspected.', captures });

const savedHashes = JSON.parse(read(path.join(__dirname, 'before/source-hashes.json')));
const sourceHashes = savedHashes.filter(item => !item.path.startsWith('plans/'));
const changedSource = sourceHashes.filter(item => !fs.existsSync(path.join(root, item.path)) || hash(path.join(root, item.path)) !== item.sha256.toLowerCase()).map(item => item.path);
const supportDocsPreserved = [recordName, specName].every(name => fs.readFileSync(path.join(root, 'plans', name)).equals(fs.readFileSync(path.join(__dirname, 'before', name))));
const beforePlan = fs.readFileSync(path.join(__dirname, 'before', planName));
const currentPlan = fs.readFileSync(planPath);
const begin = Buffer.from('### Phase 0 — execution progress (18 October 2026, Asia/Manila)');
const end = Buffer.from('### Required evidence for each implementation slice');
const beginIndex = currentPlan.indexOf(begin);
const endIndex = currentPlan.indexOf(end, beginIndex);
const planOutsideInsertionPreserved = beginIndex >= 0 && endIndex > beginIndex && Buffer.concat([currentPlan.subarray(0, beginIndex), currentPlan.subarray(endIndex)]).equals(beforePlan);
const diff = spawnSync('git', ['diff', '--no-index', '--', path.join(__dirname, 'before', planName), planPath], { cwd: root, encoding: 'utf8' });
if (diff.status !== 1) throw new Error('Expected a non-empty Phase 0 owned diff: ' + diff.stderr);
const normalizedPath = 'plans/' + planName;
const patch = diff.stdout.replace(/^diff --git .*$/m, 'diff --git a/' + normalizedPath + ' b/' + normalizedPath).replace(/^--- .*$/m, '--- a/' + normalizedPath).replace(/^\+\+\+ .*$/m, '+++ b/' + normalizedPath);
fs.writeFileSync(path.join(__dirname, 'phase-0-owned.patch'), patch);
const reverseCheck = spawnSync('git', ['apply', '--reverse', '--check', path.join(__dirname, 'phase-0-owned.patch')], { cwd: root, encoding: 'utf8' });

writeJson('verification.json', { status: 'checking' });
const markdownFiles = [planPath, path.join(root, 'plans', recordName), path.join(root, 'plans', specName), path.join(__dirname, 'README.md'), path.join(__dirname, 'screen-state-evidence.md'), path.join(__dirname, 'motion-status.md')];
let localLinkCount = 0;
const missingLinks = [];
for (const file of markdownFiles) {
  const pattern = /\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))\)/g;
  for (const match of read(file).matchAll(pattern)) {
    const target = match[1] ?? match[2];
    if (/^(https?:|mailto:|tel:|codex:|#)/i.test(target)) continue;
    const withoutAnchor = decodeURIComponent(target.split('#')[0]);
    const resolved = /^[A-Za-z]:[\\/]/.test(withoutAnchor) ? withoutAnchor : path.resolve(path.dirname(file), withoutAnchor);
    localLinkCount++;
    if (!fs.existsSync(resolved)) missingLinks.push({ file: path.relative(root, file), target });
  }
}
const nativeResults = JSON.parse(read(path.join(__dirname, 'native-results.json')));
const mediaResults = JSON.parse(read(path.join(__dirname, 'media-verification.json')));
const whitespaceCheck = spawnSync('git', ['diff', '--check'], { cwd: root, encoding: 'utf8' });
const verification = { checkedAt: new Date().toISOString(), sourceFilesCompared: sourceHashes.length, changedSource, supportDocsPreserved, planOutsideInsertionPreserved, ownedPatchReverseCheckExit: reverseCheck.status, ownedPatchReverseCheckDiagnostics: reverseCheck.stderr.trim(), diffWhitespaceCheckExit: whitespaceCheck.status, localLinkCount, missingLinks, screenRows: rows.length, motionRows: motionRows.length, capturedFrames: captures.reduce((sum, capture) => sum + capture.frameCount, 0), capturesValid: captures.every(capture => capture.frameCount === 24 && capture.jpegHeadersValid && !capture.actionError), nativeEvidenceAssertions: nativeResults.results.length, nativeEvidencePass: nativeResults.pass, verifiedImages: mediaResults.verifiedImages, imageVerificationPass: mediaResults.pass };
verification.pass = changedSource.length === 0 && supportDocsPreserved && planOutsideInsertionPreserved && reverseCheck.status === 0 && whitespaceCheck.status === 0 && missingLinks.length === 0 && verification.capturesValid && nativeResults.pass && mediaResults.pass;
writeJson('verification.json', verification);

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesUnder(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
const checksums = filesUnder(__dirname).filter(file => path.basename(file) !== 'checksums.sha256').sort().map(file => hash(file) + '  ' + path.relative(__dirname, file).replace(/\\/g, '/')).join('\n');
fs.writeFileSync(path.join(__dirname, 'checksums.sha256'), checksums + '\n');
console.log(JSON.stringify(verification, null, 2));
if (!verification.pass) process.exitCode = 1;
