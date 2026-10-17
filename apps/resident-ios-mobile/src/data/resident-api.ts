import { ANNOUNCEMENT_CATEGORIES, DRIVE_TYPE_CONFIG, DRIVE_TYPES, driveRegistrationSchema, residentDriveRegistrationResultSchema, type Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { checkWrite, containsPattern, parseCount, parseMaybeRow, parseRow, parseRows, quoteFilterValue } from './boundary';
import { DataError, toDataError } from './outcome';
import { readAll, type PageRead } from './pagination';
import { filterClauses, type RequestFilter } from './request-filters';
import type { AnnouncementFilter, IncidentStatus } from './report-filters';
import {
  ACTIVITY_COLUMNS, activityRow, ANNOUNCEMENT_DETAIL_COLUMNS, ANNOUNCEMENT_LIST_COLUMNS, ANNOUNCEMENT_READS_COLUMN, announcementDetailRow, announcementListRow, announcementUnreadRow, BARANGAY_COLUMNS, BARANGAY_PROFILE_COLUMNS, barangayProfileRow, barangayRow,
  CENTER_COLUMNS, centerRow, checkInReceiptRow, DOCUMENT_COLUMNS, documentRow, DRIVE_COLUMNS, driveRegistrationRow, driveRow,
  confirmationRow, EMERGENCY_INFORMATION_COLUMNS, emergencyInformationRow, EMERGENCY_QR_COLUMNS, emergencyQrContentRow, FAQ_COLUMNS, faqRow, ID_SUBMISSION_COLUMNS, idSubmissionRow, INCIDENT_CATEGORY_COLUMNS, incidentCategoryRow, INCIDENT_DETAIL_COLUMNS, incidentDetailRow,
  INCIDENT_LIST_COLUMNS, INCIDENT_MAP_COLUMNS, incidentIdRow, incidentListRow, incidentMapRow, REQUEST_DETAIL_COLUMNS, REQUEST_LIST_COLUMNS, WASTE_ZONE_COLUMNS, wasteZoneRow,
  OWN_CHECKIN_COLUMNS, ownCheckInRow, PAID_RECEIPT_COLUMNS, paidReceiptRow, PAYMENT_ATTEMPT_COLUMNS, paymentAttemptRow, paymentStatusRow, QR_ATTEMPT_COLUMNS, qrAttemptRow,
  REQUEST_ATTACHMENT_COLUMNS, REQUEST_PAYMENT_STATE_COLUMNS, requestAttachmentRow, requestDetailRow, requestListRow, requestPaymentStateRow, requestStatusRow, SITE_CONTENT_COLUMNS, siteContentRow, slaTrackingRow,
  DRIVE_REGISTRATION_RECONCILE_COLUMNS, REGISTRATION_COLUMNS, REGISTRATION_SUMMARY_COLUMNS, registrationRow, registrationSummaryRow,
} from './schemas';

export const uuid = z.string().uuid();
/** Route parameters are untrusted input: anything but a UUID is a not-found, never a query. */
export function routeId(input: unknown) {
  const parsed = uuid.safeParse(input);
  if (!parsed.success) throw new DataError('not-found');
  return parsed.data;
}
/** Detail reads treat a malformed link like an absent record, so the screen shows its not-found state. */
async function detail<T>(input: unknown, read: (id: string) => Promise<T | null>): Promise<T | null> {
  const parsed = uuid.safeParse(input);
  return parsed.success ? read(parsed.data) : null;
}

/** Drive search also matches the drive-type labels and an exact ISO date, as the list shows both. */
function driveSearchFilter(term: string): string | null {
  const pattern = containsPattern(term);
  if (!pattern) return null;
  const needle = term.trim().toLocaleLowerCase();
  const types = DRIVE_TYPES.filter((type) => DRIVE_TYPE_CONFIG[type].label.toLocaleLowerCase().includes(needle) || type.includes(needle));
  const quoted = quoteFilterValue(pattern);
  return [
    `title.ilike.${quoted}`,
    `location.ilike.${quoted}`,
    ...(types.length ? [`type.in.(${types.join(',')})`] : []),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(term.trim()) ? [`drive_date.eq.${term.trim()}`] : []),
  ].join(',');
}

/** Minimal builder surface the request filters use; every supabase-js filter builder satisfies it. */
type Restrictable = {
  in(column: string, values: readonly string[]): Restrictable;
  not(column: string, operator: string, value: string): Restrictable;
};
function restrictRequests<Q extends Restrictable>(query: Q, filter: RequestFilter): Q {
  let next: Restrictable = query;
  for (const clause of filterClauses(filter)) {
    next = clause.op === 'in' ? next.in(clause.column, clause.values) : next.not(clause.column, 'in', `(${clause.values.join(',')})`);
  }
  return next as Q;
}

/** Tokens the payment functions raise on purpose; each has resident copy in `lib/errors.ts`. */
const PAYMENT_RPC_CODES = [
  'payment_method_locked', 'active_online_payment_exists', 'request_amount_unavailable', 'request_not_payable',
  'pickup_only_document', 'invalid_total_pages', 'page_count_locked',
] as const;
/** A payment RPC failure carrying its stable code, so the screen can explain it instead of guessing. */
function paymentRpcFailure(result: { error: unknown; status?: number }): DataError {
  const failure = toDataError(result.error, { status: result.status, write: true });
  const message = result.error && typeof result.error === 'object' && 'message' in result.error ? String(result.error.message) : '';
  const code = PAYMENT_RPC_CODES.find((token) => message.includes(token));
  return code ? new DataError('validation', undefined, result.status, code) : failure;
}

/** An announcement as a list card; `read` is null for a guest, who has no read state. */
export type AnnouncementItem = Omit<z.infer<typeof announcementListRow>, 'announcement_reads'> & { read: boolean | null };
export type AnnouncementDetail = Omit<z.infer<typeof announcementDetailRow>, 'announcement_reads'> & { read: boolean | null };
export type IncidentItem = z.infer<typeof incidentListRow>;
export type MapIncident = z.infer<typeof incidentMapRow>;
/** A half-open publication window as ISO instants; a null side is unbounded. */
export type DateWindow = { from: string | null; to: string | null };
export type IncidentCategory = z.infer<typeof incidentCategoryRow>;
export type WasteZone = z.infer<typeof wasteZoneRow>;
/** A concern in full; `own` says the signed-in resident filed it (the reporter's identity is not kept). */
export type IncidentDetail = Omit<z.infer<typeof incidentDetailRow>, 'reporter_id'> & { own: boolean };
/** Which reports a detail read may return: the resident's own, or any report of the barangay (the `publicIncidents` gate). */
export type IncidentScope = 'own' | 'barangay';
/** The fields of a new concern as the server stores them. `id` is chosen by the app and doubles as the idempotency key. */
export type ConcernInsert = {
  id: string; categoryId: string; zoneId: string | null; title: string; description: string | null;
  photoUrls: string[]; location: { lat: number; lng: number }; address: string | null; specificAreaDetails: string | null;
};
/**
 * Plain-text exceptions of `confirm_incident`/`withdraw_incident` (migration 0121) and the codes of the
 * incident write guard; each maps to a stable code with resident copy in `lib/errors.ts`.
 */
const INCIDENT_FAILURE_TOKENS: readonly (readonly [string, string])[] = [
  ['you cannot confirm your own report', 'incident_own_report'],
  ['incident is not in your barangay', 'incident_not_found'],
  ['incident not found', 'incident_not_found'],
  ['you can only withdraw a report you filed yourself', 'incident_not_yours'],
  ['you can only withdraw a report that is still open', 'incident_not_open'],
  ['24-hour withdrawal window', 'incident_window_closed'],
  ['invalid_incident_photo', 'incident_photo_invalid'],
  ['too_many_incident_photos', 'incident_photo_limit'],
  ['incident_category_not_in_barangay', 'incident_category_invalid'],
  ['incident_zone_not_in_barangay', 'incident_zone_invalid'],
  ['invalid_initial_incident_state', 'incident_state_invalid'],
  ['resident_profile_completion_required', 'profile_completion_required'],
];
/** An incident write failure carrying its stable code, so the screen explains it instead of guessing. */
function incidentFailure(result: { error: unknown; status?: number }): DataError {
  const failure = toDataError(result.error, { status: result.status, write: true });
  const message = result.error && typeof result.error === 'object' && 'message' in result.error ? String(result.error.message) : '';
  const token = INCIDENT_FAILURE_TOKENS.find(([text]) => message.includes(text));
  if (!token) return failure;
  return new DataError(token[1] === 'incident_not_found' ? 'not-found' : 'validation', undefined, result.status, token[1]);
}

/** A medical drive as the Health screens show it. */
export type DriveItem = z.infer<typeof driveRow>;
/** One of the resident's own registrations; `drive` is null when the drive is no longer listed for this barangay. */
export type RegistrationItem = Omit<z.infer<typeof registrationRow>, 'drive'> & { drive: DriveItem | null };
export type RegistrationSummary = z.infer<typeof registrationSummaryRow>;
export type RegistrationStatus = RegistrationSummary['status'];
/** The server's answer to a registration; `reconciled` means the reply was lost and the stored registration was found instead. */
export type DriveRegistrationOutcome = z.infer<typeof residentDriveRegistrationResultSchema> & { reconciled: boolean };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = (value: string) => {
  if (!ISO_DATE.test(value)) throw new DataError('validation', 'A date must be YYYY-MM-DD.');
  return value;
};
const driveType = (value: string | undefined) => {
  if (value === undefined || value === 'all') return null;
  const found = DRIVE_TYPES.find((type) => type === value);
  if (!found) throw new DataError('validation', 'Unknown drive category.');
  return found;
};

/**
 * Exceptions of `register_for_drive` (migration 0121) with their stable codes: P0002 inactive/unknown drive, P0003 no slots,
 * P0004 already registered, P0005 registration closed, 22023 invalid input. Each is a definite answer, never a lost reply.
 */
const REGISTRATION_FAILURE_KINDS: Record<string, DataError['kind']> = { P0002: 'not-found', P0003: 'validation', P0004: 'conflict', P0005: 'validation', '22023': 'validation' };
function driveRegistrationFailure(result: { error: unknown; status?: number }): DataError {
  const error = result.error && typeof result.error === 'object' ? result.error as { code?: unknown; message?: unknown } : {};
  const code = typeof error.code === 'string' ? error.code : '';
  const message = typeof error.message === 'string' ? error.message : '';
  if (message.includes('resident_profile_completion_required')) return new DataError('validation', undefined, result.status, 'registration_profile_required');
  const kind = REGISTRATION_FAILURE_KINDS[code];
  if (kind) return new DataError(kind, undefined, result.status, code);
  return toDataError(result.error, { status: result.status, write: true });
}

/** The server's confirmation of one evacuation-center check-in; `repeated` is a retry answered with the earlier check-in. */
export type CheckInReceipt = { checkInId: string; centerId: string; centerName: string | null; checkedInAt: string; repeated: boolean };

/**
 * The exceptions of `check_in_to_evacuation_center` (migration 0121). Each maps to a stable code with resident copy
 * in `lib/errors.ts`; a missing session is a session failure, and anything else is classified as a write.
 */
function checkInFailure(result: { error: unknown; status?: number }): DataError {
  const error = result.error && typeof result.error === 'object' ? result.error as { code?: unknown; message?: unknown } : {};
  const code = typeof error.code === 'string' ? error.code : '';
  const message = typeof error.message === 'string' ? error.message : '';
  if (message.includes('authentication_required')) return new DataError('session', undefined, result.status, 'authentication_required');
  if (code === 'P0010') return new DataError('authorization', undefined, result.status, 'checkin_not_resident');
  if (code === 'P0011') return new DataError('authorization', undefined, result.status, 'checkin_wrong_barangay');
  if (code === 'P0012') return new DataError('not-found', undefined, result.status, 'checkin_center_unavailable');
  return toDataError(result.error, { status: result.status, write: true });
}
/** A lost reply is reconciled against stored rows no older than this before the attempt began. */
const RECONCILE_SLACK_MS = 60_000;

/** Result of a bulk read marking: how many of the snapshot were written before any failure. */
export type BulkResult = { requested: number; done: number; failure: DataError | null };

/** Rows written per request in a bulk marking, small enough for a URL and a single statement. */
const BULK_CHUNK = 100;
/** Bound for the read-state snapshots; more rows than this is reported, never silently truncated. */
const SNAPSHOT_MAX_ROWS = 5000;

/** The resident's read state of one announcement row; the embed must be present for a signed-in read. */
function withRead<T extends { announcement_reads?: { resident_id: string }[] }>(row: T, reader: boolean): Omit<T, 'announcement_reads'> & { read: boolean | null } {
  const { announcement_reads: reads, ...rest } = row;
  if (!reader) return { ...rest, read: null };
  if (!Array.isArray(reads)) throw new DataError('schema', 'The server response did not match the expected format.');
  return { ...rest, read: reads.length > 0 };
}

/** Runs one write per chunk and stops at the first failure; `done` counts what each write reports as stored. */
async function writeInChunks(ids: readonly string[], write: (chunk: string[]) => Promise<number>): Promise<BulkResult> {
  let done = 0;
  for (let start = 0; start < ids.length; start += BULK_CHUNK) {
    try {
      done += await write(ids.slice(start, start + BULK_CHUNK));
    } catch (failure) {
      return { requested: ids.length, done, failure: toDataError(failure, { write: true }) };
    }
  }
  return { requested: ids.length, done, failure: null };
}

export function residentApi(client: SupabaseClient<Database>, barangayId: string, userId?: string) {
  uuid.parse(barangayId);
  function owner() {
    const parsed = uuid.safeParse(userId);
    if (!parsed.success) throw new DataError('session');
    return parsed.data;
  }
  /** The own request fields a payment write is reconciled against (null when unreadable or absent). */
  async function paymentState(id: unknown) {
    const result = await client.from('service_requests').select(REQUEST_PAYMENT_STATE_COLUMNS).eq('id', routeId(id)).eq('resident_id', owner()).eq('barangay_id', barangayId).is('deleted_at', null).maybeSingle();
    return result.error ? null : parseMaybeRow(requestPaymentStateRow, result);
  }
  return {
    async barangay(signal: AbortSignal) {
      return parseRow(barangayRow, await client.from('barangays').select(BARANGAY_COLUMNS).eq('id', barangayId).abortSignal(signal).maybeSingle(), signal);
    },

    /** B03 own barangay boundary and configured locality, for the profile and location screens. */
    async barangayProfile(signal: AbortSignal) {
      const row = parseMaybeRow(barangayProfileRow, await client.from('barangays').select(BARANGAY_PROFILE_COLUMNS).eq('id', barangayId).abortSignal(signal).maybeSingle(), signal);
      if (!row) return null;
      const locality = Array.isArray(row.barangay_localities) ? row.barangay_localities[0] ?? null : row.barangay_localities;
      return { name: row.name, boundary: row.boundary, locality };
    },
    /** B05 the newest ID version of the signed-in resident, or null when none was submitted. */
    async latestIdSubmission(signal: AbortSignal) {
      const rows = parseRows(idSubmissionRow, await client.from('id_submissions').select(ID_SUBMISSION_COLUMNS).eq('resident_id', owner()).eq('barangay_id', barangayId).order('version', { ascending: false }).limit(1).abortSignal(signal), signal);
      return rows[0] ?? null;
    },
    /** B05 the verified ID version a request would reuse (own row, verified decision only); null when it is not that. */
    async approvedIdSubmission(submissionId: unknown, signal: AbortSignal) {
      const row = parseMaybeRow(idSubmissionRow, await client.from('id_submissions').select(ID_SUBMISSION_COLUMNS).eq('id', routeId(submissionId)).eq('resident_id', owner()).eq('barangay_id', barangayId).abortSignal(signal).maybeSingle(), signal);
      return row?.decision === 'verified' ? row : null;
    },
    /** Reconciliation read after an uncertain ID publication. */
    async idSubmissionExists(submissionId: unknown, signal: AbortSignal) {
      const found = parseMaybeRow(idSubmissionRow, await client.from('id_submissions').select(ID_SUBMISSION_COLUMNS).eq('id', routeId(submissionId)).eq('resident_id', owner()).maybeSingle(), signal);
      return found !== null;
    },

    /** B06 catalogue, searched server-side by name or description. */
    documents: (search: string): PageRead<z.infer<typeof documentRow>> => async ({ from, to }, signal) => {
      let query = client.from('document_types').select(DOCUMENT_COLUMNS).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null);
      const pattern = containsPattern(search);
      if (pattern) query = query.or(`name.ilike.${quoteFilterValue(pattern)},description.ilike.${quoteFilterValue(pattern)}`);
      return parseRows(documentRow, await query.order('name').order('id').range(from, to).abortSignal(signal), signal);
    },
    document(input: unknown, signal: AbortSignal) {
      return detail(input, async (id) => parseMaybeRow(documentRow, await client.from('document_types').select(DOCUMENT_COLUMNS).eq('id', id).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).abortSignal(signal).maybeSingle(), signal));
    },

    /** B07 own requests for one filter, newest first with an id tie-break. */
    requests: (filter: RequestFilter): PageRead<z.infer<typeof requestListRow>> => async ({ from, to }, signal) =>
      parseRows(requestListRow, await restrictRequests(client.from('service_requests').select(REQUEST_LIST_COLUMNS).eq('resident_id', owner()).eq('barangay_id', barangayId).is('deleted_at', null), filter).order('created_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal),
    /** Exact per-group totals, counted by the server so they stay right beyond the loaded pages. */
    async requestCounts(signal: AbortSignal) {
      const resident = owner();
      const groups = ['all', 'active', 'pickup', 'history'] as const;
      const results = await Promise.all(groups.map((group) => restrictRequests(client.from('service_requests').select('id', { count: 'exact', head: true }).eq('resident_id', resident).eq('barangay_id', barangayId).is('deleted_at', null), { group, sub: 'all' }).abortSignal(signal)));
      const [all, active, pickup, history] = results.map((result) => parseCount(result, signal));
      return { all, active, pickup, history };
    },
    /** The latest state of each own request by last update (the Logs view; not an event history). */
    activity: (): PageRead<z.infer<typeof activityRow>> => async ({ from, to }, signal) =>
      parseRows(activityRow, await client.from('service_requests').select(ACTIVITY_COLUMNS).eq('resident_id', owner()).eq('barangay_id', barangayId).is('deleted_at', null).order('updated_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal),
    request(input: unknown, signal: AbortSignal) {
      return detail(input, async (id) => parseMaybeRow(requestDetailRow, await client.from('service_requests').select(REQUEST_DETAIL_COLUMNS).eq('id', id).eq('resident_id', owner()).eq('barangay_id', barangayId).is('deleted_at', null).abortSignal(signal).maybeSingle(), signal));
    },
    /** Submitted supporting files of one own request, oldest first. */
    async requestAttachments(input: unknown, signal: AbortSignal) {
      return parseRows(requestAttachmentRow, await client.from('request_attachments').select(REQUEST_ATTACHMENT_COLUMNS).eq('request_id', routeId(input)).eq('resident_id', owner()).order('created_at').order('id').abortSignal(signal), signal);
    },
    /** The ID version a request was approved with, whatever its decision is today (own row). */
    async idVersion(input: unknown, signal: AbortSignal) {
      return parseMaybeRow(idSubmissionRow, await client.from('id_submissions').select(ID_SUBMISSION_COLUMNS).eq('id', routeId(input)).eq('resident_id', owner()).eq('barangay_id', barangayId).abortSignal(signal).maybeSingle(), signal);
    },
    /** B07 server-evaluated clock snapshot of an agency-timed request. */
    async slaTracking(input: unknown, signal: AbortSignal) {
      return parseRow(slaTrackingRow, await client.rpc('service_request_sla_tracking', { p_request_id: routeId(input) }).abortSignal(signal), signal);
    },
    /**
     * Cancels one own request. A lost reply is reconciled with an authoritative read before
     * anything is reported, and a write is never retried automatically.
     */
    async cancelRequest(id: unknown, note?: string) {
      const requestId = routeId(id);
      const result = await client.rpc('cancel_own_service_request', { p_request_id: requestId, p_note: note?.trim() || 'Cancelled by resident' });
      if (!result.error) return;
      const failure = toDataError(result.error, { status: result.status, write: true });
      const reconciled = await client.from('service_requests').select('status').eq('id', requestId).eq('resident_id', owner()).eq('barangay_id', barangayId).maybeSingle();
      if (!reconciled.error && parseMaybeRow(requestStatusRow, reconciled)?.status === 'cancelled') return;
      throw failure;
    },

    /**
     * B09 chooses the payment method. The server rejects a locked method; a lost reply is
     * reconciled with a read of the request, never resent.
     */
    async setPaymentMethod(id: unknown, method: 'pickup' | 'qrph') {
      const requestId = routeId(id);
      const result = await client.rpc('set_service_request_payment_method', { p_request_id: requestId, p_method: method });
      if (!result.error) return;
      const failure = paymentRpcFailure(result);
      if (failure.kind === 'unknown-commit' && (await paymentState(requestId))?.payment_method === method) return;
      throw failure;
    },
    /** B09 records the pickup payment. Reconciled by the pending pickup row (or the variable-fee state). */
    async startPickupPayment(id: unknown) {
      const requestId = routeId(id);
      const result = await client.rpc('start_pickup_payment', { p_request_id: requestId });
      if (!result.error) return;
      const failure = paymentRpcFailure(result);
      if (failure.kind === 'unknown-commit') {
        const state = await paymentState(requestId);
        if (state && state.payment_method === 'pickup' && (state.fee_assessment_state === 'pickup_due' || state.payments.some((payment) => payment.method === 'pickup' && payment.status === 'pending'))) return;
      }
      throw failure;
    },
    /** B09 the total page count of a certified copy request; reconciled by the stored count. */
    async setBillablePages(id: unknown, pages: number) {
      const requestId = routeId(id);
      const result = await client.rpc('set_service_request_pages', { p_request_id: requestId, p_total_pages: pages });
      if (!result.error) return;
      const failure = paymentRpcFailure(result);
      if (failure.kind === 'unknown-commit') {
        const state = await paymentState(requestId);
        if (state?.billable_pages === pages && state.fee_assessment_state === 'assessed') return;
      }
      throw failure;
    },
    /** B09 every payment attempt of one own request, newest first, without QR images. */
    async paymentAttempts(id: unknown, signal: AbortSignal) {
      return parseRows(paymentAttemptRow, await client.from('payments').select(PAYMENT_ATTEMPT_COLUMNS).eq('service_request_id', routeId(id)).eq('barangay_id', barangayId).is('deleted_at', null).order('created_at', { ascending: false }).order('id').abortSignal(signal), signal);
    },
    /** The newest pending QR PH attempt of a request with its QR image, or null. */
    async openQrAttempt(id: unknown, signal: AbortSignal) {
      const rows = parseRows(qrAttemptRow, await client.from('payments').select(QR_ATTEMPT_COLUMNS).eq('service_request_id', routeId(id)).eq('barangay_id', barangayId).eq('method', 'qrph').eq('status', 'pending').is('deleted_at', null).order('created_at', { ascending: false }).limit(1).abortSignal(signal), signal);
      return rows[0] ?? null;
    },
    /** The recorded status of one payment attempt of an own request, or null when it is not visible. */
    async paymentStatus(id: unknown, signal: AbortSignal) {
      return parseMaybeRow(paymentStatusRow, await client.from('payments').select('status').eq('id', routeId(id)).eq('barangay_id', barangayId).abortSignal(signal).maybeSingle(), signal)?.status ?? null;
    },
    /** B09 the committed paid payment of an own request with its reference; the receipt's only source. */
    async paidReceipt(id: unknown, signal: AbortSignal) {
      const rows = parseRows(paidReceiptRow, await client.from('payments').select(PAID_RECEIPT_COLUMNS).eq('service_request_id', routeId(id)).eq('status', 'paid').eq('barangay_id', barangayId).eq('service_requests.resident_id', owner()).is('deleted_at', null).order('paid_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(1).abortSignal(signal), signal);
      return rows[0] ?? null;
    },

    /**
     * B12 announcements, newest first, with the signed-in resident's own read state. `window`
     * restricts the publication instant on the server, so pages and counts stay right beyond the loaded rows.
     */
    announcements: (category: AnnouncementFilter, window?: DateWindow): PageRead<AnnouncementItem> => async ({ from, to }, signal) => {
      const reader = uuid.safeParse(userId).success ? uuid.parse(userId) : null;
      const columns = reader ? `${ANNOUNCEMENT_LIST_COLUMNS},${ANNOUNCEMENT_READS_COLUMN}` : ANNOUNCEMENT_LIST_COLUMNS;
      let query = client.from('announcements').select(columns).eq('barangay_id', barangayId).is('deleted_at', null);
      if (reader) query = query.eq('announcement_reads.resident_id', reader);
      if (category !== 'all') query = query.eq('category', z.enum(ANNOUNCEMENT_CATEGORIES as [string, ...string[]]).parse(category));
      if (window?.from) query = query.gte('published_at', window.from);
      if (window?.to) query = query.lt('published_at', window.to);
      const rows = parseRows(announcementListRow, await query.order('published_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal);
      return rows.map((row) => withRead(row, reader !== null));
    },
    /** Exact number of announcements of one category published inside a window (the "Showing X of Y" counts). */
    async announcementCount(category: AnnouncementFilter, window: DateWindow | undefined, signal: AbortSignal) {
      let query = client.from('announcements').select('id', { count: 'exact', head: true }).eq('barangay_id', barangayId).is('deleted_at', null);
      if (category !== 'all') query = query.eq('category', z.enum(ANNOUNCEMENT_CATEGORIES as [string, ...string[]]).parse(category));
      if (window?.from) query = query.gte('published_at', window.from);
      if (window?.to) query = query.lt('published_at', window.to);
      return parseCount(await query.abortSignal(signal), signal);
    },
    announcement(input: unknown, signal: AbortSignal) {
      const reader = uuid.safeParse(userId).success ? uuid.parse(userId) : null;
      const columns = reader ? `${ANNOUNCEMENT_DETAIL_COLUMNS},${ANNOUNCEMENT_READS_COLUMN}` : ANNOUNCEMENT_DETAIL_COLUMNS;
      return detail(input, async (id): Promise<AnnouncementDetail | null> => {
        let query = client.from('announcements').select(columns).eq('id', id).eq('barangay_id', barangayId).is('deleted_at', null);
        if (reader) query = query.eq('announcement_reads.resident_id', reader);
        const row = parseMaybeRow(announcementDetailRow, await query.abortSignal(signal).maybeSingle(), signal);
        return row ? withRead(row, reader !== null) : null;
      });
    },
    /** Reports signals: active own reports, unread own resolved reports and unread announcements, counted server-side. */
    async reportCounts(signal: AbortSignal) {
      const resident = owner();
      const [active, resolved, announcements, reads] = await Promise.all([
        client.from('incidents').select('id', { count: 'exact', head: true }).eq('reporter_id', resident).eq('barangay_id', barangayId).is('deleted_at', null).in('status', ['open', 'in_progress']).abortSignal(signal),
        client.from('incidents').select('id', { count: 'exact', head: true }).eq('reporter_id', resident).eq('barangay_id', barangayId).is('deleted_at', null).eq('status', 'resolved').is('resolved_read_at', null).abortSignal(signal),
        client.from('announcements').select('id', { count: 'exact', head: true }).eq('barangay_id', barangayId).is('deleted_at', null).abortSignal(signal),
        client.from('announcement_reads').select('announcement_id,announcements!inner(id)', { count: 'exact', head: true }).eq('resident_id', resident).eq('announcements.barangay_id', barangayId).is('announcements.deleted_at', null).abortSignal(signal),
      ]);
      return {
        active: parseCount(active, signal),
        unreadResolved: parseCount(resolved, signal),
        unreadAnnouncements: Math.max(parseCount(announcements, signal) - parseCount(reads, signal), 0),
      };
    },
    /** Idempotent upsert: repeating it after an unknown outcome cannot create a second row. */
    async markAnnouncementRead(id: unknown) {
      checkWrite(await client.from('announcement_reads').upsert({ announcement_id: routeId(id), resident_id: owner() }, { onConflict: 'announcement_id,resident_id' }));
    },
    /** Idempotent: deleting an absent marker is a success, so a repeat after an unknown outcome is safe. */
    async markAnnouncementUnread(id: unknown) {
      checkWrite(await client.from('announcement_reads').delete().eq('resident_id', owner()).eq('announcement_id', routeId(id)));
    },
    /**
     * The ids of every announcement of this barangay the resident has not read, taken at one
     * instant. Bulk marking acts on exactly this set, so announcements that arrive afterwards
     * stay unread instead of being acknowledged unseen.
     */
    async unreadAnnouncementIds(signal: AbortSignal) {
      const resident = owner();
      const rows = await readAll(async ({ from, to }, pageSignal) =>
        parseRows(announcementUnreadRow, await client.from('announcements').select(`id,${ANNOUNCEMENT_READS_COLUMN}`).eq('barangay_id', barangayId).is('deleted_at', null).eq('announcement_reads.resident_id', resident).order('published_at', { ascending: false }).order('id').range(from, to).abortSignal(pageSignal), pageSignal), signal, SNAPSHOT_MAX_ROWS);
      return rows.filter((row) => row.announcement_reads.length === 0).map((row) => row.id);
    },
    /** Marks a snapshot read in chunks; stops at the first failure and reports how far it got. */
    async markAnnouncementsRead(ids: readonly string[]): Promise<BulkResult> {
      const resident = owner();
      const unique = [...new Set(ids.map((id) => routeId(id)))];
      return writeInChunks(unique, async (chunk) => {
        checkWrite(await client.from('announcement_reads').upsert(chunk.map((announcement_id) => ({ announcement_id, resident_id: resident })), { onConflict: 'announcement_id,resident_id' }));
        return chunk.length;
      });
    },

    /** B11 the resident's own incident reports, newest first, for one status restriction (null = every status). */
    incidents: (statuses: readonly IncidentStatus[] | null): PageRead<IncidentItem> => async ({ from, to }, signal) => {
      let query = client.from('incidents').select(INCIDENT_LIST_COLUMNS).eq('reporter_id', owner()).eq('barangay_id', barangayId).is('deleted_at', null);
      if (statuses) query = query.in('status', [...statuses]);
      return parseRows(incidentListRow, await query.order('created_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal);
    },
    /** B11 every own concern with its pin for the Maps layer, newest first. Bounded: more rows than that is reported, never cut. */
    mapIncidents: (signal: AbortSignal) => readAll(async ({ from, to }, pageSignal) =>
      parseRows(incidentMapRow, await client.from('incidents').select(INCIDENT_MAP_COLUMNS).eq('reporter_id', owner()).eq('barangay_id', barangayId).is('deleted_at', null).order('created_at', { ascending: false }).order('id').range(from, to).abortSignal(pageSignal), pageSignal), signal),
    /** B11 the barangay's concern categories, A–Z. */
    async incidentCategories(signal: AbortSignal) {
      return parseRows(incidentCategoryRow, await client.from('incident_categories').select(INCIDENT_CATEGORY_COLUMNS).eq('barangay_id', barangayId).order('name').order('id').abortSignal(signal), signal);
    },
    /** B11 active waste-collection zones, offered for trash-related categories. */
    async wasteZones(signal: AbortSignal) {
      return parseRows(wasteZoneRow, await client.from('waste_zones').select(WASTE_ZONE_COLUMNS).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).order('sort_order').order('id').abortSignal(signal), signal);
    },
    /**
     * B11 one concern. `own` restricts the read to the resident's own reports; `barangay` is used only
     * once public incident visibility is open. A malformed id or an absent/foreign row is null.
     */
    incident(input: unknown, signal: AbortSignal, scope: IncidentScope): Promise<IncidentDetail | null> {
      return detail(input, async (id) => {
        const viewer = uuid.safeParse(userId);
        let query = client.from('incidents').select(INCIDENT_DETAIL_COLUMNS).eq('id', id).eq('barangay_id', barangayId).is('deleted_at', null);
        if (scope === 'own') query = query.eq('reporter_id', owner());
        const row = parseMaybeRow(incidentDetailRow, await query.abortSignal(signal).maybeSingle(), signal);
        if (!row) return null;
        const { reporter_id: reporter, ...rest } = row;
        return { ...rest, own: viewer.success && reporter === viewer.data };
      });
    },
    /** Whether the signed-in resident already confirmed this report (own row, by row-level security). */
    async hasConfirmed(input: unknown, signal: AbortSignal) {
      const row = parseMaybeRow(confirmationRow, await client.from('incident_confirmations').select('incident_id').eq('incident_id', routeId(input)).eq('user_id', owner()).abortSignal(signal).maybeSingle(), signal);
      return row !== null;
    },
    /**
     * Corroborates another resident's report. The server deduplicates, so a repeat is `already`; a lost
     * reply is reconciled with the resident's own confirmation row and never resent blindly.
     */
    async confirmIncident(input: unknown): Promise<'confirmed' | 'already'> {
      const incidentId = routeId(input);
      const resident = owner();
      const result = await client.rpc('confirm_incident', { p_incident_id: incidentId });
      if (!result.error) {
        if (typeof result.data !== 'boolean') throw new DataError('schema', 'The server response did not match the expected format.');
        return result.data ? 'confirmed' : 'already';
      }
      const failure = incidentFailure(result);
      if (failure.kind === 'unknown-commit') {
        const stored = await client.from('incident_confirmations').select('incident_id').eq('incident_id', incidentId).eq('user_id', resident).maybeSingle();
        if (!stored.error && parseMaybeRow(confirmationRow, stored)) return 'confirmed';
      }
      throw failure;
    },
    /** Withdraws the resident's own open report (24-hour window, enforced by the server); reconciled by the stored status. */
    async withdrawIncident(input: unknown) {
      const incidentId = routeId(input);
      const resident = owner();
      const result = await client.rpc('withdraw_incident', { p_incident_id: incidentId });
      if (!result.error) return;
      const failure = incidentFailure(result);
      if (failure.kind === 'unknown-commit') {
        const stored = await client.from('incidents').select('status').eq('id', incidentId).eq('reporter_id', resident).eq('barangay_id', barangayId).maybeSingle();
        if (!stored.error && parseMaybeRow(requestStatusRow, stored)?.status === 'withdrawn') return;
      }
      throw failure;
    },
    /**
     * Files a concern. The app-chosen `id` is the idempotency key: a lost reply or a repeat of the same
     * attempt is reconciled with a read of the resident's own row, so no second concern is created.
     */
    async createIncident(concern: ConcernInsert) {
      const resident = owner();
      const incidentId = routeId(concern.id);
      const result = await client.from('incidents').insert({
        id: incidentId, barangay_id: barangayId, reporter_id: resident, category_id: routeId(concern.categoryId),
        zone_id: concern.zoneId === null ? null : routeId(concern.zoneId), title: concern.title, description: concern.description,
        photo_urls: concern.photoUrls, location: concern.location, address: concern.address, specific_area_details: concern.specificAreaDetails, status: 'open',
      });
      if (!result.error) return;
      const failure = incidentFailure(result);
      if (failure.kind === 'unknown-commit' || failure.kind === 'conflict') {
        const stored = await client.from('incidents').select('id').eq('id', incidentId).eq('reporter_id', resident).eq('barangay_id', barangayId).maybeSingle();
        if (!stored.error && parseMaybeRow(incidentIdRow, stored)) return;
      }
      throw failure;
    },
    /** Reconciliation read of an uncertain filing: true once the resident's own row with this id exists. */
    async incidentExists(input: unknown, signal: AbortSignal) {
      return parseMaybeRow(incidentIdRow, await client.from('incidents').select('id').eq('id', routeId(input)).eq('reporter_id', owner()).eq('barangay_id', barangayId).abortSignal(signal).maybeSingle(), signal) !== null;
    },
    /**
     * Marks one resolved report read or unread. RLS silently matches zero rows for a report that
     * is not resolved, not the resident's or deleted, so an empty result is reported as a
     * failure instead of a success that changed nothing.
     */
    async setIncidentRead(id: unknown, read: boolean) {
      const result = await client.from('incidents').update({ resolved_read_at: read ? new Date().toISOString() : null }).eq('id', routeId(id)).eq('reporter_id', owner()).eq('barangay_id', barangayId).eq('status', 'resolved').is('deleted_at', null).select('id');
      checkWrite(result);
      if (!Array.isArray(result.data) || result.data.length === 0) throw new DataError('not-found');
    },
    /** The ids of the resident's unread resolved reports at one instant (the bulk-marking snapshot). */
    async unreadResolvedIncidentIds(signal: AbortSignal) {
      const resident = owner();
      const rows = await readAll(async ({ from, to }, pageSignal) =>
        parseRows(incidentIdRow, await client.from('incidents').select('id').eq('reporter_id', resident).eq('barangay_id', barangayId).is('deleted_at', null).eq('status', 'resolved').is('resolved_read_at', null).order('created_at', { ascending: false }).order('id').range(from, to).abortSignal(pageSignal), pageSignal), signal, SNAPSHOT_MAX_ROWS);
      return rows.map((row) => row.id);
    },
    /** Marks a snapshot of resolved reports read; a report that changed meanwhile is skipped, not forced. */
    async markIncidentsRead(ids: readonly string[]): Promise<BulkResult> {
      const resident = owner();
      const unique = [...new Set(ids.map((id) => routeId(id)))];
      const stamp = new Date().toISOString();
      return writeInChunks(unique, async (chunk) => {
        const result = await client.from('incidents').update({ resolved_read_at: stamp }).in('id', chunk).eq('reporter_id', resident).eq('barangay_id', barangayId).eq('status', 'resolved').is('deleted_at', null).is('resolved_read_at', null).select('id');
        checkWrite(result);
        return Array.isArray(result.data) ? result.data.length : 0;
      });
    },

    /** B16 active drives in this barangay, soonest first; `from` keeps only drives on or after that day. */
    drives: (search: string, options: { type?: string; from?: string } = {}): PageRead<DriveItem> => async ({ from, to }, signal) => {
      let query = client.from('medical_drives').select(DRIVE_COLUMNS).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null);
      const category = driveType(options.type);
      if (category) query = query.eq('type', category);
      if (options.from) query = query.gte('drive_date', isoDate(options.from));
      const filter = driveSearchFilter(search);
      if (filter) query = query.or(filter);
      return parseRows(driveRow, await query.order('drive_date').order('time_start').order('id').range(from, to).abortSignal(signal), signal);
    },
    /** B16 every active drive dated from `from` to `to` inclusive (one calendar month), for the dots and the day lists. */
    drivesBetween: (from: string, to: string, signal: AbortSignal) => readAll<DriveItem>(async (range, pageSignal) =>
      parseRows(driveRow, await client.from('medical_drives').select(DRIVE_COLUMNS).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null)
        .gte('drive_date', isoDate(from)).lte('drive_date', isoDate(to)).order('drive_date').order('time_start').order('id').range(range.from, range.to).abortSignal(pageSignal), pageSignal), signal),
    drive(input: unknown, signal: AbortSignal) {
      return detail(input, async (id) => parseMaybeRow(driveRow, await client.from('medical_drives').select(DRIVE_COLUMNS).eq('id', id).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).abortSignal(signal).maybeSingle(), signal));
    },
    /** B16 the resident's own registrations, newest first, optionally one status. A drive of another barangay is treated as not listed. */
    myRegistrations: (status: RegistrationStatus | 'all'): PageRead<RegistrationItem> => async ({ from, to }, signal) => {
      let query = client.from('drive_registrations').select(REGISTRATION_COLUMNS).eq('user_id', owner());
      if (status !== 'all') query = query.eq('status', status);
      const rows = parseRows(registrationRow, await query.order('created_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal);
      return rows.map(({ drive, ...row }): RegistrationItem => {
        if (!drive || drive.barangay_id !== barangayId) return { ...row, drive: null };
        const { barangay_id: _tenant, ...visible } = drive;
        return { ...row, drive: visible };
      });
    },
    /** B16 every own registration's id, drive and status: the status counts and the "already registered" marks. */
    registrationSummary: (signal: AbortSignal) => readAll<RegistrationSummary>(async (range, pageSignal) =>
      parseRows(registrationSummaryRow, await client.from('drive_registrations').select(REGISTRATION_SUMMARY_COLUMNS).eq('user_id', owner()).order('id').range(range.from, range.to).abortSignal(pageSignal), pageSignal), signal),
    /**
     * B16 self registration. The server alone decides resident role, tenant, active drive, date, capacity and duplicates and returns the
     * applicant number. Only a lost reply is reconciled, and only against a registration created during this attempt; a definite refusal
     * (full, closed, already registered) is reported as such, never as a success.
     */
    async registerForDrive(input: unknown): Promise<DriveRegistrationOutcome> {
      const value = driveRegistrationSchema.parse(input);
      const startedAt = Date.now();
      const result = await client.rpc('register_for_drive', {
        p_drive_id: value.driveId, p_age: value.age, p_is_pwd: value.isPwd, p_comorbidities: value.comorbidities,
        ...(value.priorDoseDate ? { p_prior_dose_date: value.priorDoseDate } : {}),
      });
      if (!result.error) return { ...parseRow(residentDriveRegistrationResultSchema, result), reconciled: false };
      const failure = driveRegistrationFailure(result);
      if (failure.kind !== 'unknown-commit') throw failure;
      const reconciled = await client.from('drive_registrations').select(DRIVE_REGISTRATION_RECONCILE_COLUMNS).eq('drive_id', value.driveId).eq('user_id', owner()).maybeSingle();
      const existing = reconciled.error ? null : parseMaybeRow(driveRegistrationRow, reconciled);
      if (existing && Date.parse(existing.created_at) >= startedAt - RECONCILE_SLACK_MS) {
        return { registration_id: existing.id, applicant_number: existing.applicant_number, status: existing.status, reconciled: true };
      }
      throw failure;
    },

    /** B13 public emergency information (guidelines/hotlines). Read whole: it is cached for offline use. */
    emergencyInformation: (signal: AbortSignal) => readAll(async ({ from, to }, pageSignal) =>
      parseRows(emergencyInformationRow, await client.from('emergency_information').select(EMERGENCY_INFORMATION_COLUMNS).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).order('sort_order').order('id').range(from, to).abortSignal(pageSignal), pageSignal), signal),
    /** B13 active evacuation centers. Read whole: it is cached for offline use. */
    centers: (signal: AbortSignal) => readAll(async ({ from, to }, pageSignal) =>
      parseRows(centerRow, await client.from('evacuation_centers').select(CENTER_COLUMNS).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).order('name').order('id').range(from, to).abortSignal(pageSignal), pageSignal), signal),

    /** B13 QR check-in guidance. Read whole: it is cached for offline use. */
    emergencyQrContent: (signal: AbortSignal) => readAll(async ({ from, to }, pageSignal) =>
      parseRows(emergencyQrContentRow, await client.from('emergency_qr_content').select(EMERGENCY_QR_COLUMNS).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).order('sort_order').order('id').range(from, to).abortSignal(pageSignal), pageSignal), signal),

    /**
     * B14 online, resident-only check-in. Only the server's receipt counts as attendance. A lost reply is reconciled with a
     * read of the resident's own stored check-ins for that center and is otherwise reported as unconfirmed; the server answers a
     * repeat within ten minutes with the first check-in, so trying again never records twice.
     */
    async checkInToCenter(input: unknown): Promise<CheckInReceipt> {
      const centerId = routeId(input);
      const resident = owner();
      const startedAt = Date.now();
      const result = await client.rpc('check_in_to_evacuation_center', { p_center_id: centerId });
      if (!result.error) {
        const [row] = parseRows(checkInReceiptRow, result);
        // A receipt for another center or barangay is a contract failure, never shown as this check-in.
        if (!row || row.evacuation_center_id !== centerId || row.barangay_id !== barangayId) throw new DataError('schema', 'The server response did not match the expected format.');
        return { checkInId: row.check_in_id, centerId: row.evacuation_center_id, centerName: row.evacuation_center_name, checkedInAt: row.checked_in_at, repeated: row.already_checked_in };
      }
      const failure = checkInFailure(result);
      if (failure.kind === 'unknown-commit') {
        const since = new Date(startedAt - RECONCILE_SLACK_MS).toISOString();
        const stored = await client.from('evacuation_center_checkins').select(OWN_CHECKIN_COLUMNS).eq('user_id', resident).eq('barangay_id', barangayId).eq('evacuation_center_id', centerId).gte('checked_in_at', since).order('checked_in_at', { ascending: false }).limit(1);
        if (!stored.error) {
          const [row] = parseRows(ownCheckInRow, stored);
          if (row) return { checkInId: row.id, centerId: row.evacuation_center_id, centerName: row.evacuation_centers?.name ?? null, checkedInAt: row.checked_in_at, repeated: false };
        }
      }
      throw failure;
    },
    /** The resident's own newest stored check-ins (own rows, by row-level security and the explicit owner filter). */
    async recentCheckIns(signal: AbortSignal) {
      return parseRows(ownCheckInRow, await client.from('evacuation_center_checkins').select(OWN_CHECKIN_COLUMNS).eq('user_id', owner()).eq('barangay_id', barangayId).order('checked_in_at', { ascending: false }).limit(5).abortSignal(signal), signal);
    },

    /** B21 resident information; emergency sections are shown by the emergency hub instead. */
    information: (): PageRead<z.infer<typeof siteContentRow>> => async ({ from, to }, signal) =>
      parseRows(siteContentRow, await client.from('site_content').select(SITE_CONTENT_COLUMNS).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).not('section', 'ilike', '%emergency%').order('sort_order').order('id').range(from, to).abortSignal(signal), signal),
    faq: (): PageRead<z.infer<typeof faqRow>> => async ({ from, to }, signal) =>
      parseRows(faqRow, await client.from('faq_articles').select(FAQ_COLUMNS).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).order('sort_order').order('id').range(from, to).abortSignal(signal), signal),
    faqArticle(input: unknown, signal: AbortSignal) {
      return detail(input, async (id) => parseMaybeRow(faqRow, await client.from('faq_articles').select(FAQ_COLUMNS).eq('id', id).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).abortSignal(signal).maybeSingle(), signal));
    },
  };
}
