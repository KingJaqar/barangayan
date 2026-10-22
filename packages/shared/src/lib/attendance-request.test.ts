import { afterEach, describe, expect, it, vi } from 'vitest';
import { attendanceRequest } from './attendance-request';
afterEach(() => vi.useRealTimers());
describe('shared attendance deadline', () => {
  it('ends unresolved work at 15 seconds and aborts the transport', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const request = attendanceRequest(new AbortController().signal, value => {
      signal = value; return new Promise<never>(() => {});
    });
    const assertion = expect(request).rejects.toThrow('Attendance request ended.');
    await vi.advanceTimersByTimeAsync(15000); await assertion;
    expect(signal?.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels on parent abort and releases the deadline', async () => {
    vi.useFakeTimers(); const parent = new AbortController();
    const request = attendanceRequest(parent.signal, () => new Promise<never>(() => {}));
    const assertion = expect(request).rejects.toThrow(); parent.abort(); await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('settles exactly once and removes its timer after success', async () => {
    vi.useFakeTimers();
    expect(await attendanceRequest(new AbortController().signal, async () => 'confirmed')).toBe('confirmed');
    expect(vi.getTimerCount()).toBe(0);
  });
});
