import { describe, expect, it } from 'vitest';
import { householdAttendanceErrorMessage, householdAttendanceIdsSchema, householdAttendanceParticipantsSchema, householdAttendanceReceiptSchema, householdAttendanceSchema,
  householdQrPayloadSchema, householdQrTextSchema } from './household-attendance';

const id = 'ABCDEF00-0000-4000-8000-000000000001';
const qr = { type: 'household', version: '1.0', profileId: id };

describe('household QR boundary', () => {
  it('accepts canonical and legacy data and normalizes UUIDs', () => {
    expect(householdQrTextSchema.parse(JSON.stringify(qr))).toEqual({ ...qr, profileId: id.toLowerCase() });
    expect(householdQrPayloadSchema.parse({ type: 'household', profileId: id })).toEqual({ ...qr, profileId: id.toLowerCase() });
  });
  it.each([null, [], {}, { ...qr, type: 'EVACUATION_CENTER_CHECKIN' }, { ...qr, version: null },
    { ...qr, version: '2.0' }, { ...qr, version: 1 }, { ...qr, profileId: 'bad' }, { ...qr, barangay_id: id }])('rejects untrusted payload %j', (value) => {
    expect(householdQrPayloadSchema.safeParse(value).success).toBe(false);
  });
  it('rejects URLs and malformed JSON as data', () => {
    expect(householdQrTextSchema.safeParse('https://example.com').success).toBe(false);
    expect(householdQrTextSchema.safeParse('{').success).toBe(false);
  });
  it('enforces raw UTF-8 bytes before trimming, including multibyte whitespace', () => {
    const text = JSON.stringify(qr);
    expect(householdQrTextSchema.safeParse(text.padEnd(2048)).success).toBe(true);
    expect(householdQrTextSchema.safeParse(text.padEnd(2049)).success).toBe(false);
    expect(householdQrTextSchema.safeParse('\u3000'.repeat(700) + text).success).toBe(false);
  });
});

describe('attendance batch boundaries', () => {
  it('validates holder-only reads and rejects contradictory receipt identities', () => {
    expect(householdAttendanceSchema.safeParse({ household_profile_id: id, people: [
      { kind: 'holder', member_id: null, name: 'Resident', relation: null, role: null, current_stay: null, latest_departure: null },
    ] }).success).toBe(true);
    expect(householdAttendanceSchema.safeParse({ household_profile_id: id, people: [] }).success).toBe(false);
    const receipt = { request_id: id, operation: 'check_in', household_profile_id: id, stays: [
      { attendance_id: id, kind: 'member', member_id: null, center_id: id, checked_in_at: '2026-10-21T00:00:00Z', checked_out_at: null, outcome: 'created' },
    ] };
    expect(householdAttendanceReceiptSchema.safeParse(receipt).success).toBe(false);
    expect(householdAttendanceReceiptSchema.safeParse({ ...receipt, stays: [{ ...receipt.stays[0], kind: 'holder' }] }).success).toBe(true);
  });
  it('maps known failures and never displays raw unknown diagnostics', () => {
    expect(householdAttendanceErrorMessage({ message: 'attendance_active_elsewhere' }, 'mutation')).toContain('another center');
    expect(householdAttendanceErrorMessage({ message: 'SQL ERROR 55P03 secret identifier' }, 'mutation')).toBe('We could not confirm the result. Retry this confirmation to check its original result.');
    expect(householdAttendanceErrorMessage(null, 'read')).toBe('Could not load attendance. Reconnect and try again.');
    expect(householdAttendanceErrorMessage({ message: 'toString' }, 'read')).toBe('Could not load attendance. Reconnect and try again.');
  });
  it('deduplicates participants and normalizes member references', () => {
    expect(householdAttendanceParticipantsSchema.parse([{ kind: 'member', member_id: id },
      { kind: 'holder' }, { kind: 'member', member_id: id.toLowerCase() }])).toEqual([
      { kind: 'holder' }, { kind: 'member', member_id: id.toLowerCase() },
    ]);
    expect(householdAttendanceIdsSchema.parse([id, id.toLowerCase()])).toEqual([id.toLowerCase()]);
  });
  it.each(['check_in_household_members', 'check_out_household_attendance'])('explains a paused %s without suggesting immediate resubmission', (name) => {
    expect(householdAttendanceErrorMessage({ message: `permission denied for function ${name}` }, 'mutation'))
      .toBe('Attendance confirmation is temporarily unavailable. Ask barangay staff when to try again.');
    expect(householdAttendanceErrorMessage({ message: 'attendance_forbidden' }, 'mutation'))
      .toBe('You do not have permission to register this household.');
  });
  it.each([[], null, [{ kind: 'holder', member_id: id }], [{ kind: 'member' }], [{ kind: 'member', member_id: null }],
    [{ kind: 'member', member_id: id, checked_in_at: new Date().toISOString() }], Array.from({ length: 32 }, () => ({ kind: 'holder' }))])('rejects invalid selection %j', (value) => {
    expect(householdAttendanceParticipantsSchema.safeParse(value).success).toBe(false);
  });
  it('rejects null, empty and oversized checkout references', () => {
    for (const value of [[], [null], Array(32).fill(id)]) expect(householdAttendanceIdsSchema.safeParse(value).success).toBe(false);
  });
});
