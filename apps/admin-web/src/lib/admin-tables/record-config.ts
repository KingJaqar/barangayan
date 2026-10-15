import { DRIVE_TYPES, DRIVE_TYPE_CONFIG, OFFICIAL_ROLES, OFFICIAL_ROLE_LABELS, EMPLOYMENT_STATUSES, EMAIL_REGEX, MOBILE_NUMBER_REGEX } from '@barangayan/shared';
import type { TableName } from './table-configs';

export type RecordData = { id: string; updated_at?: string; deleted_at?: string | null } & Record<string, unknown>;
export type RecordField = { key: string; label: string; type?: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'boolean' | 'list' | 'select';
  required?: boolean; min?: number; max?: number; options?: readonly { value: string; label: string }[]; source?: 'profile' };
const text = (key: string, label: string, required = false): RecordField => ({ key, label, required });
const select = (key: string, label: string, values: string[]): RecordField => ({ key, label, type: 'select', required: true,
  options: values.map(value => ({ value, label: value.replaceAll('_', ' ') })) });

export const RECORD_CONFIG: Record<TableName, { label: string; path: string; entity: 'service_request' | 'payment' | 'resident' | 'incident' | 'medical_drive' | 'drive_registration' | 'household' | 'staff'; fields: RecordField[] }> = {
  requests: { label: 'Requests', path: '/requests', entity: 'service_request', fields: [
    select('status', 'Status', ['submitted', 'in_progress', 'ready_for_pickup', 'completed', 'cancelled']),
    { key: 'requester_notes', label: 'Notes', type: 'textarea' },
    select('payment_status', 'Payment status', ['pending', 'paid', 'waived']), select('payment_method', 'Payment method', ['pickup', 'qrph']),
  ] },
  transactions: { label: 'Transactions', path: '/transactions', entity: 'payment', fields: [
    { key: 'amount_centavos', label: 'Amount (centavos)', type: 'number', min: 0, required: true },
    select('method', 'Payment method', ['pickup', 'qrph']),
    select('status', 'Status', ['pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded']), text('paymongo_source_id', 'Payment source'),
  ] },
  residents: { label: 'Resident Directory', path: '/residents', entity: 'resident', fields: [
    text('first_name', 'First name', true), text('last_name', 'Last name', true), text('middle_name', 'Middle name'), text('suffix', 'Suffix'),
    select('sex', 'Sex', ['male', 'female']), text('email', 'Email'), text('mobile_number', 'Mobile number'),
    { key: 'birth_date', label: 'Birth date', type: 'date' }, text('house_no', 'House number'), text('street', 'Street'), text('city', 'City'),
    { key: 'employment_status', label: 'Employment status', type: 'select', options: EMPLOYMENT_STATUSES.map(value => ({ value, label: value.replaceAll('_', ' ') })) }, text('occupation', 'Occupation'),
  ] },
  incidents: { label: 'Incident Reports', path: '/incident-reports', entity: 'incident', fields: [
    text('title', 'Title', true), { key: 'description', label: 'Description', type: 'textarea' }, text('address', 'Address'),
    { key: 'specific_area_details', label: 'Specific area details', type: 'textarea' },
    select('status', 'Status', ['open', 'in_progress', 'resolved', 'withdrawn', 'unresolved']),
  ] },
  health: { label: 'Health', path: '/health', entity: 'medical_drive', fields: [
    text('title', 'Title', true), { key: 'type', label: 'Category', type: 'select', required: true,
      options: DRIVE_TYPES.map(value => ({ value, label: DRIVE_TYPE_CONFIG[value].label })) },
    { key: 'drive_date', label: 'Drive date', type: 'date', required: true }, text('location', 'Location', true),
    { key: 'time_start', label: 'Start time', type: 'time', required: true }, { key: 'time_end', label: 'End time', type: 'time', required: true },
    { key: 'eligible_criteria', label: 'Eligibility criteria', type: 'textarea', required: true }, text('stock_label', 'Stock label', true), text('stock_unit', 'Stock unit', true),
    { key: 'stock_total', label: 'Total stock', type: 'number', min: 1, required: true },
    { key: 'stock_remaining', label: 'Remaining stock', type: 'number', min: 0, required: true }, { key: 'is_active', label: 'Active', type: 'boolean' },
  ] },
  applicants: { label: 'Medical Applicants', path: '/health/applicants', entity: 'drive_registration', fields: [
    { key: 'age', label: 'Age', type: 'number', min: 0, max: 130, required: true }, { key: 'is_pwd', label: 'Person with disability', type: 'boolean' },
    { key: 'comorbidities', label: 'Comorbidities (comma separated)', type: 'list' }, { key: 'prior_dose_date', label: 'Prior dose date', type: 'date' },
    select('status', 'Status', ['pending', 'confirmed', 'attended', 'cancelled']),
  ] },
  households: { label: 'Households & Residents', path: '/households-residents', entity: 'household', fields: [
    text('name', 'Name', true), select('relation', 'Relation', ['spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other']),
    select('role', 'Member role', ['member', 'head', 'spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other']),
  ] },
  staff: { label: 'Staff Members', path: '/staff', entity: 'staff', fields: [
    { ...text('full_name', 'Full name', true), source: 'profile' }, { ...text('mobile_number', 'Mobile number'), source: 'profile' },
    { ...text('home_address', 'Address'), source: 'profile' },
    { key: 'official_role', label: 'Official role', type: 'select', required: true,
      options: OFFICIAL_ROLES.map(value => ({ value, label: OFFICIAL_ROLE_LABELS[value] })) },
    { key: 'date_hired', label: 'Hire date', type: 'date' }, { key: 'is_active', label: 'Active', type: 'boolean' },
  ] },
};

export function fieldValue(row: RecordData, field: RecordField) {
  return field.source === 'profile' ? (row.profile as Record<string, unknown> | undefined)?.[field.key] : row[field.key];
}
export function editableFields(name: TableName, row: RecordData): RecordField[] {
  // Version 2 requests use the existing assessment/review workflow; paid amounts are ledger snapshots.
  if (name === 'requests' && row.contract_version === 2) return RECORD_CONFIG.requests.fields.filter(field => field.key === 'payment_method');
  if (name === 'transactions' && row.status !== 'pending') return RECORD_CONFIG.transactions.fields.filter(field => field.key !== 'amount_centavos');
  return RECORD_CONFIG[name].fields;
}
export function recordLabel(row: RecordData): string {
  const profile = (row.profile ?? row.profiles) as Record<string, unknown> | undefined;
  const request = row.service_requests as Record<string, unknown> | undefined;
  return String(row.title ?? row.full_name ?? row.name ?? row.applicant_number ?? row.reference_number ?? profile?.full_name ?? request?.reference_number ?? row.id);
}

/** Shared by the form and server boundary. Unknown fields are rejected, never passed through. */
export function validateRecordPatch(name: TableName, row: RecordData, input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Enter valid changes.');
  const fields = editableFields(name, row);
  const patch: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    const field = fields.find(item => item.key === key);
    if (!field) throw new Error('This field cannot be edited here.');
    let value = raw;
    if (field.type === 'boolean') {
      if (typeof raw !== 'boolean') throw new Error(`${field.label} must be Yes or No.`);
    } else if (field.type === 'number') {
      if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < (field.min ?? 0) || raw > (field.max ?? Number.MAX_SAFE_INTEGER))
        throw new Error(`Enter a valid ${field.label.toLowerCase()}${field.max ? ` between ${field.min ?? 0} and ${field.max}` : ''}.`);
    } else if (field.type === 'list') {
      if (!Array.isArray(raw) || raw.length > 50 || raw.some(item => typeof item !== 'string' || item.length > 200)) throw new Error('Enter a valid list of comorbidities.');
      value = raw.map(item => item.trim()).filter(Boolean);
    } else {
      if (raw !== null && typeof raw !== 'string') throw new Error(`${field.label} must be text.`);
      value = typeof raw === 'string' ? raw.trim() : null;
      if (!value && field.required) throw new Error(`${field.label} is required.`);
      if (typeof value === 'string' && value.length > 10000) throw new Error(`${field.label} is too long.`);
      if (value && field.type === 'select' && !field.options?.some(option => option.value === value)) throw new Error(`Select a valid ${field.label.toLowerCase()}.`);
      if (value && field.type === 'date' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error(`Enter a valid ${field.label.toLowerCase()}.`);
      if (value && field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(value))) throw new Error(`Enter a valid ${field.label.toLowerCase()}.`);
      if (value === '') value = null;
    }
    patch[key] = value;
  }
  if (!Object.keys(patch).length) throw new Error('There are no editable changes to save.');
  const next = { ...row, ...patch };
  if (patch.email && !EMAIL_REGEX.test(String(patch.email))) throw new Error('Enter a valid email address.');
  if (patch.mobile_number && !MOBILE_NUMBER_REGEX.test(String(patch.mobile_number))) throw new Error('Enter an 11-digit mobile number starting with 09.');
  if (name === 'health' && Number(next.stock_remaining) > Number(next.stock_total)) throw new Error('Remaining stock cannot exceed total stock.');
  if (name === 'health' && String(next.time_end) <= String(next.time_start)) throw new Error('End time must be after start time.');
  if (name === 'residents' && next.birth_date && String(next.birth_date) > new Date().toISOString().slice(0, 10)) throw new Error('Birth date cannot be in the future.');
  return patch;
}
