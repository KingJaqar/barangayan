import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { gzipSync, gunzipSync } from 'node:zlib';

const root = path.resolve(import.meta.dirname, '../../../..');
const evidence = path.join(root, 'plans/evidence/admin-dropdown-ui');
const raw = path.join(evidence, 'source-baseline.json');
const compressed = `${raw}.gz`;
const baseline = JSON.parse(fs.existsSync(raw) ? fs.readFileSync(raw, 'utf8') : gunzipSync(fs.readFileSync(compressed)).toString());
const inventory = JSON.parse(fs.readFileSync(path.join(evidence, 'inventory-before.json'), 'utf8'));
assert.equal(inventory.reduce((sum, item) => sum + item.count, 0), 58);
const after = inventory.map(item => {
  const source = fs.readFileSync(path.join(root, item.file), 'utf8');
  assert.equal((source.match(/<AdminSelect\b/g) ?? []).length, item.count, item.file);
  assert.equal((source.match(/<select\b/g) ?? []).length, 0, item.file);
  return { ...item, status: item.classification === 'unreferenced' ? 'migrated; isolated fixture only; still unreferenced in production' : 'migrated' };
});
const sharedFiles = fs.readdirSync(path.join(root, 'apps/admin-web/src/components/admin/dropdown')).map(file => `apps/admin-web/src/components/admin/dropdown/${file}`);
const extra = new Set(['apps/admin-web/src/components/admin/content-create-panel.tsx', 'apps/admin-web/src/components/admin/header.tsx',
  'apps/admin-web/src/components/admin/row-context-menu.tsx', 'apps/admin-web/src/components/admin/date-range-picker.tsx',
  'apps/admin-web/src/components/admin/search/navbar-search.tsx', 'apps/admin-web/src/components/admin/search/search.module.css']);
const allowed = new Set([...inventory.map(item => item.file), ...extra]);
const changed = Object.keys(baseline).filter(file => fs.readFileSync(path.join(root, file), 'utf8') !== baseline[file]);
for (const file of changed) assert.ok(allowed.has(file), `Unexpected source edit: ${file}`);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-dropdown-audit-'));
let patch = '';
for (const file of changed) {
  const original = path.join(temporary, path.basename(file));
  fs.writeFileSync(original, baseline[file]);
  const diff = spawnSync('git', ['diff', '--no-index', '--', original, path.join(root, file)], { encoding: 'utf8', windowsHide: true });
  assert.ok(diff.status === 1 || diff.status === 0, diff.stderr);
  patch += diff.stdout;
}
fs.writeFileSync(path.join(evidence, 'task-source-diff.patch'), patch);
for (const file of fs.readdirSync(temporary)) fs.unlinkSync(path.join(temporary, file));
fs.rmdirSync(temporary);
fs.writeFileSync(path.join(evidence, 'inventory-after.json'), JSON.stringify(after, null, 2));
fs.writeFileSync(path.join(evidence, 'source-audit.json'), JSON.stringify({ originalSelectDeclarations: 58, migratedSelectDeclarations: 58,
  backingOnly: 'apps/admin-web/src/components/admin/dropdown/admin-select.tsx', transactionDatalist: 'replaced with editable suggestions', changedExistingSourceFiles: changed, newSharedSourceFiles: sharedFiles,
  unexpectedExistingSourceEdits: [], notes: ['Compare against session snapshot, not Git HEAD; unrelated pre-existing edits are preserved.', 'Changed-line UI/data boundary review is documented in verification.md.'] }, null, 2));
if (fs.existsSync(raw)) { fs.writeFileSync(compressed, gzipSync(fs.readFileSync(raw))); fs.unlinkSync(raw); }
console.log(`${after.length} source files, 58 migrated declarations; ${changed.length} existing source files changed; zero unexpected source edits`);
