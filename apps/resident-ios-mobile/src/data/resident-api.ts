import { driveRegistrationSchema, type Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';

export const uuid = z.string().uuid();
export function routeId(input: unknown) { return uuid.parse(input); }
export async function pages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, signal?: AbortSignal): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 100) {
    if (signal?.aborted) throw new Error('Read cancelled');
    const page = await read(offset, offset + 99);
    if (page.error) throw page.error;
    if (!page.data) throw new Error('Missing response');
    result.push(...page.data);
    if (page.data.length < 100) return result;
  }
}
export function residentApi(client: SupabaseClient<Database>, barangayId: string, userId?: string) {
  uuid.parse(barangayId);
  function owner() { return uuid.parse(userId); }
  return {
    async barangay(signal: AbortSignal) {
      const { data, error } = await client.from('barangays').select('id,name,boundary').eq('id', barangayId).abortSignal(signal).single();
      if (error) throw error;
      return data;
    },
    documents: (signal: AbortSignal) => pages((from, to) => client.from('document_types').select('*').eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).order('name').order('id').range(from, to).abortSignal(signal), signal),
    async document(id: unknown, signal: AbortSignal) {
      const { data, error } = await client.from('document_types').select('*').eq('id', routeId(id)).eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
    requests: (signal: AbortSignal) => pages((from, to) => client.from('service_requests').select('*,document_types(name)').eq('resident_id', owner()).eq('barangay_id', barangayId).is('deleted_at', null).order('created_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal),
    async request(id: unknown, signal: AbortSignal) {
      const { data, error } = await client.from('service_requests').select('*,document_types(name,fee_centavos),payments(*)').eq('id', routeId(id)).eq('resident_id', owner()).eq('barangay_id', barangayId).is('deleted_at', null).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
    async createRequest(documentTypeId: unknown, requesterNotes?: string) {
      const id = randomUUID();
      const payload = { id, barangay_id: barangayId, resident_id: owner(), document_type_id: routeId(documentTypeId), requester_notes: requesterNotes?.trim() || null };
      const { data, error } = await client.from('service_requests').insert(payload).select('*').single();
      if (!error && data) return data;
      // The response may be lost after commit. The client-generated UUID makes this
      // read an authoritative reconciliation instead of a blind duplicate retry.
      const reconciled = await client.from('service_requests').select('*').eq('id', id).eq('resident_id', owner()).eq('barangay_id', barangayId).maybeSingle();
      if (reconciled.data) return reconciled.data;
      throw error ?? reconciled.error ?? new Error('Request result unavailable');
    },
    async cancelRequest(id: unknown) {
      const requestId = routeId(id);
      const { error } = await client.rpc('cancel_own_service_request', { p_request_id: requestId, p_note: 'Cancelled by resident' });
      if (!error) return;
      const reconciled = await client.from('service_requests').select('status').eq('id', requestId).eq('resident_id', owner()).eq('barangay_id', barangayId).maybeSingle();
      if (reconciled.data?.status === 'cancelled') return;
      throw error;
    },
    announcements: (signal: AbortSignal) => pages((from, to) => client.from('announcements').select('*').eq('barangay_id', barangayId).is('deleted_at', null).order('published_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal),
    async announcement(id: unknown, signal: AbortSignal) {
      const { data, error } = await client.from('announcements').select('*').eq('id', routeId(id)).eq('barangay_id', barangayId).is('deleted_at', null).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
    async markAnnouncementRead(id: unknown) {
      const { error } = await client.from('announcement_reads').upsert({ announcement_id: routeId(id), resident_id: owner() }, { onConflict: 'announcement_id,resident_id' });
      if (error) throw error;
    },
    drives: (signal: AbortSignal) => pages((from, to) => client.from('medical_drives').select('*').eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).order('drive_date').order('id').range(from, to).abortSignal(signal), signal),
    registrations: (signal: AbortSignal) => pages((from, to) => client.from('drive_registrations').select('*,medical_drives(title,drive_date)').eq('user_id', owner()).order('created_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal),
    async registerForDrive(input: unknown) {
      const value = driveRegistrationSchema.parse(input);
      const result = await client.rpc('register_for_drive', {
        p_drive_id: value.driveId, p_age: value.age, p_is_pwd: value.isPwd, p_comorbidities: value.comorbidities,
        ...(value.priorDoseDate ? { p_prior_dose_date: value.priorDoseDate } : {}),
      });
      if (!result.error && result.data) return result.data;
      const reconciled = await client.from('drive_registrations').select('id,applicant_number,priority_score,status').eq('drive_id', value.driveId).eq('user_id', owner()).maybeSingle();
      if (reconciled.data) return { registration_id: reconciled.data.id, ...reconciled.data };
      throw result.error ?? reconciled.error ?? new Error('Registration result unavailable');
    },
    household: (signal: AbortSignal) => pages((from, to) => client.from('household_members').select('*').eq('profile_id', owner()).order('name').order('id').range(from, to).abortSignal(signal), signal),
    centers: (signal: AbortSignal) => pages((from, to) => client.from('evacuation_centers').select('*').eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).order('name').order('id').range(from, to).abortSignal(signal), signal),
    information: (signal: AbortSignal) => pages((from, to) => client.from('site_content').select('*').eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).order('sort_order').order('id').range(from, to).abortSignal(signal), signal),
    faq: (signal: AbortSignal) => pages((from, to) => client.from('faq_articles').select('*').eq('barangay_id', barangayId).eq('is_active', true).is('deleted_at', null).order('sort_order').order('id').range(from, to).abortSignal(signal), signal),
  };
}
