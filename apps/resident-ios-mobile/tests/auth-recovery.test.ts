import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from '../src/auth/login-error';
import { pendingDestination, returnPath, safeReturnPath } from '../src/auth/pending-destination';
import { RecoveryFlow, recoveryErrorMessage } from '../src/auth/recovery-flow';
import { authRequests, Ownership, readResendDeadline, RequestGate, resendSeconds, SetupTimeout, WriteBoundary } from '../src/auth/request-gate';

type Auth = ConstructorParameters<typeof RecoveryFlow>[0];
const USER = { id: 'u1', email: 'resident@example.com' };

function fakeAuth(overrides: { verifyUser?: { id: string }; sessionToken?: string; verifyError?: object | null; updateError?: object | null } = {}) {
  const calls: string[] = [];
  let token = 'token-1';
  const auth = {
    resetPasswordForEmail: async (email: string) => { calls.push(`reset:${email}`); return { data: {}, error: null }; },
    verifyOtp: async (input: { email: string; token: string; type: string }) => {
      calls.push(`verify:${input.type}:${input.email}:${input.token}`);
      if (overrides.verifyError) return { data: { session: null, user: null }, error: overrides.verifyError };
      return { data: { session: { access_token: token, user: overrides.verifyUser ?? { id: 'u1' } }, user: overrides.verifyUser ?? { id: 'u1' } }, error: null };
    },
    getSession: async () => ({ data: { session: { access_token: overrides.sessionToken ?? token, user: { id: 'u1' } } }, error: null }),
    updateUser: async (input: { password: string }) => { calls.push(`update:${input.password}`); return { data: {}, error: overrides.updateError ?? null }; },
  };
  return { calls, auth: auth as unknown as Auth, rotate: () => { token = 'token-2'; } };
}

describe('password recovery flow (P04-T05, A07)', () => {
  it('requires a verified code for the same session before a new password is written', async () => {
    const { auth, calls } = fakeAuth();
    const flow = new RecoveryFlow(auth);
    await expect(flow.update('Str0ng!pass', 'Str0ng!pass')).rejects.toThrow(/Verify your reset code/);
    expect(await flow.send(' Resident@Example.com ', null)).toBe('resident@example.com');
    await flow.verify('resident@example.com', '123456');
    expect(flow.isVerified).toBe(true);
    await flow.update('Str0ng!pass', 'Str0ng!pass');
    expect(flow.isVerified).toBe(false);
    expect(calls).toEqual(['reset:resident@example.com', 'verify:recovery:resident@example.com:123456', 'update:Str0ng!pass']);
  });

  it('validates the password locally before any request', async () => {
    const { auth, calls } = fakeAuth();
    const flow = new RecoveryFlow(auth);
    await flow.verify('resident@example.com', '123456');
    await expect(flow.update('short', 'short')).rejects.toThrow(/at least 8/);
    await expect(flow.update('alllowercase1', 'alllowercase1')).rejects.toThrow(/uppercase letter/);
    await expect(flow.update('Str0ng!pass', 'Different1!')).rejects.toThrow(/match/);
    expect(calls.filter((call) => call.startsWith('update'))).toEqual([]);
  });

  it('rejects malformed email or code and a signed-in account using another address', async () => {
    const { auth, calls } = fakeAuth();
    const flow = new RecoveryFlow(auth);
    await expect(flow.send('not-an-email')).rejects.toThrow(/valid email/);
    await expect(flow.send('other@example.com', USER)).rejects.toThrow(/signed-in account/);
    await expect(flow.verify('resident@example.com', '12345')).rejects.toThrow(/six-digit/);
    await expect(flow.verify('other@example.com', '123456', USER)).rejects.toThrow(/signed-in account/);
    expect(calls).toEqual([]);
  });

  it('does not accept a recovery session for a different account than the signed-in one', async () => {
    const { auth } = fakeAuth({ verifyUser: { id: 'someone-else' } });
    const flow = new RecoveryFlow(auth);
    await expect(flow.verify('resident@example.com', '123456', USER)).rejects.toThrow(/could not be confirmed/);
    expect(flow.isVerified).toBe(false);
  });

  it('refuses the write when the verified session changed or expired', async () => {
    const { auth, calls, rotate } = fakeAuth();
    const flow = new RecoveryFlow(auth);
    await flow.verify('resident@example.com', '123456');
    rotate();
    await expect(flow.update('Str0ng!pass', 'Str0ng!pass')).rejects.toThrow(/changed or expired/);
    expect(flow.isVerified).toBe(false);
    expect(calls.some((call) => call.startsWith('update'))).toBe(false);
  });

  it('keeps the verified state when the password write fails so it can be retried', async () => {
    const { auth } = fakeAuth({ updateError: { code: 'weak_password' } });
    const flow = new RecoveryFlow(auth);
    await flow.verify('resident@example.com', '123456');
    await expect(flow.update('Str0ng!pass', 'Str0ng!pass')).rejects.toMatchObject({ code: 'weak_password' });
    expect(flow.isVerified).toBe(true);
  });

  it('maps failures to resident-safe copy without raw provider text', () => {
    expect(recoveryErrorMessage({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toMatch(/invalid or expired/);
    expect(recoveryErrorMessage({ status: 429 })).toMatch(/wait/);
    expect(recoveryErrorMessage({ code: 'same_password' })).toMatch(/different/);
    expect(recoveryErrorMessage(new Error('Enter a valid email address.'))).toBe('Enter a valid email address.');
    const raw = Object.assign(new Error('SQL: select * from auth.users'), { name: 'AuthApiError', status: 500, code: 'unexpected_failure' });
    expect(recoveryErrorMessage(raw)).not.toMatch(/SQL|auth\.users/);
  });
});

describe('request gate, ownership and resend timing (P04-T02, F04/F06)', () => {
  it('runs one mutation at a time and releases the gate after the transport ends, not after a timeout', async () => {
    const gate = new RequestGate();
    let release!: () => void;
    const slow = gate.run(() => new Promise<void>((resolve) => { release = resolve; }), 5);
    await expect(slow).rejects.toBeInstanceOf(SetupTimeout);
    // The watchdog ended the wait; the transport still owns the gate.
    expect(gate.busy).toBe(true);
    await expect(gate.run(async () => 1)).rejects.toThrow(/still finishing/);
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(gate.busy).toBe(false);
    await expect(gate.run(async () => 2)).resolves.toBe(2);
  });

  it('shares one module gate for identity writes', () => {
    expect(authRequests.busy).toBe(false);
  });

  it('closes the write boundary when the wait ends', () => {
    const boundary = new WriteBoundary();
    boundary.begin();
    expect(boundary.started).toBe(true);
    boundary.close();
    expect(() => boundary.begin()).toThrow(/after the wait ended/);
  });

  it('invalidates tickets of earlier owners', () => {
    const owner = new Ownership();
    const first = owner.ticket();
    expect(first()).toBe(true);
    owner.invalidate();
    expect(first()).toBe(false);
    expect(owner.ticket()()).toBe(true);
  });

  it('counts down and ignores corrupt or far-future resend deadlines', () => {
    expect(resendSeconds(10_500, 10_000)).toBe(1);
    expect(resendSeconds(5000, 10_000)).toBe(0);
    expect(readResendDeadline(String(10_000 + 30_000), 10_000)).toBe(40_000);
    expect(readResendDeadline(String(10_000 + 10 * 60_000), 10_000)).toBe(0);
    expect(readResendDeadline('abc', 10_000)).toBe(0);
    expect(readResendDeadline(null, 10_000)).toBe(0);
  });
});

describe('pending destination allowlist (P04-T01, B.2 rule 4)', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  it('keeps only allowlisted private paths with valid ids and drops query and hash', () => {
    expect(pendingDestination(`/request/${id}?token=secret#x`)).toEqual({ v: 1, path: `/request/${id}` });
    expect(pendingDestination('/requests/')).toEqual({ v: 1, path: '/requests' });
    expect(pendingDestination('/settings/change-password')).toEqual({ v: 1, path: '/settings/change-password' });
  });

  it('rejects foreign, malformed and credential-bearing destinations', () => {
    for (const bad of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '/request/not-a-uuid', '/auth/login', '/home', '/services/request/', '/request/' + id + '/x', '/\\evil', null, undefined, '']) {
      expect(pendingDestination(bad as string)).toBeNull();
    }
    expect(safeReturnPath('//evil.example')).toBe('/home');
    expect(safeReturnPath(`/health/register/${id}`)).toBe(`/health/register/${id}`);
  });

  it('returns Home when nothing is pending', () => {
    expect(returnPath(null)).toBe('/home');
    expect(returnPath({ v: 1, path: '/requests' })).toBe('/requests');
  });
});

describe('login errors (A05-005)', () => {
  it('cannot distinguish an unknown email from a wrong password and never leaks provider text', () => {
    expect(loginErrorMessage({ code: 'invalid_credentials' })).toBe('Email or password is incorrect.');
    expect(loginErrorMessage({ code: 'email_not_confirmed' })).toMatch(/Verify your email/);
    expect(loginErrorMessage({ status: 429 })).toMatch(/Too many/);
    expect(loginErrorMessage({ name: 'AuthRetryableFetchError' })).toMatch(/connect/);
    expect(loginErrorMessage(new Error('relation "auth.users" does not exist'))).toBe('Unable to log in right now. Please try again.');
  });
});
