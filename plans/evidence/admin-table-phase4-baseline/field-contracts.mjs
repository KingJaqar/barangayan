// Schema-linked field audit, not query implementation or an API capability test.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir = import.meta.dirname;
const root = path.resolve(dir, '../../..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const historical = read(path.join(root, 'plans/evidence/admin-table-phase0/hosted-schema.json'));
const localPath = path.join(dir, 'local-schema.json');
const catalogs = { historicalHosted: historical, currentHosted: read(path.join(dir, 'hosted-schema.json')), ...(fs.existsSync(localPath) ? { currentLocal: read(localPath) } : {}) };
const required = {
  service_requests: ['id', 'reference_number', 'resident_id', 'document_type_id', 'status', 'payment_status', 'created_at', 'updated_at', 'deleted_at', 'contract_version'],
  payments: ['id', 'service_request_id', 'collected_by', 'method', 'status', 'amount_centavos', 'created_at', 'updated_at', 'paid_at', 'refunded_at', 'deleted_at'],
  profiles: ['id', 'full_name', 'first_name', 'last_name', 'email', 'email_verification_status', 'id_verification_status', 'created_at', 'updated_at', 'id_photo_urls', 'household_members', 'role', 'barangay_id', 'deleted_at'],
  incidents: ['id', 'title', 'category_id', 'reporter_id', 'status', 'confirmation_count', 'created_at', 'updated_at', 'deleted_at'],
  incident_categories: ['id', 'name'],
  medical_drives: ['id', 'title', 'type', 'drive_date', 'is_active', 'stock_remaining', 'created_at', 'updated_at', 'deleted_at', 'barangay_id'],
  drive_registrations: ['id', 'applicant_number', 'user_id', 'drive_id', 'status', 'age', 'is_pwd', 'comorbidities', 'created_at', 'updated_at'],
  drive_registration_scores: ['registration_id', 'priority_score'],
  household_members: ['id', 'profile_id', 'name', 'relation', 'role', 'is_checked_in', 'checked_in_center_name', 'checked_in_at', 'created_at', 'updated_at'],
  barangay_officials: ['id', 'profile_id', 'official_role', 'date_hired', 'created_at', 'updated_at', 'deleted_at'],
};
const fields = [];
for (const [catalogName, catalog] of Object.entries(catalogs)) {
  for (const [table, names] of Object.entries(required)) for (const name of names) {
    const definition = catalog.columns.find(column => column.table_name === table && column.column_name === name);
    assert.ok(definition, `${catalogName}: missing ${table}.${name}`);
    fields.push({ catalog: catalogName, ...definition });
  }
  for (const [table, absent] of [['service_requests', 'submitted_at'], ['incidents', 'submitted_at'], ['drive_registrations', 'registered_at'], ['drive_registrations', 'priority_score'], ['drive_registrations', 'deleted_at'], ['household_members', 'deleted_at']]) {
    assert.ok(!catalog.columns.some(column => column.table_name === table && column.column_name === absent), `${catalogName}: unexpected ${table}.${absent}`);
  }
  for (const table of ['service_requests', 'incidents', 'payments', 'medical_drives', 'drive_registrations', 'profiles', 'household_members']) {
    const field = catalog.columns.find(column => column.table_name === table && column.column_name === 'created_at');
    assert.equal(field.data_type, 'timestamp with time zone'); assert.equal(field.is_nullable, 'NO');
  }
}
const inventory = read(path.join(dir, 'source-inventory.json'));
const oldInventory = read(path.join(root, 'plans/evidence/admin-table-phase0/source-inventory.json'));
assert.deepEqual(inventory, oldInventory, 'Current source locations/active expressions must match retained contracts');
const screens = ['requests', 'transactions', 'residents', 'incident-reports', 'health', 'health/applicants', 'households-residents', 'staff'];
const clients = ['requests-table', 'transactions-table', 'resident-directory', 'incident-table', 'drive-table', 'applicants-table', 'households-table', 'staff-table'];
const tables = screens.map((screen, index) => {
  const prefix = `apps/admin-web/src/app/(admin)/${screen}/`;
  const page = inventory.find(item => item.file === prefix + 'page.tsx');
  const client = inventory.find(item => item.file === prefix + clients[index] + '.tsx');
  const activeTables = client.items.filter(item => item.kind === 'active-jsx' && item.text.startsWith('<EditableDataTable'));
  assert.equal(activeTables.length, 1, screen);
  return { screen, page: page.file, client: client.file, columns: client.items.filter(item => item.kind === 'column'), queryAndFilterLocations: page.items, behaviorAndSubscriptionLocations: client.items.filter(item => ['behavior', 'channel', 'on', 'subscribe', 'removeChannel', 'state-contract'].includes(item.kind)), table: activeTables[0] };
});
const result = { checkedAt: new Date().toISOString(), verifiedFieldDefinitions: fields.length, catalogs: Object.keys(catalogs), fields, tables, historicalCatalogBoundary: 'historicalHosted is retained; currentHosted and currentLocal are fresh metadata reads. These do not establish authenticated hosted acceptance. Derived sort keys, global filters and future adapters are proposals, not implemented.' };
fs.writeFileSync(path.join(dir, 'field-contracts.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`Verified ${fields.length} schema field definitions and ${tables.length} active tables; AST index matches prior source contracts.`);
