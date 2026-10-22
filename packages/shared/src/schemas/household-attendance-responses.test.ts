import { describe, expect, it } from 'vitest';
import { householdAttendanceReceiptSchema, householdAttendanceSchema } from './household-attendance';

const id = (n: number) => `dfa30000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const arrival = '2026-10-21T00:00:00Z';
const departure = '2026-10-21T01:00:00Z';
const stay = { attendance_id: id(1), center_id: id(2), center_name: 'Center', checked_in_at: arrival, checked_out_at: null };
const holder = { kind: 'holder', member_id: null, name: 'Resident', relation: null, role: null, current_stay: stay, latest_departure: null };
const member = { ...holder, kind: 'member', member_id: id(3), relation: 'child' };
const read = (people: unknown[]) => ({ household_profile_id: id(4), people });
const receiptStay = { attendance_id: id(1), center_id: id(2), kind: 'holder', member_id: null, checked_in_at: arrival, checked_out_at: null, outcome: 'created' };
const receipt = { request_id: id(5), operation: 'check_in', household_profile_id: id(4), stays: [receiptStay] };

describe('attendance response trust boundary', () => {
  it('accepts a holder and member read with a separate latest departure', () => {
    expect(householdAttendanceSchema.safeParse(read([holder, { ...member, current_stay: null,
      latest_departure: { ...stay, checked_out_at: departure } }])).success).toBe(true);
  });

  it.each([
    [member], [holder, holder], [holder, member, member],
    [{ ...holder, member_id: id(3) }], [holder, { ...member, member_id: null }],
    [{ ...holder, current_stay: { ...stay, checked_out_at: departure } }],
    [{ ...holder, latest_departure: stay }],
    [{ ...holder, latest_departure: { ...stay, checked_out_at: '2026-10-20T00:00:00Z' } }],
  ])('rejects missing/duplicate identities and contradictory read state %#', (...people) => {
    expect(householdAttendanceSchema.safeParse(read(people)).success).toBe(false);
  });

  it.each([
    { operation: 'check_out' },
    { stays: [{ ...receiptStay, outcome: 'closed' }] },
    { stays: [{ ...receiptStay, checked_out_at: departure }] },
    { stays: [receiptStay, receiptStay] },
    { stays: [receiptStay, { ...receiptStay, attendance_id: id(6) }] },
    { stays: [receiptStay, { ...receiptStay, attendance_id: id(6), kind: 'member', member_id: id(3), center_id: id(7) }] },
    { stays: [{ ...receiptStay, kind: 'member', member_id: id(3) },
      { ...receiptStay, kind: 'member', member_id: id(3), attendance_id: id(6) }] },
    { operation: 'check_out', stays: [{ ...receiptStay, outcome: 'closed', checked_out_at: '2026-10-20T00:00:00Z' }] },
  ])('rejects contradictory operation receipts %#', (patch) => {
    expect(householdAttendanceReceiptSchema.safeParse({ ...receipt, ...patch }).success).toBe(false);
  });

  it('accepts both arrival outcomes and both departure outcomes', () => {
    for (const outcome of ['created', 'already_active']) {
      expect(householdAttendanceReceiptSchema.safeParse({ ...receipt, stays: [{ ...receiptStay, outcome }] }).success).toBe(true);
    }
    for (const outcome of ['closed', 'already_closed']) {
      expect(householdAttendanceReceiptSchema.safeParse({ ...receipt, operation: 'check_out',
        stays: [{ ...receiptStay, outcome, checked_out_at: departure }] }).success).toBe(true);
    }
  });

  it('allows checkout receipts for different historical visits by the same person', () => {
    const closed = { ...receiptStay, outcome: 'already_closed', checked_out_at: departure };
    expect(householdAttendanceReceiptSchema.safeParse({ ...receipt, operation: 'check_out',
      stays: [closed, { ...closed, attendance_id: id(6) }] }).success).toBe(true);
  });
});
