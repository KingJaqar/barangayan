import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';

const fx = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  auth: { getUser: vi.fn(), getClaims: vi.fn(), resetPasswordForEmail: vi.fn(), setSession: vi.fn(), updateUser: vi.fn() },
  isolated: { verifyOtp: vi.fn(), getClaims: vi.fn(), signOut: vi.fn() },
  query: { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() },
}));
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: (name: string) => fx.jar.has(name) ? { value: fx.jar.get(name) } : undefined,
  set: (name: string, value: string) => fx.jar.set(name, value), delete: (name: string) => fx.jar.delete(name),
}) }));
vi.mock('../src/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ auth: fx.auth, from: () => fx.query }) }));
vi.mock('@supabase/supabase-js', async importOriginal => ({ ...await importOriginal<object>(), createClient: () => ({ auth: fx.isolated }) }));
import { getSettingsRecoveryAccount, getSettingsRecoveryState, sendSettingsRecoveryCode, verifySettingsRecoveryCode, updateSettingsRecoveryPassword, clearSettingsRecoveryIntent } from '../src/lib/auth/settings-recovery';

const owner = { userId: 'resident-a', email: 'resident@example.test', sessionId: 'original-session' };
const user = { id: owner.userId, email: owner.email, is_anonymous: false };
const cookie = 'barangayan-settings-recovery';
function intent(verified = false) {
  fx.jar.set(cookie, JSON.stringify({ ...owner, sentAt: Date.now() - 46000, expiresAt: Date.now() + 900000, verified }));
}
beforeEach(() => {
  vi.resetAllMocks(); fx.jar.clear();
  fx.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  fx.auth.getClaims.mockResolvedValue({ data: { claims: { session_id: owner.sessionId } }, error: null });
  fx.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  fx.auth.setSession.mockResolvedValue({ error: null }); fx.auth.updateUser.mockResolvedValue({ error: null });
  for (const method of ['select', 'eq', 'is'] as const) fx.query[method].mockReturnValue(fx.query);
  fx.query.maybeSingle.mockResolvedValue({ data: { email: owner.email, email_verification_status: 'verified' }, error: null });
  fx.isolated.verifyOtp.mockResolvedValue({ data: { user, session: { access_token: 'recovery-access', refresh_token: 'recovery-refresh' } }, error: null });
  fx.isolated.getClaims.mockResolvedValue({ data: { claims: { session_id: 'recovery-session' } }, error: null });
  fx.isolated.signOut.mockResolvedValue({ error: null });
});

describe('Settings recovery account boundary', () => {
  it.each(['userId', 'email'] as const)('does not resume a dialog recovery for a different %s', async key => {
    intent();
    expect(await getSettingsRecoveryState(false, { userId: owner.userId, email: owner.email, [key]: 'different' })).toMatchObject({ ok: false, kind: 'session' });
    expect(fx.auth.getUser).not.toHaveBeenCalled();
  });
  it('checks a fresh same-account session before starting recovery from a cached page', async () => {
    fx.auth.getClaims.mockResolvedValue({ data: { claims: { session_id: 'new-sign-in-session' } }, error: null });
    expect(await getSettingsRecoveryAccount({ userId: owner.userId, email: owner.email })).toMatchObject({ ...owner, sessionId: 'new-sign-in-session' });
    // Once a code has been requested, the original session is still mandatory.
    expect(await sendSettingsRecoveryCode(owner)).toMatchObject({ ok: false, kind: 'session' });
    expect(fx.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it('sends only to the verified authenticated email and establishes code-entry intent', async () => {
    expect(await sendSettingsRecoveryCode(owner)).toEqual({ ok: true });
    expect(fx.auth.resetPasswordForEmail).toHaveBeenCalledWith(owner.email);
    expect(await getSettingsRecoveryState(false)).toMatchObject(owner);
    expect(fx.query.eq).toHaveBeenCalledWith('id', owner.userId);
    expect(fx.query.is).toHaveBeenCalledWith('deleted_at', null);
  });
  it.each(['unverified', 'pending'])('does not send for %s profile email', async status => {
    fx.query.maybeSingle.mockResolvedValue({ data: { email: owner.email, email_verification_status: status }, error: null });
    expect(await sendSettingsRecoveryCode(owner)).toMatchObject({ ok: false, kind: 'unverified', message: 'Your email is not yet verified. Verify your email to receive a password reset code.', href: '/settings/email-verification' });
    expect(fx.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it('blocks mismatched profile email', async () => {
    fx.query.maybeSingle.mockResolvedValue({ data: { email: 'another@example.test', email_verification_status: 'verified' }, error: null });
    expect(await sendSettingsRecoveryCode(owner)).toMatchObject({ ok: false, kind: 'mismatch' });
    expect(fx.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it.each(['userId', 'email', 'sessionId'] as const)('rejects a stale %s owner', async key => {
    expect(await sendSettingsRecoveryCode({ ...owner, [key]: 'changed' })).toMatchObject({ ok: false, kind: 'session' });
    expect(fx.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it('blocks missing/deleted profiles and signed-out callers with distinct messages', async () => {
    fx.query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getSettingsRecoveryAccount()).toMatchObject({ ok: false, kind: 'rejected', href: '/settings/profile' });
    fx.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await sendSettingsRecoveryCode(owner)).toMatchObject({ ok: false, kind: 'session' });
  });
  it('supports a verified admin profile that the resident-web Settings guard already accepts', async () => {
    fx.query.maybeSingle.mockImplementation(async () => ({
      data: fx.query.eq.mock.calls.some(([column, value]) => column === 'role' && value !== 'admin')
        ? null : { email: owner.email, email_verification_status: 'verified' }, error: null,
    }));
    expect(await sendSettingsRecoveryCode(owner)).toEqual({ ok: true });
    expect(fx.auth.resetPasswordForEmail).toHaveBeenCalledWith(owner.email);
  });
  it('shows the verification message for an unverified admin profile, not a session error', async () => {
    fx.query.maybeSingle.mockImplementation(async () => ({
      data: fx.query.eq.mock.calls.some(([column, value]) => column === 'role' && value !== 'admin')
        ? null : { email: owner.email, email_verification_status: 'unverified' }, error: null,
    }));
    expect(await sendSettingsRecoveryCode(owner)).toMatchObject({ ok: false, kind: 'unverified' });
    expect(fx.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it('distinguishes missing session claims from an expired recovery', async () => {
    fx.auth.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });
    expect(await getSettingsRecoveryAccount()).toMatchObject({ ok: false, kind: 'session', href: '/login' });
  });
  it('enforces the 45-second send cooldown, including a lost send response', async () => {
    fx.auth.resetPasswordForEmail.mockRejectedValueOnce(new TypeError('offline'));
    expect(await sendSettingsRecoveryCode(owner)).toMatchObject({ ok: false, kind: 'connection' });
    expect(await sendSettingsRecoveryCode(owner, true)).toMatchObject({ ok: false, kind: 'rate-limit' });
    expect(fx.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
  });
  it('resends to the same account and respects backend rate limits', async () => {
    intent(); fx.auth.resetPasswordForEmail.mockResolvedValue({ error: new AuthApiError('rate limit', 429, 'over_email_send_rate_limit') });
    expect(await sendSettingsRecoveryCode(owner, true)).toMatchObject({ ok: false, kind: 'rate-limit' });
    expect(fx.auth.resetPasswordForEmail).toHaveBeenCalledWith(owner.email);
  });
  it('rejects absent, malformed and expired intent', async () => {
    expect(await getSettingsRecoveryState(false)).toMatchObject({ ok: false });
    fx.jar.set(cookie, 'invalid'); expect(await getSettingsRecoveryState(false)).toMatchObject({ ok: false });
    fx.jar.set(cookie, JSON.stringify({ ...owner, sentAt: 0, expiresAt: 1, verified: false }));
    expect(await verifySettingsRecoveryCode(owner, '123456')).toMatchObject({ ok: false, kind: 'session' });
    expect(fx.isolated.verifyOtp).not.toHaveBeenCalled();
  });
});

describe('Settings recovery verification and update', () => {
  it.each(['lowercase1!', 'Uppercase!', 'Uppercase1', 'Aa1!'])('rejects a password missing the suggested format: %s', async password => {
    intent(true);
    expect(await updateSettingsRecoveryPassword(owner, password, password)).toMatchObject({ ok: false, kind: 'rejected' });
    expect(fx.auth.updateUser).not.toHaveBeenCalled();
  });
  it('verifies recovery codes then adopts only the same account session', async () => {
    intent(); expect(await verifySettingsRecoveryCode(owner, '123456')).toEqual({ ok: true });
    expect(fx.isolated.verifyOtp).toHaveBeenCalledWith({ type: 'recovery', email: owner.email, token: '123456' });
    expect(fx.auth.setSession).toHaveBeenCalledWith({ access_token: 'recovery-access', refresh_token: 'recovery-refresh' });
    expect(JSON.parse(fx.jar.get(cookie)!)).toMatchObject({ verified: true, sessionId: 'recovery-session' });
  });
  it('rejects malformed and expired codes without changing the app session', async () => {
    intent(); expect(await verifySettingsRecoveryCode(owner, '12x456')).toMatchObject({ ok: false, kind: 'rejected' });
    fx.isolated.verifyOtp.mockResolvedValue({ data: {}, error: new AuthApiError('expired', 403, 'otp_expired') });
    expect(await verifySettingsRecoveryCode(owner, '123456')).toMatchObject({ ok: false, kind: 'rejected' });
    expect(fx.auth.setSession).not.toHaveBeenCalled();
  });
  it('retires a wrong-account recovery session without adopting it', async () => {
    intent(); fx.isolated.verifyOtp.mockResolvedValue({ data: { user: { ...user, id: 'other' }, session: { access_token: 'other', refresh_token: 'other' } }, error: null });
    expect(await verifySettingsRecoveryCode(owner, '123456')).toMatchObject({ ok: false, kind: 'session' });
    expect(fx.auth.setSession).not.toHaveBeenCalled(); expect(fx.isolated.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('stops if the current account changes while verification is in flight', async () => {
    intent(); fx.auth.getUser.mockResolvedValueOnce({ data: { user }, error: null }).mockResolvedValue({ data: { user: { ...user, id: 'other' } }, error: null });
    expect(await verifySettingsRecoveryCode(owner, '123456')).toMatchObject({ ok: false, kind: 'session' });
    expect(fx.auth.setSession).not.toHaveBeenCalled();
  });
  it('requires verified recovery state for Settings password submission', async () => {
    intent(); expect(await updateSettingsRecoveryPassword(owner, 'Newpass1!', 'Newpass1!')).toMatchObject({ ok: false, kind: 'session' });
    expect(fx.auth.updateUser).not.toHaveBeenCalled();
  });
  it('validates passwords and confirmation without changing credentials', async () => {
    intent(true);
    expect(await updateSettingsRecoveryPassword(owner, 'short', 'short')).toMatchObject({ ok: false });
    expect(await updateSettingsRecoveryPassword(owner, 'Newpass1!', 'different')).toMatchObject({ ok: false });
    expect(fx.auth.updateUser).not.toHaveBeenCalled();
  });
  it('updates the same verified account and clears intent after sign-out', async () => {
    intent(true); expect(await updateSettingsRecoveryPassword(owner, 'Newpass1!', 'Newpass1!')).toEqual({ ok: true });
    expect(fx.auth.updateUser).toHaveBeenCalledWith({ password: 'Newpass1!' });
    await clearSettingsRecoveryIntent(); expect(fx.jar.has(cookie)).toBe(false);
  });
  it('preserves retry state and reports an uncertain update honestly', async () => {
    intent(true); fx.auth.updateUser.mockRejectedValue(new TypeError('offline'));
    expect(await updateSettingsRecoveryPassword(owner, 'Newpass1!', 'Newpass1!')).toMatchObject({ ok: false, kind: 'connection' });
    expect(fx.jar.has(cookie)).toBe(true);
  });
});
