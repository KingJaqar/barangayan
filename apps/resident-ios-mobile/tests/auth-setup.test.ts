import { describe, expect, it } from 'vitest';
import {
  accountSettingsRows, actionNeedsProfile, allowedDuringSetup, passwordMode, setupAllowsApp, setupDestination, setupRoute,
  type SetupIntent,
} from '../src/auth/setup-route';
import { fetchSetupStatus, isBackgroundRefresh, refreshFailureOutcome, setupStatusSchema, type SetupLoad, type SetupStatus } from '../src/auth/setup-status';

const base: SetupStatus = {
  contractVersion: 2, registrationOrigin: 'email_otp', profileComplete: true, passwordSet: true,
  identityProviders: ['email'], hasGoogleIdentity: false, hasAppleIdentity: false, emailIsPrivateRelay: false,
};
const ready = (patch: Partial<SetupStatus> = {}): SetupLoad => ({ state: 'ready', status: { ...base, ...patch } });
const route = (setup: SetupLoad | undefined, intent: SetupIntent = 'sign_in', extra: Partial<Parameters<typeof setupRoute>[0]> = {}) =>
  setupRoute({ session: 'authenticated', intent, setup, ...extra });

describe('setup status contract (P04-T02/T04)', () => {
  it('accepts exactly the v2 shape and rejects unknown versions, origins and extra properties', () => {
    expect(setupStatusSchema.safeParse(base).success).toBe(true);
    expect(setupStatusSchema.safeParse({ ...base, contractVersion: 3 }).success).toBe(false);
    expect(setupStatusSchema.safeParse({ ...base, registrationOrigin: 'facebook' }).success).toBe(false);
    expect(setupStatusSchema.safeParse({ ...base, extra: true }).success).toBe(false);
    expect(setupStatusSchema.safeParse({ ...base, passwordSet: 'yes' }).success).toBe(false);
    expect(setupStatusSchema.safeParse({ ...base, passwordSet: null }).success).toBe(true);
  });

  function client(result: { data: unknown; error: { code?: string; status?: number; name?: string } | null }) {
    const calls: string[] = [];
    const rpc = (name: string) => { calls.push(name); return { abortSignal: () => Promise.resolve(result) }; };
    return { calls, value: { rpc } as unknown as Parameters<typeof fetchSetupStatus>[0] };
  }

  it('reads the caller-only v2 function and returns the parsed status', async () => {
    const { calls, value } = client({ data: base, error: null });
    await expect(fetchSetupStatus(value)).resolves.toEqual(base);
    expect(calls).toEqual(['get_resident_account_setup_status_v2']);
  });

  it('fails with a classified error instead of inventing a status on shape or transport failure', async () => {
    await expect(fetchSetupStatus(client({ data: { ...base, contractVersion: 1 }, error: null }).value)).rejects.toMatchObject({ failure: { kind: 'state_unavailable' } });
    await expect(fetchSetupStatus(client({ data: null, error: { code: '42501' } }).value)).rejects.toMatchObject({ failure: { kind: 'forbidden' } });
    await expect(fetchSetupStatus(client({ data: null, error: { status: 429 } }).value)).rejects.toMatchObject({ failure: { kind: 'rate_limit', retryable: true } });
    await expect(fetchSetupStatus(client({ data: null, error: { code: 'session_expired' } }).value)).rejects.toMatchObject({ failure: { kind: 'session_expired', retryable: false } });
  });

  it('keeps a confirmed status through a transient background failure but never through forbidden or ended sessions', () => {
    const owned = { uid: 'u1', value: ready() };
    expect(isBackgroundRefresh(owned, 'u1')).toBe(true);
    expect(isBackgroundRefresh(owned, 'u2')).toBe(false);
    expect(isBackgroundRefresh({ uid: 'u1', value: { state: 'loading' } }, 'u1')).toBe(false);
    const failure = (kind: Parameters<typeof refreshFailureOutcome>[1]['kind']) => ({ kind, message: 'm', retryable: true });
    expect(refreshFailureOutcome(true, failure('network')).type).toBe('keep_status');
    expect(refreshFailureOutcome(true, failure('forbidden')).type).toBe('replace_with_error');
    expect(refreshFailureOutcome(true, failure('session_expired')).type).toBe('replace_with_error');
    expect(refreshFailureOutcome(false, failure('network')).type).toBe('replace_with_error');
  });
});

describe('server-owned setup routing (P04-T02/T04, A06)', () => {
  it('waits while restoring or loading and never infers readiness from local state', () => {
    expect(setupRoute({ session: 'restoring', intent: 'sign_in' }).destination).toBe('restoring');
    expect(route(undefined).destination).toBe('status_loading');
    expect(route({ state: 'loading' }).destination).toBe('status_loading');
    expect(route({ state: 'error', failure: { kind: 'network', message: 'm', retryable: true } }).destination).toBe('status_error');
  });

  it('requires details then a password for an email-origin account, whatever the intent', () => {
    for (const intent of ['sign_in', 'settings_profile', 'settings_password', 'provider_signup'] as const) {
      expect(route(ready({ profileComplete: false, passwordSet: false }), intent)).toEqual({ destination: 'details', required: true, returnTo: 'home' });
      expect(route(ready({ profileComplete: true, passwordSet: false }), intent)).toEqual({ destination: 'password', required: true, returnTo: 'home' });
    }
  });

  it('sends an email-origin account with unresolved password history to manage/recover, and does not admit it to the app', () => {
    const setup = ready({ passwordSet: null });
    const result = route(setup);
    expect(result.destination).toBe('manage_password');
    expect(setupAllowsApp(result, setup)).toBe(false);
    expect(setupDestination(result, setup)).toBe('/account-setup');
  });

  it('offers optional details then an optional password to a new Google or Apple resident', () => {
    for (const provider of [{ hasGoogleIdentity: true }, { hasAppleIdentity: true }]) {
      const origin = 'hasGoogleIdentity' in provider ? 'google' : 'apple';
      const incomplete = ready({ registrationOrigin: origin, profileComplete: false, passwordSet: false, ...provider });
      expect(route(incomplete, 'provider_signup')).toEqual({ destination: 'details', required: false, returnTo: 'home' });
      const complete = ready({ registrationOrigin: origin, profileComplete: true, passwordSet: false, ...provider });
      expect(route(complete, 'provider_details_saved')).toEqual({ destination: 'password', required: false, returnTo: 'home' });
      // A returning sign-in is not interrupted: completion is requested by service actions instead.
      expect(route(incomplete, 'sign_in').destination).toBe('home');
      expect(setupDestination(route(incomplete, 'sign_in'), incomplete)).toBe('/home');
    }
  });

  it('routes Settings password intent by provider evidence and never "creates" without one', () => {
    const withApple = ready({ registrationOrigin: 'apple', passwordSet: false, hasAppleIdentity: true });
    expect(route(withApple, 'settings_password')).toEqual({ destination: 'password', required: false, returnTo: 'settings' });
    const none = ready({ registrationOrigin: 'legacy', passwordSet: false });
    expect(route(none, 'settings_password').destination).toBe('manage_password');
  });

  it('keeps recovery, guests, signed-out intents and non-resident actors separate', () => {
    expect(setupRoute({ session: 'authenticated', intent: 'sign_in', recovery: true }).destination).toBe('recovery');
    expect(setupRoute({ session: 'signed_out', intent: 'sign_in', guest: true }).destination).toBe('home');
    expect(setupRoute({ session: 'signed_out', intent: 'sign_in' }).destination).toBe('login');
    expect(setupRoute({ session: 'signed_out', intent: 'email_signup', pendingCode: true }).destination).toBe('code');
    expect(setupRoute({ session: 'authenticated', intent: 'sign_in', actor: 'staff', setup: ready() }).destination).toBe('existing_access');
  });

  it('classifies password modes: unknown history is never "not set"', () => {
    expect(passwordMode({ state: 'loading' })).toBe('loading');
    expect(passwordMode(ready({ passwordSet: true }))).toBe('change');
    expect(passwordMode(ready({ passwordSet: null }))).toBe('manage');
    expect(passwordMode(ready({ passwordSet: false, hasGoogleIdentity: true }))).toBe('create_with_provider');
    expect(passwordMode(ready({ passwordSet: false, hasAppleIdentity: true }))).toBe('create_with_provider');
    expect(passwordMode(ready({ passwordSet: false }))).toBe('recover_only');
  });

  it('describes Settings rows from the server status', () => {
    expect(accountSettingsRows(ready({ profileComplete: false, passwordSet: false, hasAppleIdentity: true }))).toMatchObject({
      profile: { warning: true }, password: { title: 'Set password', warning: true },
    });
    expect(accountSettingsRows(ready()).password.title).toBe('Change password');
    expect(accountSettingsRows(ready({ passwordSet: null })).password.title).toBe('Manage password');
    expect(accountSettingsRows({ state: 'loading' }).profile.subtitle).toMatch(/Checking/);
  });

  it('gates only resident actions on a complete profile and limits what setup may open', () => {
    for (const path of ['/services/request/x', '/requests', '/request/x', '/health/register/x', '/reports/new']) expect(actionNeedsProfile(path)).toBe(true);
    for (const path of ['/home', '/services', '/services/abc', '/health', '/maps', '/settings', '/emergency']) expect(actionNeedsProfile(path)).toBe(false);
    for (const path of ['/account-setup', '/emergency', '/complete-profile', '/auth/recovery', '/auth/callback']) expect(allowedDuringSetup(path)).toBe(true);
    for (const path of ['/home', '/services/request/x', '/settings/profile', '/auth/login']) expect(allowedDuringSetup(path)).toBe(false);
  });
});
