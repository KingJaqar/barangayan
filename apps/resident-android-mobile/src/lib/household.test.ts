import { afterEach, describe, expect, it, vi } from 'vitest';
import { attendanceTime, householdRequest, readHouseholdMembers, saveHouseholdMembers } from './household';
const transport = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: transport }));

const member = { id: '11111111-1111-4111-8111-111111111111', name: 'Ada', relation: 'Child' };
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

describe('resident household boundary', () => {
  it('refuses partial, duplicate, oversized or malformed rosters before writing', async () => {
    for (const value of [[member, null], [member, member], Array.from({ length: 31 }, () => member), [{ ...member, id: 'invalid' }], { roster: [] }]) {
      expect(() => readHouseholdMembers(value)).toThrow('could not be read');
    }
    await expect(saveHouseholdMembers([{ ...member, name: ' ' }], [])).rejects.toThrow();
    expect(transport.rpc).not.toHaveBeenCalled();
  });
  it('uses the exact raw snapshot and validates the normalized saved result', async () => {
    const expected = [{ ...member, role: null, retained: 'legacy' }];
    transport.rpc.mockReturnValue({ abortSignal: vi.fn().mockResolvedValue({ data: [member], error: null }) });
    const result = await saveHouseholdMembers([{ ...member, name: ' Ada ' }], expected);
    expect(transport.rpc).toHaveBeenCalledExactlyOnceWith('save_resident_household_if_unchanged', { p_members: [member], p_expected: expected });
    expect(result.members).toEqual([member]);
    transport.rpc.mockReturnValue({ abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }) });
    await expect(saveHouseholdMembers([member], [])).rejects.toThrow('Could not confirm');
  });
  it('shows plain stale-editor and active-person removal messages without leaking diagnostics', async () => {
    for (const [error, message] of [
      [{ code: 'PT409', message: 'resident_household_changed' }, 'changed elsewhere'],
      [{ code: 'PT409', message: 'attendance_lifecycle_conflict' }, 'checked in'],
      [{ code: '42501', message: 'secret SQL diagnostics' }, 'Could not confirm'],
    ] as const) {
      transport.rpc.mockReturnValue({ abortSignal: vi.fn().mockResolvedValue({ data: null, error }) });
      await expect(saveHouseholdMembers([member], [])).rejects.toThrow(message);
    }
  });
  it('ends hung SDK waits, aborts transport, and never automatically retries', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const work = vi.fn((abort: AbortSignal) => { signal = abort; return new Promise<never>(() => {}); });
    const request = householdRequest(work);
    const outcome = expect(request).rejects.toThrow('Reload');
    await vi.advanceTimersByTimeAsync(15_000);
    await outcome;
    expect(signal?.aborted).toBe(true);
    expect(work).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not start a request cancelled before dispatch and removes successful deadline timers', async () => {
    vi.useFakeTimers();
    const controller = new AbortController(); controller.abort();
    const work = vi.fn(async () => true);
    await expect(householdRequest(work, controller.signal)).rejects.toThrow();
    expect(work).not.toHaveBeenCalled();
    await expect(householdRequest(work)).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('uses Manila dates across UTC midnight', () => {
    expect(attendanceTime('2026-10-21T20:00:00Z')).toContain('22');
    expect(attendanceTime('2026-10-21T20:00:00Z')).toContain('4:00');
  });
});
