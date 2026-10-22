import { z } from 'zod';

export const HOUSEHOLD_QR_MAX_BYTES = 2048;
export const HOUSEHOLD_ATTENDANCE_MAX_PARTICIPANTS = 31;
const uuid = z.string().uuid().transform((value) => value.toLowerCase());

const canonicalHouseholdQrSchema = z.object({
  type: z.literal('household'),
  version: z.literal('1.0'),
  profileId: uuid,
}).strict();
const legacyHouseholdQrSchema = z.object({ type: z.literal('household'), profileId: uuid }).strict();

export const householdQrPayloadSchema = z.union([canonicalHouseholdQrSchema, legacyHouseholdQrSchema])
  .transform((value) => ({ ...value, version: '1.0' as const }));

// Count UTF-8 bytes, including replacement bytes for unpaired UTF-16 surrogates,
// without depending on a browser or native TextEncoder implementation.
function utf8Bytes(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes > HOUSEHOLD_QR_MAX_BYTES) return bytes;
  }
  return bytes;
}

export const householdQrTextSchema = z.string().superRefine((value, context) => {
  if (utf8Bytes(value) > HOUSEHOLD_QR_MAX_BYTES) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'This Family QR code is too large.' });
  }
}).transform((value, context): unknown => {
  try { return JSON.parse(value) as unknown; } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'This is not a valid Family QR code.' });
    return z.NEVER;
  }
}).pipe(householdQrPayloadSchema);

export const householdAttendanceParticipantSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('holder') }).strict(),
  z.object({ kind: z.literal('member'), member_id: uuid }).strict(),
]);
export const householdAttendanceParticipantsSchema = z.array(householdAttendanceParticipantSchema)
  .min(1).max(HOUSEHOLD_ATTENDANCE_MAX_PARTICIPANTS).transform((values) => {
    const key = (value: z.infer<typeof householdAttendanceParticipantSchema>) =>
      value.kind === 'holder' ? 'holder' : `member:${value.member_id}`;
    return [...new Map(values.map((value) => [key(value), value])).values()]
      .sort((a, b) => key(a).localeCompare(key(b)));
  });
export const householdAttendanceIdsSchema = z.array(uuid).min(1).max(HOUSEHOLD_ATTENDANCE_MAX_PARTICIPANTS)
  .transform((values) => [...new Set(values)].sort());

const timestamp = z.string().datetime({ offset: true });
export const householdAttendanceStaySchema = z.object({
  attendance_id: uuid,
  center_id: uuid,
  center_name: z.string(),
  checked_in_at: timestamp,
  checked_out_at: timestamp.nullable(),
}).strict().refine((stay) => stay.checked_out_at === null || Date.parse(stay.checked_out_at) >= Date.parse(stay.checked_in_at),
  'Departure cannot precede arrival.');
const personFields = {
  name: z.string(),
  current_stay: householdAttendanceStaySchema.nullable(),
  latest_departure: householdAttendanceStaySchema.nullable(),
};
export const householdAttendanceSchema = z.object({
  household_profile_id: uuid,
  people: z.array(z.discriminatedUnion('kind', [
    z.object({ ...personFields, kind: z.literal('holder'), member_id: z.null(), relation: z.null(), role: z.null() }).strict(),
    z.object({ ...personFields, kind: z.literal('member'), member_id: uuid, relation: z.string(), role: z.string().nullable() }).strict(),
  ])).min(1).max(HOUSEHOLD_ATTENDANCE_MAX_PARTICIPANTS),
}).strict().refine(({ people }) => people.filter((person) => person.kind === 'holder').length === 1
  && new Set(people.map((person) => person.member_id)).size === people.length
  && people.every((person) => (person.current_stay === null || person.current_stay.checked_out_at === null)
    && (person.latest_departure === null || person.latest_departure.checked_out_at !== null)), 'Invalid household attendance roster.');
export const householdAttendanceReceiptSchema = z.object({
  request_id: uuid,
  operation: z.enum(['check_in', 'check_out']),
  household_profile_id: uuid,
  stays: z.array(z.object({
    attendance_id: uuid,
    kind: z.enum(['holder', 'member']),
    member_id: uuid.nullable(),
    center_id: uuid,
    checked_in_at: timestamp,
    checked_out_at: timestamp.nullable(),
    outcome: z.enum(['created', 'already_active', 'closed', 'already_closed']),
  }).strict()).min(1).max(HOUSEHOLD_ATTENDANCE_MAX_PARTICIPANTS),
}).strict().refine((receipt) => new Set(receipt.stays.map((stay) => stay.attendance_id)).size === receipt.stays.length
  && (receipt.operation !== 'check_in'
    || (new Set(receipt.stays.map((stay) => stay.member_id)).size === receipt.stays.length
      && new Set(receipt.stays.map((stay) => stay.center_id)).size === 1))
  && receipt.stays.every((stay) => (stay.kind === 'holder') === (stay.member_id === null)
    && (receipt.operation === 'check_in'
      ? ['created', 'already_active'].includes(stay.outcome) && stay.checked_out_at === null
      : ['closed', 'already_closed'].includes(stay.outcome) && stay.checked_out_at !== null)
    && (stay.checked_out_at === null || Date.parse(stay.checked_out_at) >= Date.parse(stay.checked_in_at))), 'Invalid attendance receipt.');

export type HouseholdQrPayload = z.infer<typeof householdQrPayloadSchema>;
export type HouseholdAttendanceParticipant = z.infer<typeof householdAttendanceParticipantSchema>;
export type HouseholdAttendance = z.infer<typeof householdAttendanceSchema>;
export type HouseholdAttendanceReceipt = z.infer<typeof householdAttendanceReceiptSchema>;

const attendanceErrors: Readonly<Record<string, string>> = {
  authentication_required: 'Your session ended. Sign in again.',
  attendance_forbidden: 'You do not have permission to register this household.',
  invalid_household_qr: "This is not a valid Family QR code. Scan the household's Family code.",
  household_unavailable: 'This household is unavailable. Choose a resident again or ask barangay staff.',
  invalid_attendance_selection: 'Choose at least one person from this household, then try again.',
  household_roster_changed: 'The family list changed. Reload it and choose the people again.',
  attendance_center_unavailable: 'This center is unavailable for arrivals. Choose an active center.',
  attendance_active_elsewhere: 'A selected person is already checked in at another center. Check them out first.',
  attendance_request_conflict: 'This confirmation no longer matches the original request. Reload before confirming again.',
  attendance_lifecycle_conflict: 'Check out active stays before removing this person or changing this household or center.',
  'permission denied for function check_in_household_members': 'Attendance confirmation is temporarily unavailable. Ask barangay staff when to try again.',
  'permission denied for function check_out_household_attendance': 'Attendance confirmation is temporarily unavailable. Ask barangay staff when to try again.',
};

/** Unknown diagnostics are never used as display copy, including unconfirmed writes. */
export function householdAttendanceErrorMessage(error: { message?: string } | null, operation: 'read' | 'mutation'): string {
  const known = error?.message && Object.prototype.hasOwnProperty.call(attendanceErrors, error.message)
    ? attendanceErrors[error.message] : undefined;
  return known ?? (operation === 'read'
    ? 'Could not load attendance. Reconnect and try again.'
    : 'We could not confirm the result. Retry this confirmation to check its original result.');
}
