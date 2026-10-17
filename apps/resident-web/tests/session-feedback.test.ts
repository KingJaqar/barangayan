import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn(), maybeSingle: vi.fn(), eq: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: fixture.success, error: fixture.error, info: fixture.info, warning: fixture.warning, dismiss: fixture.dismiss } }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: () => ({ select: () => ({ eq: fixture.eq }) }),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  const storage = new Map<string, string>();
  const cookies = new Map<string, string>();
  vi.stubGlobal('document', {
    get cookie() { return [...cookies].map(([key, value]) => `${key}=${value}`).join('; '); },
    set cookie(raw: string) {
      const pair = raw.split(';')[0], separator = pair.indexOf('=');
      const key = pair.slice(0, separator), value = pair.slice(separator + 1);
      if (/Max-Age=0/i.test(raw)) cookies.delete(key); else cookies.set(key, value);
    },
  });
  vi.stubGlobal('sessionStorage', {
    setItem: (key: string, value: string) => storage.set(key, value),
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => storage.delete(key),
  });
  fixture.eq.mockReturnValue({ maybeSingle: fixture.maybeSingle });
  fixture.maybeSingle.mockResolvedValue({ data: { first_name: ' Juan ', last_name: ' Dela Cruz ' } });
});

describe('resident login and logout toasts', () => {
  it.each([
    ['google-error', 'error', "Google sign-in couldn't be completed. Please start again."],
    ['email-error', 'error', "Couldn't complete email confirmation. Request a new confirmation email."],
    ['email-pending', 'info', 'One more confirmation may be needed. Check both inboxes.'],
    ['email-changed', 'success', 'Email address changed.'],
    ['email-confirmed', 'info', 'Email confirmation completed. Check your account details.'],
  ] as const)('consumes %s exactly once without a new auth/data request', async (kind, severity, message) => {
    const feedback = await import('../src/lib/auth/session-feedback');
    document.cookie = `resident-web-callback-notice=${encodeURIComponent(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', createdAt: Date.now(), userId: 'resident-1', kind }))}`;
    await feedback.showPendingLoginNotification('resident-1', true);
    await feedback.showPendingLoginNotification('resident-1', true);
    expect(fixture[severity]).toHaveBeenCalledExactlyOnceWith(message, expect.any(Object));
    expect(document.cookie).not.toContain('resident-web-callback-notice');
    expect(fixture.maybeSingle).not.toHaveBeenCalled();
  });
  it.each(['expired', 'different-owner'] as const)('consumes and suppresses an %s callback', async scenario => {
    const feedback = await import('../src/lib/auth/session-feedback');
    document.cookie = `resident-web-callback-notice=${encodeURIComponent(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', createdAt: Date.now() - (scenario === 'expired' ? 121000 : 0), userId: scenario === 'different-owner' ? 'resident-2' : 'resident-1', kind: 'email-changed' }))}`;
    await feedback.showPendingLoginNotification('resident-1', true);
    expect(fixture.success).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain('resident-web-callback-notice');
  });
  it('keeps one navigation warning in the guest session and clears the login receipt', async () => {
    const feedback = await import('../src/lib/auth/session-feedback');
    const { notify, setNotificationSession } = await import('../src/lib/notify');
    setNotificationSession('resident-1');
    feedback.queueLoginNotification('resident-1');
    const attempt = feedback.notifyLoggedOut(null);
    notify.warning("You're logged out. Open Login to continue.", { id: attempt, keepOnSessionChange: true });
    setNotificationSession(null);
    await feedback.showPendingLoginNotification('resident-1');
    expect(fixture.warning).toHaveBeenCalledExactlyOnceWith("You're logged out. Open Login to continue.", expect.any(Object));
    expect(fixture.success).not.toHaveBeenCalled();
    expect(fixture.maybeSingle).not.toHaveBeenCalled();
    expect(fixture.dismiss).not.toHaveBeenCalled();
  });

  it('suppresses a deferred guest outcome after a new account signs in', async () => {
    const feedback = await import('../src/lib/auth/session-feedback');
    const { notify, setNotificationSession } = await import('../src/lib/notify');
    setNotificationSession('resident-1');
    const attempt = feedback.notifyLoggedOut(null);
    setNotificationSession('resident-2');
    notify.warning("You're logged out. Open Login to continue.", { id: attempt, keepOnSessionChange: true });
    expect(fixture.warning).not.toHaveBeenCalled();
    expect(fixture.success).not.toHaveBeenCalled();
  });

  it('welcomes the confirmed resident by saved name only once', async () => {
    const feedback = await import('../src/lib/auth/session-feedback');
    feedback.queueLoginNotification('resident-1');
    await feedback.showPendingLoginNotification('resident-1');
    await feedback.showPendingLoginNotification('resident-1');
    expect(fixture.success).toHaveBeenCalledExactlyOnceWith('Welcome back Juan Dela Cruz', expect.any(Object));
    expect(fixture.eq).toHaveBeenCalledWith('id', 'resident-1');
  });

  it('preserves the Google login receipt across a full page load', async () => {
    const beforeRedirect = await import('../src/lib/auth/session-feedback');
    beforeRedirect.queueLoginNotification();
    vi.resetModules();
    const afterRedirect = await import('../src/lib/auth/session-feedback');
    await afterRedirect.showPendingLoginNotification('google-resident');
    expect(fixture.success).toHaveBeenCalledExactlyOnceWith('Welcome back Juan Dela Cruz', expect.any(Object));
  });

  it('does not welcome on ordinary refresh or for a different account', async () => {
    const feedback = await import('../src/lib/auth/session-feedback');
    await feedback.showPendingLoginNotification('resident-1');
    feedback.queueLoginNotification('resident-1');
    await feedback.showPendingLoginNotification('resident-2');
    expect(fixture.success).not.toHaveBeenCalled();
    expect(fixture.maybeSingle).not.toHaveBeenCalled();
  });

  it('expires abandoned Google login receipts', async () => {
    const feedback = await import('../src/lib/auth/session-feedback');
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    feedback.queueLoginNotification();
    dateSpy.mockReturnValue(now + 6 * 60 * 1000);
    await feedback.showPendingLoginNotification('resident-1');
    dateSpy.mockRestore();
    expect(fixture.success).not.toHaveBeenCalled();
  });

  it('still welcomes when the optional name read fails', async () => {
    fixture.maybeSingle.mockRejectedValue(new Error('offline'));
    const feedback = await import('../src/lib/auth/session-feedback');
    feedback.queueLoginNotification('resident-1');
    await feedback.showPendingLoginNotification('resident-1');
    expect(fixture.success).toHaveBeenCalledExactlyOnceWith('Welcome back', expect.any(Object));
  });

  it('keeps the logout toast across the guest layout update and suppresses a late welcome', async () => {
    let resolveProfile!: (value: unknown) => void;
    fixture.maybeSingle.mockReturnValue(new Promise(resolve => { resolveProfile = resolve; }));
    const feedback = await import('../src/lib/auth/session-feedback');
    const { setNotificationSession } = await import('../src/lib/notify');
    setNotificationSession('resident-1');
    feedback.queueLoginNotification('resident-1');
    const welcome = feedback.showPendingLoginNotification('resident-1');
    feedback.notifyLoggedOut();
    setNotificationSession(null);
    resolveProfile({ data: { first_name: 'Juan', last_name: 'Dela Cruz' } });
    await welcome;
    expect(fixture.success).toHaveBeenCalledExactlyOnceWith('Logged out', expect.any(Object));
    expect(fixture.dismiss).not.toHaveBeenCalled();
  });

  it('keeps one combined recovery outcome without replaying a queued welcome', async () => {
    const feedback = await import('../src/lib/auth/session-feedback');
    const { setNotificationSession } = await import('../src/lib/notify');
    setNotificationSession('resident-1');
    feedback.queueLoginNotification('resident-1');
    feedback.notifyLoggedOut('Password updated. Log in with your new password.');
    setNotificationSession(null);
    await feedback.showPendingLoginNotification('resident-1');
    expect(fixture.success).toHaveBeenCalledExactlyOnceWith('Password updated. Log in with your new password.', expect.any(Object));
    expect(fixture.maybeSingle).not.toHaveBeenCalled();
  });
});
