const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../../..');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const qualification = read('dc-01/qualification.json');
const comparison = read('dc-06/comparison.json');
const retained = read('dc-06/retained-statements.json');
const metrics = read('dc-06/metrics.json');
const tests = read('dc-05/tests.json');
const checks = ['types', 'tests', 'lint', 'android-export-temp', 'web-export-unrestricted'].map(id => ({ id, baseline: read('dc-00/' + id + '-result.json').exitCode, final: read('dc-05/' + id + '-result.json').exitCode }));
const finalTypes = read('dc-06/types-result.json');
const refreshed = ['types', 'tests', 'lint', 'android-export-temp', 'web-export-unrestricted'].map(id => ({ id, exitCode: read('dc-06-refresh/' + id + '-result.json').exitCode }));
const snapshotGate = comparison.checks.find(check => check.name === 'Protected active source/config/backend');
const concurrentSourceChanges = snapshotGate?.detail?.unexpectedActiveInputs ?? [];
const scopedStructuralChecksPass = comparison.checks.filter(check => check !== snapshotGate).every(check => check.passed);
const cleanupInputConflict = concurrentSourceChanges.some(file => file.startsWith('apps/resident-android-mobile/'));
const selectedPlans = ['plans/Resident_Android_Code_and_File_Bloat_Audit_2026_10_14.md', 'plans/Resident_Android_Unused_Code_Deletion_Execution_Plan_2026_10_14.md'];
const native = { status: 'pending manual verification', freshBundleExecuted: false, reason: 'Existing native shell rejected the fresh development-client cold-launch VIEW link: Intent does not match any activities. Verified normal launcher was reopened. No new bundle/flow is counted as passed.', previewTerminated: true, temporaryForwardingRemoved: [8160], appDataReset: false, nativeShellChangedOrInstalled: false, manualSteps: 'REPORT.md pending manual steps; all nine DC-05 journey rows remain unqualified' };
const result = {
  completedAt: new Date().toISOString(),
  sourceImplementation: 'complete',
  overallPhaseAcceptance: 'partially complete solely for required manual runtime baseline/smoke',
  removed: { orphanFileIds: ['O01','O02','O03','O04','O05','O06','O07','O08'], duplicateBoundary: 'F01', runtimeExports: ['U01','U02','U03','U04','U05','U06','U07','U08'], dependentInterface: 'PaymentMethodOption', localStyleKeys: 21, dependentStyle: 'group', newDependencies: [], editedFilesThisRun: qualification.edits.map(item => item.file) },
  checks,
  finalTypeCheckAfterPreview: finalTypes.exitCode,
  refreshedChecksAfterConcurrentSharedChanges: refreshed,
  structuralChecks: { passed: scopedStructuralChecksPass, count: comparison.checks.length - 1, retainedStatementsIdentical: retained.passed, wholeSnapshotGatePassed: snapshotGate?.passed ?? false },
  metrics,
  preservation: { protectedInputs: comparison.protectedFiles, selectedPlanUpdates: selectedPlans, concurrentChangesPreserved: [...comparison.concurrentDocumentation.filter(file => !selectedPlans.includes(file)), ...concurrentSourceChanges], cleanupInputConflict, historicalScriptAndIndexUnchanged: true, backendOrStoredDataMutatedByCleanup: false, rawWholeSnapshotResult: 'flagged external concurrent source/lockfile/documentation changes; preserved without overwrite' },
  native,
  acceptance: [
    { criterion: 'Every deleted item has no active app/backend/test/build/CI consumer', status: 'met' },
    { criterion: 'Exact qualified deletion-only scope and recoverable before-bytes', status: 'met' },
    { criterion: 'Retained code/styles/contracts/routes/assets/config/backend/queues preserved', status: 'met' },
    { criterion: 'Normal type/test/lint/build checks introduce no regression', status: 'met' },
    { criterion: 'All nine fresh-bundle native/mobile-web journey baseline and smoke rows', status: 'pending manual verification' },
    { criterion: 'Exact diff, source/bundle measurements, archival limitation and concurrent changes documented', status: 'met' },
  ],
  phases: { 'DC-00': 'automated baseline complete; journey baseline pending', 'DC-01': 'complete', 'DC-02': 'complete', 'DC-03': 'complete', 'DC-04': 'complete', 'DC-05': 'automated checks complete; full smoke pending', 'DC-06': 'source review/evidence complete; full runtime closure pending' },
  excludedWorkPreserved: ['cancelled Android usability phase', 'route retirement/redirect changes', 'dependency/native/font optimization', 'public hook/prop API cleanup', 'queue deletion', 'generated-output cleanup', 'shared/backend/migrations'],
};
if (!checks.every(check => check.baseline === 0 && check.final === 0) || !refreshed.every(check => check.exitCode === 0) || finalTypes.exitCode !== 0 || !scopedStructuralChecksPass || cleanupInputConflict || !retained.passed) throw new Error('Scoped automated closure gate failed');
fs.writeFileSync(path.join(__dirname, 'dc-06/results.json'), JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'dc-05/native-smoke.json'), JSON.stringify(native, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'dc-06/git-status.txt'), spawnSync('git', ['status', '--porcelain=v1', '-uall'], { cwd: root, encoding: 'utf8' }).stdout);
console.log(JSON.stringify({ sourceImplementation: result.sourceImplementation, automatedChecks: 'pass', removedFiles: 9, unusedRuntimeExports: 8, unusedLocalStyles: 21, dependentStyle: 1, cumulativeSourceBytesRemoved: metrics.source.cumulativeSourceBytesRemoved, manualVerification: native.status }));
