// Export contract v2 (plan P03-T07 section 2, Phase 18). Free of Deno and network imports so the same module is unit-tested.
//
// The export runs under the caller's own session (RLS decides what is readable) and is `complete` only when every required section was
// read to its end. A section that could not be read is reported as failed, never as an empty list, and a failed required section fails
// the whole export so no partial result is ever labelled complete.

export const EXPORT_CONTRACT_VERSION = 2;
export const EXPORT_COOLDOWN_MS = 60_000;
export const PAGE_SIZE = 500;
/** 500 x 200 = 100,000 rows per section; anything larger is reported as failed rather than silently cut. */
export const MAX_PAGES = 200;

type Json = unknown;
export type SectionSpec =
  | { name: string; kind: 'single'; table: string; select: string; ownerColumn: string; label: string }
  | {
    name: string; kind: 'list'; table: string; select: string; ownerColumn: string; label: string;
    /** Filters every row must satisfy besides ownership, e.g. soft-deleted rows are excluded. */
    notDeleted?: boolean;
    /** Stable keyset order: a never-null column and a unique tiebreaker. */
    order: readonly [string, string];
    /** Removes columns that were read only to scope the row, and drops staff identifiers from stored history. */
    shape?: (row: Record<string, Json>) => Record<string, Json>;
  };

type HistoryEntry = { status: string; at: string; note: string | null };
/** Staff identifiers inside the stored history are dropped: only what the resident already sees is exported. */
export function residentHistory(value: Json): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): HistoryEntry[] => {
    if (entry === null || typeof entry !== 'object') return [];
    const record = entry as Record<string, Json>;
    if (typeof record.status !== 'string' || typeof record.at !== 'string') return [];
    return [{ status: record.status, at: record.at, note: typeof record.note === 'string' ? record.note : null }];
  });
}

function without(row: Record<string, Json>, ...keys: string[]): Record<string, Json> {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

const PROFILE_COLUMNS = [
  'id', 'barangay_id', 'full_name', 'first_name', 'middle_name', 'last_name', 'suffix', 'sex', 'birth_date', 'mobile_number', 'email',
  'home_address', 'house_no', 'street', 'city', 'province', 'employment_status', 'occupation', 'avatar_url', 'id_type', 'id_verification_status',
  'email_verification_status', 'email_verified_at', 'location_verified', 'location_verified_at', 'verified_location', 'verified_location_address',
  'household_members', 'theme_preference', 'accent_color', 'custom_accent_colors', 'font_preference', 'push_notifications_enabled',
  'profile_completed_at', 'created_at', 'updated_at', 'last_data_export_at',
].join(',');

const ATTENDANCE_SECTIONS: readonly (SectionSpec & { kind: 'list' })[] = [
  { name: 'household_attendance', kind: 'list', table: 'household_attendance', ownerColumn: 'household_profile_id',
    label: 'Household attendance', order: ['checked_in_at', 'id'],
    select: 'id,household_profile_id,household_member_id,barangay_id,evacuation_center_id,checked_in_at,checked_out_at' },
  { name: 'household_attendance_receipts', kind: 'list', table: 'household_attendance_receipt_exports', ownerColumn: 'household_profile_id',
    label: 'Household attendance confirmations', order: ['created_at', 'id'],
    select: 'id,household_profile_id,request_id,operation,created_at' },
];

/**
 * Required sections of contract v2. Staff identities, token and device secrets, storage paths, provider internals,
 * receipt fingerprints and other residents' data are never selected.
 */
export const REQUIRED_SECTIONS: readonly SectionSpec[] = [
  { name: 'profile', kind: 'single', table: 'profiles', select: PROFILE_COLUMNS, ownerColumn: 'id', label: 'Profile' },
  { name: 'household_members', kind: 'list', table: 'household_members', ownerColumn: 'profile_id', label: 'Household members', notDeleted: true, order: ['created_at', 'id'],
    select: 'id,name,relation,role,sort_order,is_checked_in,checked_in_at,checked_in_center_name,created_at,updated_at' },
  { name: 'service_requests', kind: 'list', table: 'service_requests', ownerColumn: 'resident_id', label: 'Service requests', notDeleted: true, order: ['created_at', 'id'],
    select: 'id,reference_number,status,payment_status,payment_method,created_at,updated_at,accepted_at,ready_at,released_at,cancelled_at,contract_version,timing_model,requester_notes,purpose_label,purpose_explanation,supporting_details,status_history,fee_assessment_state,assessed_amount_centavos,legacy_fee_centavos,fee_basis,billable_pages,requirements_review_state,requirements_review_note,personal_appearance_required,document_types(name)',
    shape: (row) => ({ ...row, status_history: residentHistory(row.status_history) }) },
  { name: 'payments', kind: 'list', table: 'payments', ownerColumn: 'service_requests.resident_id', label: 'Payments', notDeleted: true, order: ['created_at', 'id'],
    select: 'id,service_request_id,method,status,amount_centavos,document_fee_centavos,paid_at,created_at,refund_status,refund_amount_centavos,refunded_at,paymongo_payment_id,service_requests!inner(resident_id)',
    shape: (row) => without(row, 'service_requests') },
  { name: 'request_attachments', kind: 'list', table: 'request_attachments', ownerColumn: 'resident_id', label: 'Request attachments', order: ['created_at', 'id'],
    select: 'id,request_id,requirement_code,mime_type,size_bytes,created_at' },
  { name: 'id_submissions', kind: 'list', table: 'id_submissions', ownerColumn: 'resident_id', label: 'ID submissions', order: ['submitted_at', 'id'],
    select: 'id,version,id_type,evidence_origin,submitted_at,decision,reviewed_at,rejection_reason' },
  { name: 'incident_reports', kind: 'list', table: 'incidents', ownerColumn: 'reporter_id', label: 'Incident reports', notDeleted: true, order: ['created_at', 'id'],
    select: 'id,title,description,status,address,specific_area_details,location,confirmation_count,resolved_read_at,created_at,updated_at,incident_categories(name)' },
  { name: 'incident_corroborations', kind: 'list', table: 'incident_confirmations', ownerColumn: 'user_id', label: 'Report corroborations', order: ['created_at', 'incident_id'],
    select: 'incident_id,created_at' },
  { name: 'announcement_reads', kind: 'list', table: 'announcement_reads', ownerColumn: 'resident_id', label: 'Announcement read state', order: ['read_at', 'announcement_id'],
    select: 'announcement_id,read_at' },
  { name: 'medical_drive_registrations', kind: 'list', table: 'drive_registrations', ownerColumn: 'user_id', label: 'Medical drive registrations', notDeleted: true, order: ['created_at', 'id'],
    select: 'id,drive_id,applicant_number,age,is_pwd,comorbidities,prior_dose_date,status,created_at,updated_at,medical_drives(title,drive_date)' },
  { name: 'evacuation_center_checkins', kind: 'list', table: 'evacuation_center_checkins', ownerColumn: 'user_id', label: 'Evacuation center check-ins', order: ['created_at', 'id'],
    select: 'id,evacuation_center_id,checked_in_at,created_at,evacuation_centers(name)' },
  ...ATTENDANCE_SECTIONS,
  { name: 'notification_preferences', kind: 'single', table: 'notification_preferences', ownerColumn: 'user_id', label: 'Notification preferences', select: 'kinds,updated_at' },
  { name: 'notification_inbox', kind: 'list', table: 'notification_inbox', ownerColumn: 'recipient_id', label: 'Notification inbox', order: ['created_at', 'id'],
    select: 'id,kind,title,body,created_at,read_at' },
  { name: 'registered_devices', kind: 'list', table: 'push_tokens', ownerColumn: 'user_id', label: 'Registered devices', order: ['created_at', 'id'],
    select: 'id,device_type,last_used_at,created_at' },
];

export type SectionResult =
  | { status: 'complete'; label: string; rowCount: number; truncated: false; rows: Json[] }
  | { status: 'failed'; label: string; rowCount: 0; truncated: false; error: string };

export type ExportEnvelope = {
  contractVersion: typeof EXPORT_CONTRACT_VERSION;
  exportedAt: string;
  account: { id: string; email: string | null };
  sections: Record<string, SectionResult>;
};

/** The slice of the PostgREST builder this module uses; the function passes the real client. */
export type Query = PromiseLike<{ data: Json; error: { message?: string } | null }> & {
  eq(column: string, value: string): Query;
  is(column: string, value: null): Query;
  or(filters: string): Query;
  order(column: string, options: { ascending: boolean }): Query;
  limit(count: number): Query;
  maybeSingle(): Query;
};
export type Reader = { from(table: string): { select(columns: string): Query } };

/** Values placed in a PostgREST `or()` list are double-quoted so a comma or parenthesis can never change the filter. */
function quoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function readSingle(reader: Reader, spec: SectionSpec & { kind: 'single' }, userId: string): Promise<SectionResult> {
  const { data, error } = await reader.from(spec.table).select(spec.select).eq(spec.ownerColumn, userId).maybeSingle();
  if (error) return failed(spec, 'The section could not be read.');
  return { status: 'complete', label: spec.label, rowCount: data ? 1 : 0, truncated: false, rows: data ? [data] : [] };
}

export type Limits = { pageSize: number; maxPages: number };
const DEFAULT_LIMITS: Limits = { pageSize: PAGE_SIZE, maxPages: MAX_PAGES };

/** The v1 envelope uses the same bounded, owner-filtered attendance reads as v2. */
export async function readHouseholdAttendanceExport(reader: Reader, userId: string, limits: Limits = DEFAULT_LIMITS): Promise<Record<string, SectionResult>> {
  const sections: Record<string, SectionResult> = {};
  for (const spec of ATTENDANCE_SECTIONS) {
    try { sections[spec.name] = await readList(reader, spec, userId, limits); }
    catch { sections[spec.name] = failed(spec, 'The section could not be read.'); }
  }
  return sections;
}

async function readList(reader: Reader, spec: SectionSpec & { kind: 'list' }, userId: string, limits: Limits): Promise<SectionResult> {
  const [primary, tiebreak] = spec.order;
  const rows: Json[] = [];
  let cursor: [string, string] | null = null;
  for (let page = 0; page < limits.maxPages; page += 1) {
    let query: Query = reader.from(spec.table).select(spec.select).eq(spec.ownerColumn, userId);
    if (spec.notDeleted) query = query.is('deleted_at', null);
    if (cursor) query = query.or(`${primary}.gt.${quoted(cursor[0])},and(${primary}.eq.${quoted(cursor[0])},${tiebreak}.gt.${quoted(cursor[1])})`);
    const { data, error } = await query.order(primary, { ascending: true }).order(tiebreak, { ascending: true }).limit(limits.pageSize);
    if (error || !Array.isArray(data)) return failed(spec, 'The section could not be read.');
    const batch = data as Record<string, Json>[];
    for (const row of batch) rows.push(spec.shape ? spec.shape(row) : row);
    if (batch.length < limits.pageSize) return { status: 'complete', label: spec.label, rowCount: rows.length, truncated: false, rows };
    const last = batch[batch.length - 1];
    const next: Json[] = [last[primary], last[tiebreak]];
    if (typeof next[0] !== 'string' || typeof next[1] !== 'string') return failed(spec, 'The section could not be read to its end.');
    cursor = [next[0], next[1]];
  }
  return failed(spec, 'The section is too large to export in one file.');
}

function failed(spec: SectionSpec, error: string): SectionResult {
  return { status: 'failed', label: spec.label, rowCount: 0, truncated: false, error };
}

export type ExportOutcome =
  | { complete: true; envelope: ExportEnvelope }
  | { complete: false; failedSections: string[]; sections: Record<string, SectionResult> };

/** Reads every required section. Sections run one after another so one export is at most a few concurrent requests. */
export async function buildExport(reader: Reader, user: { id: string; email: string | null }, now: Date, limits: Limits = DEFAULT_LIMITS): Promise<ExportOutcome> {
  const sections: Record<string, SectionResult> = {};
  for (const spec of REQUIRED_SECTIONS) {
    try {
      sections[spec.name] = spec.kind === 'single' ? await readSingle(reader, spec, user.id) : await readList(reader, spec, user.id, limits);
    } catch {
      sections[spec.name] = failed(spec, 'The section could not be read.');
    }
  }
  const failedSections = Object.entries(sections).filter(([, section]) => section.status !== 'complete').map(([name]) => name);
  if (failedSections.length > 0) return { complete: false, failedSections, sections };
  return { complete: true, envelope: { contractVersion: EXPORT_CONTRACT_VERSION, exportedAt: now.toISOString(), account: { id: user.id, email: user.email }, sections } };
}

/** Seconds a resident must still wait, or 0. A timestamp in the future (clock drift) never locks the account for long. */
export function cooldownSeconds(lastExportAt: string | null | undefined, now: Date): number {
  if (!lastExportAt) return 0;
  const elapsed = now.getTime() - new Date(lastExportAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= EXPORT_COOLDOWN_MS) return 0;
  return Math.ceil((EXPORT_COOLDOWN_MS - elapsed) / 1000);
}
