// Applies only the already prepared, type-checked deletion-only source batch.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../../..');
const app = path.resolve(root, 'apps/resident-android-mobile');
const qualification = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-01/qualification.json'), 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
for (const check of ['types', 'tests', 'lint', 'android-export-temp', 'web-export-unrestricted']) {
  const result = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-00', check + '-result.json'), 'utf8'));
  if (result.exitCode !== 0) throw new Error('Baseline check not passed: ' + check);
}
const targets = [...qualification.edits, ...qualification.orphanFiles];
for (const item of targets) {
  const target = path.resolve(root, item.file);
  if (!target.startsWith(app + path.sep) || target.includes(path.sep + 'src' + path.sep + 'app' + path.sep) && !qualification.edits.some(edit => edit.file === item.file)) throw new Error('Unexpected target');
  if (sha(fs.readFileSync(target)) !== item.beforeSha256) throw new Error('Source drift before batch: ' + item.file);
  if (sha(fs.readFileSync(path.join(__dirname, 'dc-00/before', item.file))) !== item.beforeSha256) throw new Error('Rollback bytes missing');
}
for (const item of qualification.edits) {
  const proposed = fs.readFileSync(path.join(__dirname, 'dc-01/proposed', item.file));
  if (sha(proposed) !== item.afterSha256) throw new Error('Proposed source drift');
}
for (const item of qualification.edits) fs.copyFileSync(path.join(__dirname, 'dc-01/proposed', item.file), path.join(root, item.file));
// Literal individual qualified paths, each validated above; no recursive deletion.
for (const item of qualification.orphanFiles) fs.unlinkSync(path.resolve(root, item.file));
const output = path.join(__dirname, 'dc-04');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'source-removals.json'), JSON.stringify({ appliedAt: new Date().toISOString(), edits: qualification.edits, orphanFiles: qualification.orphanFiles, boundary: 'Not deleted by this batch; separately verified duplicate and literal-path removal required' }, null, 2) + '\n');
console.log(JSON.stringify({ editedFiles: qualification.edits.length, orphanFilesRemoved: qualification.orphanFiles.length, sourceBytesRemoved: qualification.edits.reduce((sum, item) => sum + item.sourceBytesRemoved, 0) + qualification.orphanFiles.reduce((sum, item) => sum + item.bytes, 0) }));
