import { afterEach, describe, expect, it, vi } from 'vitest';
import { attendanceRequest, readAttendance, readAttendanceReceipt, type AttendanceOperation } from '../../src/lib/household-attendance';

const holder = 'dfb20000-0000-4000-8000-000000000003';
const center = 'efb20000-0000-4000-8000-000000000001';
const stay = 'bfb20000-0000-4000-8000-000000000001';
const request = 'bfb20000-0000-4000-8000-000000000002';
const arrival = '2026-10-21T12:00:00Z';
const confirmation: AttendanceOperation = { requestId: request, householdId: holder, kind: 'check_in',
  centerId: center, centerName: 'Web Center', people: [{ memberId: null, name: 'Account holder', centerName: 'Web Center' }], participants: [{ kind: 'holder' }] };
const receipt = { request_id: request, household_profile_id: holder, operation: 'check_in',
  stays: [{ attendance_id: stay, kind: 'holder', member_id: null, center_id: center,
    checked_in_at: arrival, checked_out_at: null, outcome: 'created' }] };

afterEach(() => vi.useRealTimers());
describe('web attendance response and cancellation boundaries', () => {
  it('accepts only the requested household; malformed reads never become an empty roster', () => {
    expect(() => readAttendance(null, holder)).toThrow('Could not load attendance');
    expect(() => readAttendance({ household_profile_id: holder, people: [] }, holder)).toThrow();
    const data = { household_profile_id: holder, people: [{ kind: 'holder', member_id: null, relation: null, role: null,
      name: 'Holder', current_stay: null, latest_departure: null }] };
    expect(readAttendance(data, holder).people).toHaveLength(1);
    expect(() => readAttendance(data, 'dfb20000-0000-4000-8000-000000000004')).toThrow();
  });
  it('validates receipt correspondence, not only the shared response shape', () => {
    expect(readAttendanceReceipt(receipt, confirmation).stays[0].checked_in_at).toBe(arrival);
    for (const patch of [{ request_id: holder }, { household_profile_id: center }, { operation: 'check_out' }])
      expect(() => readAttendanceReceipt({ ...receipt, ...patch }, confirmation)).toThrow();
    expect(() => readAttendanceReceipt({ ...receipt, stays: [{ ...receipt.stays[0], center_id: holder }] }, confirmation)).toThrow();
    expect(() => readAttendanceReceipt({ ...receipt, stays: [{ ...receipt.stays[0], kind: 'member', member_id: holder }] }, confirmation)).toThrow();
  });
  it('an old departure response cannot acknowledge a different active stay', () => {
    const departure: AttendanceOperation = { requestId: request, householdId: holder, people: confirmation.people, kind: 'check_out', attendanceIds: [stay] };
    const closed = { ...receipt, operation: 'check_out', stays: [{ ...receipt.stays[0],
      checked_out_at: '2026-10-21T12:05:00Z', outcome: 'closed' }] };
    expect(readAttendanceReceipt(closed, departure).stays[0].attendance_id).toBe(stay);
    expect(() => readAttendanceReceipt(closed, { ...departure,
      attendanceIds: [holder] })).toThrow();
  });
  it('ends a hung operation at the deadline and releases its timer', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const result = attendanceRequest(new AbortController().signal, current => {
      signal = current; return new Promise<never>(() => {});
    });
    const rejected = expect(result).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(15000); await rejected;
    expect(signal?.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it('does not begin a write whose owner already closed or changed accounts', async () => {
    const owner = new AbortController(); owner.abort(); const write = vi.fn(() => Promise.resolve('committed'));
    await expect(attendanceRequest(owner.signal, write)).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
  });
  it('cleans up a settled deadline without aborting later unrelated work', async () => {
    vi.useFakeTimers(); const owner = new AbortController();
    await expect(attendanceRequest(owner.signal, () => Promise.resolve('done'))).resolves.toBe('done');
    expect(vi.getTimerCount()).toBe(0);
  });
});
