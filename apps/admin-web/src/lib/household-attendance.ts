import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, HouseholdAttendance, HouseholdAttendanceParticipant, HouseholdAttendanceReceipt } from '@barangayan/shared';
import { householdAttendanceSchema, householdAttendanceReceiptSchema, householdAttendanceErrorMessage, householdAttendanceIdsSchema, householdAttendanceParticipantsSchema } from '@barangayan/shared';

export type AttendanceOperation = {
  requestId: string; householdId: string; people: { memberId: string | null; name: string; centerName: string }[];
} & ({ kind: 'check_in'; centerId: string; centerName: string; participants: HouseholdAttendanceParticipant[] }
  | { kind: 'check_out'; attendanceIds: string[] });
export const personKey = (person: HouseholdAttendance['people'][number]) => person.member_id ?? 'holder';
export const attendanceTime = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
}).format(new Date(value));

export function readAttendance(data: unknown, profileId: string): HouseholdAttendance {
  const parsed = householdAttendanceSchema.safeParse(data);
  if (!parsed.success || parsed.data.household_profile_id !== profileId) throw new Error(householdAttendanceErrorMessage(null, 'read'));
  return parsed.data;
}

export function readAttendanceReceipt(data: unknown, confirmation: AttendanceOperation): HouseholdAttendanceReceipt {
  const parsed = householdAttendanceReceiptSchema.safeParse(data);
  if (!parsed.success) throw new Error(householdAttendanceErrorMessage(null, 'mutation'));
  const receipt = parsed.data;
  if (receipt.request_id !== confirmation.requestId || receipt.household_profile_id !== confirmation.householdId
    || receipt.operation !== confirmation.kind) throw new Error(householdAttendanceErrorMessage(null, 'mutation'));
  const mismatch = confirmation.kind === 'check_in'
    ? receipt.stays.length !== confirmation.participants.length || receipt.stays.some(stay => stay.center_id !== confirmation.centerId
      || !confirmation.participants.some(person => (person.kind === 'holder' ? null : person.member_id) === stay.member_id))
    : receipt.stays.length !== confirmation.attendanceIds.length || receipt.stays.some(stay => !confirmation.attendanceIds.includes(stay.attendance_id));
  if (mismatch) throw new Error(householdAttendanceErrorMessage(null, 'mutation'));
  return receipt;
}

export { attendanceRequest } from '@barangayan/shared';

export async function attendanceActor(db: SupabaseClient<Database>, actorId: string, signal: AbortSignal) {
  const { data, error } = await db.auth.getUser();
  if (signal.aborted) throw new Error('Attendance request ended.');
  if (error || data.user?.id !== actorId) throw new Error('authentication_required');
}

export function prepareAttendanceOperation(household: HouseholdAttendance, selected: string[],
  kind: 'check_in' | 'check_out', center: { id: string; name: string } | undefined): AttendanceOperation {
  const people = household.people.filter(person => selected.includes(personKey(person)));
  if (!people.length || people.length !== selected.length) throw new Error('Choose at least one available person.');
  const base = { requestId: crypto.randomUUID(), householdId: household.household_profile_id,
    people: people.map(person => ({ memberId: person.member_id, name: person.name,
      centerName: person.current_stay?.center_name ?? center?.name ?? '' })) };
  if (kind === 'check_out') {
    const ids = people.map(person => person.current_stay?.attendance_id);
    if (ids.some(id => !id)) throw new Error('Select only people with an active stay for checkout.');
    return { ...base, kind, attendanceIds: householdAttendanceIdsSchema.parse(ids) };
  }
  if (!center) throw new Error('Choose an active evacuation center for arrivals.');
  if (people.some(person => person.current_stay && person.current_stay.center_id !== center.id))
    throw new Error('A selected person is checked in at another center. Check them out first.');
  const participants = householdAttendanceParticipantsSchema.parse(people.map(person => person.kind === 'holder'
    ? { kind: 'holder' as const } : { kind: 'member' as const, member_id: person.member_id }));
  return { ...base, kind, centerId: center.id, centerName: center.name, participants };
}
