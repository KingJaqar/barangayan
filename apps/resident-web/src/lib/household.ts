import { z } from 'zod';
import { householdAttendanceSchema, type HouseholdAttendance, type Json } from '@barangayan/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const memberSchema = z.object({
  id: z.string().uuid().transform(value => value.toLowerCase()),
  name: z.string().trim().min(1).max(200),
  relation: z.string().trim().min(1).max(100),
  role: z.string().nullable().optional().transform(value => value?.trim() || undefined)
    .pipe(z.string().max(50).optional()),
});
const rosterSchema = z.array(memberSchema).max(30).refine(
  members => new Set(members.map(member => member.id)).size === members.length,
);
export type HouseholdMember = z.infer<typeof memberSchema>;

/** Keep the original JSON separately: display trimming and UUID casing are not a CAS snapshot. */
export function readHouseholdRoster(raw: Json): { raw: Json; members: HouseholdMember[] } {
  return { raw, members: rosterSchema.parse(raw === null ? [] : raw) };
}

export function readHouseholdAttendance(raw: unknown, profileId: string): HouseholdAttendance {
  const value = householdAttendanceSchema.parse(raw);
  if (value.household_profile_id !== profileId) throw new Error('Invalid household response.');
  return value;
}

export const householdTime = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
}).format(new Date(value));

export async function residentHouseholdProfile(profileId: string, signal: AbortSignal) {
  const db = createSupabaseBrowserClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (signal.aborted) throw new Error('Request ended.');
  if (error || !user || user.is_anonymous || user.id !== profileId) throw new Error('resident_identity_required');
  const result = await db.from('profiles').select('id,role,deleted_at,household_members')
    .eq('id', profileId).retry(false).abortSignal(signal).single();
  if (result.error) throw new Error('Could not load household.');
  if (!result.data || result.data.id !== profileId || result.data.role !== 'resident' || result.data.deleted_at)
    throw new Error('resident_identity_required');
  return result.data;
}
