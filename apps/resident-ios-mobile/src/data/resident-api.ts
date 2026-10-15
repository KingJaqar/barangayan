import { DRIVE_TYPE_CONFIG, DRIVE_TYPES, driveRegistrationSchema, residentDriveRegistrationResultSchema, type Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';
import { checkWrite, containsPattern, parseCount, parseMaybeRow, parseRow, parseRows, quoteFilterValue } from './boundary';
import { DataError, toDataError } from './outcome';
import { readAll, type PageRead } from './pagination';
import {
  ANNOUNCEMENT_DETAIL_COLUMNS, ANNOUNCEMENT_LIST_COLUMNS, announcementDetailRow, announcementListRow, BARANGAY_COLUMNS, barangayRow,
  CENTER_COLUMNS, centerRow, createdRequestRow, DOCUMENT_COLUMNS, documentRow, DRIVE_COLUMNS, driveRegistrationRow, driveRow,
  EMERGENCY_INFORMATION_COLUMNS, emergencyInformationRow, FAQ_COLUMNS, faqRow, REQUEST_DETAIL_COLUMNS, REQUEST_LIST_COLUMNS,
  requestDetailRow, requestListRow, requestStatusRow, SITE_CONTENT_COLUMNS, siteContentRow,
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

export function residentApi(client: SupabaseClient<Database>, barangayId: string, userId?: string) {
  uuid.parse(barangayId);
  function owner() {
    const parsed = uuid.safeParse(userId);
    if (!parsed.success) throw new DataError('session');
    return parsed.data;
  }
  return {
    async barangay(signal: AbortSignal) {
      return parseRow(barangayRow, await client.from('barangays').select(BARANGAY_COLUMNS).eq('id', barangayId).abortSignal(signal).maybeSingle(), signal);
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

    /** B07 own requests, newest first with an id tie-break. */
    requests: (): PageRead<z.infer<typeof requestListRow>> => async ({ from, to }, signal) =>
      parseRows(requestListRow, await client.from('service_requests').select(REQUEST_LIST_COLUMNS).eq('resident_id', owner()).eq('barangay_id', barangayId).is('deleted_at', null).order('created_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal),
    request(input: unknown, signal: AbortSignal) {
      return detail(input, async (id) => parseMaybeRow(requestDetailRow, await client.from('service_requests').select(REQUEST_DETAIL_COLUMNS).eq('id', id).eq('resident_id', owner()).eq('barangay_id', barangayId).is('deleted_at', null).abortSignal(signal).maybeSingle(), signal));
    },
    /** Baseline direct insert kept until P08 moves submission to `submit_service_request` (plan B07). */
    async createRequest(documentTypeId: unknown, requesterNotes?: string) {
      const id = randomUUID();
      const resident = owner();
      const payload = { id, barangay_id: barangayId, resident_id: resident, document_type_id: routeId(documentTypeId), requester_notes: requesterNotes?.trim() || null };
      const inserted = await client.from('service_requests').insert(payload).select('id').single();
      if (!inserted.error) return parseRow(createdRequestRow, inserted);
      const failure = toDataError(inserted.error, { status: inserted.status, write: true });
      // A lost reply may follow a commit. The client-generated UUID makes this read an
      // authoritative reconciliation instead of a blind duplicate retry.
      const reconciled = await client.from('service_requests').select('id').eq('id', id).eq('resident_id', resident).eq('barangay_id', barangayId).maybeSingle();
      const existing = reconciled.error ? null : parseMaybeRow(createdRequestRow, reconciled);
      if (existing) return existing;
      throw failure;
    },
    async cancelRequest(id: unknown) {
      const requestId = routeId(id);
      const result = await client.rpc('cancel_own_service_request', { p_request_id: requestId, p_note: 'Cancelled by resident' });
      if (!result.error) return;
      const failure = toDataError(result.error, { status: result.status, write: true });
      const reconciled = await client.from('service_requests').select('status').eq('id', requestId).eq('resident_id', owner()).eq('barangay_id', barangayId).maybeSingle();
      if (!reconciled.error && parseMaybeRow(requestStatusRow, reconciled)?.status === 'cancelled') return;
      throw failure;
    },

    /** B12 announcements, newest first. */
    announcements: (): PageRead<z.infer<typeof announcementListRow>> => async ({ from, to }, signal) =>
      parseRows(announcementListRow, await client.from('announcements').select(ANNOUNCEMENT_LIST_COLUMNS).eq('barangay_id', barangayId).is('deleted_at', null).order('published_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal),
    announcement(input: unknown, signal: AbortSignal) {
      return detail(input, async (id) => parseMaybeRow(announcementDetailRow, await client.from('announcements').select(ANNOUNCEMENT_DETAIL_COLUMNS).eq('id', id).eq('barangay_id', barangayId).is('deleted_at', null).abortSignal(signal).maybeSingle(), signal));
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

    /** B16 active drives, soonest first. */
    drives: (search: string): PageRead<z.infer<typeof driveRow>> => async ({ from, to }, signal) => {
      let query = client.from('medical_drives').select(DRIVE_COLUMNS).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null);
      const filter = driveSearchFilter(search);
      if (filter) query = query.or(filter);
      return parseRows(driveRow, await query.order('drive_date').order('id').range(from, to).abortSignal(signal), signal);
    },
    drive(input: unknown, signal: AbortSignal) {
      return detail(input, async (id) => parseMaybeRow(driveRow, await client.from('medical_drives').select(DRIVE_COLUMNS).eq('id', id).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).abortSignal(signal).maybeSingle(), signal));
    },
    async registerForDrive(input: unknown) {
      const value = driveRegistrationSchema.parse(input);
      const result = await client.rpc('register_for_drive', {
        p_drive_id: value.driveId, p_age: value.age, p_is_pwd: value.isPwd, p_comorbidities: value.comorbidities,
        ...(value.priorDoseDate ? { p_prior_dose_date: value.priorDoseDate } : {}),
      });
      if (!result.error) return parseRow(residentDriveRegistrationResultSchema, result);
      const failure = toDataError(result.error, { status: result.status, write: true });
      const reconciled = await client.from('drive_registrations').select('id,applicant_number,status').eq('drive_id', value.driveId).eq('user_id', owner()).maybeSingle();
      const existing = reconciled.error ? null : parseMaybeRow(driveRegistrationRow, reconciled);
      if (existing) return { registration_id: existing.id, applicant_number: existing.applicant_number, status: existing.status };
      throw failure;
    },

    /** B13 public emergency information (guidelines/hotlines). Read whole: it is cached for offline use. */
    emergencyInformation: (signal: AbortSignal) => readAll(async ({ from, to }, pageSignal) =>
      parseRows(emergencyInformationRow, await client.from('emergency_information').select(EMERGENCY_INFORMATION_COLUMNS).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).order('sort_order').order('id').range(from, to).abortSignal(pageSignal), pageSignal), signal),
    /** B13 active evacuation centers. Read whole: it is cached for offline use. */
    centers: (signal: AbortSignal) => readAll(async ({ from, to }, pageSignal) =>
      parseRows(centerRow, await client.from('evacuation_centers').select(CENTER_COLUMNS).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).order('name').order('id').range(from, to).abortSignal(pageSignal), pageSignal), signal),

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
