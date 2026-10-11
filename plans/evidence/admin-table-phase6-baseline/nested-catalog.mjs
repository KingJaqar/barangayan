// Single bounded metadata read, no service creation, row reads or mutations.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_barangayan', 'psql',
  '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], {
  input: fs.readFileSync(new URL('./nested-catalog.sql', import.meta.url), 'utf8'),
  encoding: 'utf8', timeout: 15000, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
});
fs.writeFileSync(new URL('./nested-catalog.log', import.meta.url), (result.stdout ?? '') + (result.stderr ?? ''));
assert.equal(result.status, 0, result.stderr || result.error?.message);
const catalog = JSON.parse(result.stdout.trim());
for (const table of ['document_types','id_submissions','request_attachments','admin_audit_log']) {
  assert.ok(catalog.columns.some(column => column.table_name === table), table);
}
assert.ok(catalog.columns.some(column => column.table_name === 'id_submissions' && column.column_name === 'submitted_at'));
fs.writeFileSync(new URL('./nested-catalog.json', import.meta.url), JSON.stringify({
  checkedAt: new Date().toISOString(), boundary: 'Fresh local metadata only; no RPC execution or current hosted comparison.', ...catalog,
}, null, 2) + '\n');
console.log(JSON.stringify({ columns: catalog.columns.length, policies: catalog.policies.length,
  functions: catalog.functions.length, publications: catalog.publications.length, status: 0 }));
