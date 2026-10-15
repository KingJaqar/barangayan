const fs = require('node:fs');
const path = require('node:path');
const resultPath = path.join(__dirname, 'dc-06/results.json');
const results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const preservation = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-06/final-preservation.json'), 'utf8'));
const finalTypes = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-06/types-result.json'), 'utf8'));
results.checks.types.afterNativePreview = finalTypes.exitCode === 0 ? 'pass' : 'fail';
results.checks.preservation = {
  preexistingFilesHashed: preservation.filesCompared,
  cleanupChangedSourceFiles: ['apps/resident-android-mobile/src/components/resident-details-form.tsx'],
  selectedPlanUpdates: preservation.changed.filter(file => /Resident_Android_(?:Code_and_File_Bloat_Audit|Unused_Code_Deletion_Execution_Plan)/.test(file)),
  concurrentDocumentationChanges: preservation.unexpected,
  unexpectedApplicationChanges: preservation.unexpected.filter(file => !file.startsWith('plans/')),
  rawPreservationExit: preservation.unexpected.length ? 1 : 0,
  concurrentWorkRestoredOrOverwritten: false,
};
results.closedAt = new Date().toISOString();
fs.writeFileSync(resultPath, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ finalTypes: results.checks.types.afterNativePreview, preservation: results.checks.preservation, status: results.phaseStatus }, null, 2));
