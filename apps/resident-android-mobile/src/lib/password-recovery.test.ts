import { afterEach, describe, expect, it, vi } from 'vitest';

import { PasswordRecoveryFlow, recoveryErrorMessage } from './password-recovery';
import { authSetupRequests } from './setup-request';

const account = { id: 'resident-a', email: 'resident@example.test' };
const validPassword = 'ChangedPassword1!';
function fixture() {
  const session = { user: account, access_token: 'verified-recovery-session' };
  const auth = {
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { user: account, session }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: account }, error: null }),
  };
  const flow = new PasswordRecoveryFlow(auth as unknown as ConstructorParameters<typeof PasswordRecoveryFlow>[0]);
  return { auth, flow, session };
}
afterEach(() => { vi.useRealTimers(); });

describe('password recovery from login and signed-in Settings', () => {
  it.each([null, account])('sends, verifies a recovery code, and writes only the verified session (%s)', async (owner) => {
    const { auth, flow } = fixture();
    expect(await flow.send('  Resident@Example.test  ', owner)).toBe(account.email);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(account.email);
    await flow.verify(account.email, '123456', owner);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: account.email, type: 'recovery', token: '123456' });
    await flow.update(validPassword, validPassword);
    expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: validPassword });
    await expect(flow.update(validPassword, validPassword)).rejects.toThrow('Verify your reset code');
  });

  it('rejects malformed email and attempts to recover another account before calling Auth', async () => {
    const { auth, flow } = fixture();
    await expect(flow.send('bad-email')).rejects.toThrow('valid email');
    await expect(flow.send('other@example.test', account)).rejects.toThrow('signed-in account');
    await expect(flow.verify('other@example.test', '123456', account)).rejects.toThrow('signed-in account');
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('requires six digits and rejects wrong or expired codes without unlocking the write', async () => {
    const { auth, flow } = fixture();
    await expect(flow.verify(account.email, 'abcdef')).rejects.toThrow('6-digit');
    auth.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: new Error('Token has expired or is invalid') });
    await expect(flow.verify(account.email, '000000')).rejects.toThrow('expired');
    await expect(flow.update(validPassword, validPassword)).rejects.toThrow('Verify your reset code');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('does not use an already signed-in session as recovery proof', async () => {
    const { auth, flow } = fixture();
    await flow.send(account.email, account);
    await expect(flow.update(validPassword, validPassword)).rejects.toThrow('Verify your reset code');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('rejects a successful verify response with no session or the wrong account', async () => {
    const { auth, flow, session } = fixture();
    auth.verifyOtp.mockResolvedValueOnce({ data: { user: account, session: null }, error: null });
    await expect(flow.verify(account.email, '123456', account)).rejects.toThrow('could not be confirmed');
    auth.verifyOtp.mockResolvedValueOnce({ data: { user: { ...account, id: 'other' }, session }, error: null });
    await expect(flow.verify(account.email, '123456', account)).rejects.toThrow('could not be confirmed');
    await expect(flow.update(validPassword, validPassword)).rejects.toThrow('Verify your reset code');
  });

  it.each([null, { user: { ...account, id: 'other' }, access_token: 'verified-recovery-session' }, { user: account, access_token: 'different-session' }])('rejects missing, changed, or expired sessions (%s)', async (session) => {
    const { auth, flow } = fixture();
    await flow.verify(account.email, '123456', account);
    auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    await expect(flow.update(validPassword, validPassword)).rejects.toThrow('changed or expired');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'resend'])('clears verification when the resident chooses %s', async (action) => {
    const { auth, flow } = fixture();
    await flow.verify(account.email, '123456');
    if (action === 'cancel') flow.clear();
    else await flow.send(account.email);
    await expect(flow.update(validPassword, validPassword)).rejects.toThrow('Verify your reset code');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('enforces password length, complexity, and matching confirmation before writing', async () => {
    const { auth, flow } = fixture();
    await flow.verify(account.email, '123456');
    await expect(flow.update('short', 'short')).rejects.toThrow('8 characters');
    await expect(flow.update('longpassword', 'longpassword')).rejects.toThrow('uppercase');
    await expect(flow.update(validPassword, 'Different1!')).rejects.toThrow("don't match");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('releases busy state after send, verify, and write failures so the resident can retry', async () => {
    const { auth, flow } = fixture();
    auth.resetPasswordForEmail.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(flow.send(account.email)).rejects.toThrow('Network');
    expect(authSetupRequests.busy).toBe(false);
    await flow.send(account.email);
    auth.verifyOtp.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(flow.verify(account.email, '123456')).rejects.toThrow('Network');
    expect(authSetupRequests.busy).toBe(false);
    await flow.verify(account.email, '123456');
    auth.updateUser.mockResolvedValueOnce({ data: {}, error: new Error('Rate limit exceeded') });
    await expect(flow.update(validPassword, validPassword)).rejects.toThrow('Rate limit');
    expect(authSetupRequests.busy).toBe(false);
    await flow.update(validPassword, validPassword);
    expect(auth.updateUser).toHaveBeenCalledTimes(2);
  });

  it('blocks concurrent recovery requests', async () => {
    const { auth, flow } = fixture();
    let finish!: (value: unknown) => void;
    auth.resetPasswordForEmail.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const request = flow.send(account.email);
    await expect(flow.send(account.email)).rejects.toThrow('earlier request');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    finish({ error: null });
    await request;
  });

  it('does not start a password write after a timed-out session check finishes late', async () => {
    vi.useFakeTimers();
    const { auth, flow, session } = fixture();
    await flow.verify(account.email, '123456');
    let finish!: (value: unknown) => void;
    auth.getSession.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const request = flow.update(validPassword, validPassword);
    const failure = expect(request).rejects.toThrow('longer than expected');
    await vi.advanceTimersByTimeAsync(30_001);
    await failure;
    finish({ data: { session }, error: null });
    await vi.advanceTimersByTimeAsync(1);
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(authSetupRequests.busy).toBe(false);
  });

  it('shows service errors and a useful fallback for unexpected failures', () => {
    expect(recoveryErrorMessage({ message: 'Too many requests' })).toBe('Too many requests');
    expect(recoveryErrorMessage(null)).toBe('Check your connection and try again.');
  });
});
