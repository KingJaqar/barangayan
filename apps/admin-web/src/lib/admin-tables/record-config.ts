import { DRIVE_TYPES, DRIVE_TYPE_CONFIG, OFFICIAL_ROLES, OFFICIAL_ROLE_LABELS, EMPLOYMENT_STATUSES, EMAIL_REGEX, MOBILE_NUMBER_REGEX } from '@barangayan/shared';
import type { TableName } from './table-configs';
import { REQUEST_PAYMENT_METHOD_OPTIONS, REQUEST_PAYMENT_STATUS_OPTIONS } from '../request-payment-fields';
import { requestStatusOptions } from '../request-edit-fields';

export type RecordData = { id: string; updated_at?: string; deleted_at?: string | null } & Record<string, unknown>;
export type RecordField = { key: string; label: string; type?: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'datetime' | 'coordinates' | 'boolean' | 'list' | 'select';
  required?: boolean; readOnly?: boolean; min?: number; max?: number; options?: readonly { value: string; label: string }[]; source?: 'profile'; lookup?: 'residents' | 'documents' | 'admins' | 'categories' };
const text = (key: string, label: string, required = false): RecordField => ({ key, label, required });
const select = (key: string, label: string, values: string[]): RecordField => ({ key, label, type: 'select', required: true,
  options: values.map(value => ({ value, label: value.replaceAll('_', ' ') })) });

export const RECORD_CONFIG: Record<TableName, { label: string; path: string; entity: 'service_request' | 'payment' | 'resident' | 'incident' | 'medical_drive' | 'drive_registration' | 'household' | 'staff'; fields: RecordField[] }> = {
  requests: { label: 'Requests', path: '/requests', entity: 'service_request', fields: [
    text('reference_number', 'Reference', true),
    { key: 'resident_id', label: 'Resident', type: 'select', required: true, lookup: 'residents' },
    { key: 'document_type_id', label: 'Document type', type: 'select', required: true, lookup: 'documents' },
    select('status', 'Status', ['submitted', 'in_progress', 'ready_for_pickup', 'completed', 'cancelled']),
    { key: 'requester_notes', label: 'Notes', type: 'textarea' },
    { key: 'payment_method', label: 'Payment method', type: 'select', required: true, options: REQUEST_PAYMENT_METHOD_OPTIONS },
    { key: 'payment_status', label: 'Payment status', type: 'select', required: true, options: REQUEST_PAYMENT_STATUS_OPTIONS },
    { key: 'created_at', label: 'Submitted on', type: 'datetime', required: true },
  ] },
  transactions: { label: 'Transactions', path: '/transactions', entity: 'payment', fields: [
    { key: 'created_at', label: 'Date created', type: 'datetime', required: true },
    text('request_reference', 'Request reference', true),
    { key: 'linked_resident_id', label: 'Resident', type: 'select', required: true, lookup: 'residents' },
    { key: 'linked_document_type_id', label: 'Document type', type: 'select', required: true, lookup: 'documents' },
    { key: 'amount_centavos', label: 'Amount (centavos)', type: 'number', min: 0, required: true },
    select('method', 'Payment method', ['pickup', 'qrph']),
    select('status', 'Status', ['pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded']), text('paymongo_source_id', 'Payment source'),
    { key: 'collected_by', label: 'Collected by', type: 'select', lookup: 'admins' },
  ] },
  residents: { label: 'Resident Directory', path: '/residents', entity: 'resident', fields: [
    text('first_name', 'First name', true), text('last_name', 'Last name', true), text('middle_name', 'Middle name'), text('suffix', 'Suffix'),
    { ...select('sex', 'Sex', ['male', 'female']), required: false }, text('email', 'Email'), text('mobile_number', 'Mobile number'),
    { key: 'birth_date', label: 'Birth date', type: 'date' }, text('house_no', 'House number'), text('street', 'Street'), text('city', 'City'),
    { key: 'employment_status', label: 'Employment status', type: 'select', options: EMPLOYMENT_STATUSES.map(value => ({ value, label: value.replaceAll('_', ' ') })) }, text('occupation', 'Occupation'),
  ] },
  incidents: { label: 'Incident Reports', path: '/incident-reports', entity: 'incident', fields: [
    text('title', 'Title', true), { key: 'description', label: 'Description', type: 'textarea' }, text('address', 'Address'),
    { key: 'category_id', label: 'Category', type: 'select', lookup: 'categories' },
    { key: 'reporter_id', label: 'Reporter', type: 'select', lookup: 'residents' },
    { key: 'location', label: 'Coordinates (latitude, longitude)', type: 'coordinates', required: true },
    { key: 'confirmation_count', label: 'Resident confirmations', type: 'number', min: 0, required: true },
    { key: 'created_at', label: 'Submitted on', type: 'datetime', required: true },
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
    { key: 'is_checked_in', label: 'Checked in', type: 'boolean' },
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
  if (field.source === 'profile') return ((row.profile ?? row.profiles) as Record<string, unknown> | undefined)?.[field.key];
  const request = row.service_requests as Record<string, unknown> | undefined;
  if (field.key === 'request_reference') return request?.reference_number;
  if (field.key === 'linked_resident_id') return request?.resident_id;
  if (field.key === 'linked_document_type_id') return request?.document_type_id;
  return row[field.key];
}
export function recordFields(name: TableName, row: RecordData): RecordField[] {
  if (name === 'requests' && row.contract_version === 2) return [
    ...RECORD_CONFIG.requests.fields.map(field => field.key === 'resident_id' || field.key === 'document_type_id' ? { ...field, readOnly: true }
      : field.key === 'status' ? { ...field, options: requestStatusOptions(row) } : field),
    { key: 'status_change_reason', label: 'Status change reason', type: 'textarea' },
  ];
  if (name === 'transactions' && row.status !== 'pending') return RECORD_CONFIG.transactions.fields.filter(field => field.key !== 'amount_centavos');
  return RECORD_CONFIG[name].fields;
}
export function editableFields(name: TableName, row: RecordData): RecordField[] {
  return recordFields(name, row).filter(field => !field.readOnly);
}
export function recordDraft(name: TableName, row: RecordData): Record<string, unknown> {
  return Object.fromEntries(editableFields(name, row).map(field => {
    const value = fieldValue(row, field);
    return [field.key, field.type === 'coordinates' && value && typeof value === 'object'
      ? `${(value as { lat: number }).lat}, ${(value as { lng: number }).lng}`
      : value ?? (field.type === 'boolean' ? false : field.type === 'list' ? [] : '')];
  }));
}
export function changedRecordDraft(name: TableName, row: RecordData, draft: Record<string, unknown>) {
  const initial = recordDraft(name, row);
  return Object.fromEntries(Object.entries(draft).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(initial[key])));
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
    if (field.type === 'coordinates') {
      {
        const parts = typeof raw === 'string' ? raw.split(',').map(part => part.trim()) : [];
        const point = typeof raw === 'object' && raw !== null ? raw as { lat?: unknown; lng?: unknown }
          : parts.length === 2 && parts.every(Boolean) ? { lat: Number(parts[0]), lng: Number(parts[1]) } : null;
        if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number' || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)
          || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) throw new Error('Enter coordinates as latitude, longitude within valid ranges.');
        value = { lat: point.lat, lng: point.lng };
      }
    } else if (field.type === 'boolean') {
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
      if (value && field.lookup && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value))) throw new Error(`Select a valid ${field.label.toLowerCase()}.`);
      if (value && field.type === 'select' && !field.lookup && !field.options?.some(option => option.value === value)) throw new Error(`Select a valid ${field.label.toLowerCase()}.`);
      if (value && field.type === 'datetime' && Number.isNaN(Date.parse(String(value)))) throw new Error(`Enter a valid ${field.label.toLowerCase()}.`);
      if (value && field.type === 'date' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error(`Enter a valid ${field.label.toLowerCase()}.`);
      if (value && field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(value))) throw new Error(`Enter a valid ${field.label.toLowerCase()}.`);
      if (value === '') value = null;
    }
    patch[key] = value;
  }
  if (!Object.keys(patch).length) throw new Error('There are no editable changes to save.');
  const next = { ...row, ...patch };
  if (name === 'requests' && row.contract_version === 2 && patch.status === 'cancelled' && row.status !== 'cancelled' && !String(patch.status_change_reason ?? '').trim())
    throw new Error('Enter a reason for cancelling the request.');
  if (patch.email && !EMAIL_REGEX.test(String(patch.email))) throw new Error('Enter a valid email address.');
  if (patch.mobile_number && !MOBILE_NUMBER_REGEX.test(String(patch.mobile_number))) throw new Error('Enter an 11-digit mobile number starting with 09.');
  if (name === 'health' && Number(next.stock_remaining) > Number(next.stock_total)) throw new Error('Remaining stock cannot exceed total stock.');
  if (name === 'health' && String(next.time_end) <= String(next.time_start)) throw new Error('End time must be after start time.');
  if (name === 'residents' && next.birth_date && String(next.birth_date) > new Date().toISOString().slice(0, 10)) throw new Error('Birth date cannot be in the future.');
  return patch;
}
