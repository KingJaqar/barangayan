import { afterEach, describe, expect, it, vi } from 'vitest';
import { SetupOwner, SetupRequestGate, SetupTimeout, SetupWriteBoundary, readResendDeadline, resendSeconds } from './setup-request';

afterEach(() => vi.useRealTimers());
describe('setup transport ownership', () => {
  it('ends the UI wait but holds the mutation lock until the transport settles', async () => {
    vi.useFakeTimers(); const gate = new SetupRequestGate();
    let resolve!: (v: string) => void;
    const result = gate.run(() => new Promise<string>(r => { resolve = r; }), 30);
    const rejected = expect(result).rejects.toBeInstanceOf(SetupTimeout);
    await vi.advanceTimersByTimeAsync(31); await rejected;
    expect(gate.busy).toBe(true);
    const next = vi.fn(); await expect(gate.run(next)).rejects.toThrow('still finishing'); expect(next).not.toHaveBeenCalled();
    resolve('late commit'); await vi.advanceTimersByTimeAsync(0); expect(gate.busy).toBe(false);
    await expect(gate.run(async () => 'reconciled')).resolves.toBe('reconciled');
  });
  it('holds the same lock across unmount/attempt changes and releases on rejection', async () => {
    const gate = new SetupRequestGate(), owner = new SetupOwner(); const owns = owner.ticket();
    let reject!: (v: Error) => void;
    const result = gate.run(() => new Promise((_r, r) => { reject = r; }));
    await Promise.resolve(); owner.invalidate(); expect(owns()).toBe(false); expect(owner.ticket()()).toBe(true);
    await expect(gate.run(async () => 2)).rejects.toThrow();
    reject(new Error('offline')); await expect(result).rejects.toThrow('offline'); expect(gate.busy).toBe(false);
  });
  it('recomputes persisted cooldown after foreground/restart without persisting email', () => {
    expect(readResendDeadline('60000',0)).toBe(60000);
    expect(resendSeconds(60000,1001)).toBe(59);
    expect(resendSeconds(60000,65000)).toBe(0);
    for (const value of [null,'corrupt','Infinity','-1','60001']) expect(readResendDeadline(value,0)).toBe(0);
  });
});

describe('password write boundary', () => {
  it('does not report a possibly saved password when the status read fails', async () => {
    const gate = new SetupRequestGate(), boundary = new SetupWriteBoundary();
    const updatePassword = vi.fn();
    await expect(gate.run(async () => {
      await Promise.reject(new TypeError('offline'));
      boundary.begin(); await updatePassword();
    })).rejects.toThrow('offline');
    boundary.close();
    expect(boundary.started).toBe(false);
    expect(updatePassword).not.toHaveBeenCalled();
    expect(gate.busy).toBe(false);
  });
  it('prevents a late successful status read from starting a write after timeout', async () => {
    vi.useFakeTimers();
    const gate = new SetupRequestGate(), boundary = new SetupWriteBoundary();
    let finishRead!: () => void;
    const updatePassword = vi.fn();
    const result = gate.run(async () => {
      await new Promise<void>(resolve => { finishRead = resolve; });
      boundary.begin(); await updatePassword();
    }, 30).finally(() => boundary.close());
    const rejected = expect(result).rejects.toBeInstanceOf(SetupTimeout);
    await vi.advanceTimersByTimeAsync(31); await rejected;
    expect(boundary.started).toBe(false);
    expect(gate.busy).toBe(true);
    finishRead(); await vi.advanceTimersByTimeAsync(0);
    expect(updatePassword).not.toHaveBeenCalled();
    expect(gate.busy).toBe(false);
  });
  it('retains uncertainty and the mutation lock when the write itself times out', async () => {
    vi.useFakeTimers();
    const gate = new SetupRequestGate(), boundary = new SetupWriteBoundary();
    let finishWrite!: () => void;
    const result = gate.run(async () => {
      boundary.begin();
      await new Promise<void>(resolve => { finishWrite = resolve; });
    }, 30).finally(() => boundary.close());
    const rejected = expect(result).rejects.toBeInstanceOf(SetupTimeout);
    await vi.advanceTimersByTimeAsync(31); await rejected;
    expect(boundary.started).toBe(true);
    expect(gate.busy).toBe(true);
    finishWrite(); await vi.advanceTimersByTimeAsync(0);
    expect(gate.busy).toBe(false);
    expect(boundary.started).toBe(true);
  });
});
