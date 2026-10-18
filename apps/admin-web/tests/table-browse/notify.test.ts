import { beforeEach, describe, expect, it, vi } from 'vitest';

const sink = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), dismiss: vi.fn() }));
vi.mock('sonner', () => ({ toast: sink }));

beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); });

describe('independent admin notification adapter', () => {
  it('delivers an attempt once while allowing a later identical action', async () => {
    const { beginAttempt, notify } = await import('../../src/lib/notify');
    const id = beginAttempt('save');
    notify.success('Saved.', { id });
    notify.error('Late duplicate.', { id });
    notify.success('Saved.', { id: beginAttempt('save') });
    expect(sink.success).toHaveBeenCalledTimes(2);
    expect(sink.error).not.toHaveBeenCalled();
  });

  it('clears previous-account notices and rejects their pending outcomes', async () => {
    const { beginAttempt, notify, setNotificationSession } = await import('../../src/lib/notify');
    setNotificationSession('admin-a');
    const old = beginAttempt('write');
    const shown = notify.info('Account A');
    setNotificationSession('admin-b');
    notify.success('Late account A result.', { id: old });
    expect(sink.dismiss).toHaveBeenCalledWith(shown);
    expect(sink.success).not.toHaveBeenCalled();
  });

  it('keeps the deliberate sign-out outcome through the guest layout', async () => {
    const { beginAttempt, notify, setNotificationSession } = await import('../../src/lib/notify');
    setNotificationSession('admin');
    setNotificationSession(null);
    notify.success('Logged out', { id: beginAttempt('logout'), keepOnSessionChange: true });
    setNotificationSession(null);
    expect(sink.success).toHaveBeenCalledTimes(1);
    expect(sink.dismiss).not.toHaveBeenCalled();
  });

  it('deduplicates one observed event and uses the existing severity durations', async () => {
    const { eventId, notify } = await import('../../src/lib/notify');
    notify.warning('Not confirmed.', { id: eventId('payment', 'one') });
    notify.warning('Not confirmed.', { id: eventId('payment', 'one') });
    notify.error('Rejected.');
    notify.info('Information.');
    expect(sink.warning).toHaveBeenCalledExactlyOnceWith('Not confirmed.', expect.objectContaining({ duration: 6000 }));
    expect(sink.error).toHaveBeenCalledWith('Rejected.', expect.objectContaining({ duration: 8000 }));
    expect(sink.info).toHaveBeenCalledWith('Information.', expect.objectContaining({ duration: 4000 }));
  });

  it('pauses keyboard-focused notices without creating a new toast identity', async () => {
    const { notify, holdToast, releaseToast } = await import('../../src/lib/notify');
    const id = notify.success('Saved.')!;
    holdToast(id); holdToast(id); releaseToast(id);
    expect(sink.success).toHaveBeenCalledTimes(3);
    expect(sink.success.mock.calls.map(call => call[1].id)).toEqual([id, id, id]);
    expect(sink.success.mock.calls[1][1].duration).toBe(Infinity);
    expect(sink.success.mock.calls[2][1].duration).toBe(4000);
  });

  it('does not expose database diagnostic codes in popup copy', async () => {
    const { notify } = await import('../../src/lib/notify');
    notify.error('Update failed: PGRST301 JWT invalid', { description: 'SQLSTATE 42501' });
    expect(sink.error).toHaveBeenCalledWith('The action could not be completed. Review the details and try again.', expect.objectContaining({ description: undefined }));
    notify.error('Title cannot be empty.');
    expect(sink.error).toHaveBeenLastCalledWith('Title cannot be empty.', expect.any(Object));
  });
});
