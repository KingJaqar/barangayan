import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ signOut: vi.fn(), getSession: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: fixture }) }));
import { isIntentionalSignOut, signOutBrowser } from '../src/lib/auth/sign-out';
import { getAuthCookieOptions } from '../src/lib/supabase/cookie-options';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://isolation.supabase.test');
  vi.stubGlobal('document', { cookie: '' });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('resident logout outcomes', () => {
  it('uses local revocation by default and tracks intentional logout only while pending', async () => {
    fixture.signOut.mockImplementation(async () => {
      expect(isIntentionalSignOut()).toBe(true);
      return { error: null };
    });
    expect(await signOutBrowser()).toBe('signed-out');
    expect(fixture.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
    expect(isIntentionalSignOut()).toBe(false);
  });
  it('preserves explicit global cleanup for account deletion', async () => {
    fixture.signOut.mockResolvedValue({ error: null });
    expect(await signOutBrowser('global')).toBe('signed-out');
    expect(fixture.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'global' });
  });
  it.each(['', '.0', '.12'])('keeps the failure state when its own session%s remains', async suffix => {
    document.cookie = `${getAuthCookieOptions().name}${suffix}=fixture`;
    fixture.signOut.mockResolvedValue({ error: new Error('refresh failed') });
    expect(await signOutBrowser()).toBe('failed');
    expect(fixture.getSession).not.toHaveBeenCalled();
    expect(fixture.signOut).toHaveBeenCalledTimes(1);
  });
  it('does not mistake another app, a legacy cookie or a PKCE verifier for its remaining session', async () => {
    document.cookie = `sb-isolation-admin-web-auth-token.0=other; sb-isolation-auth-token=legacy; ${getAuthCookieOptions().name}-code-verifier=pkce`;
    fixture.signOut.mockRejectedValue(new Error('revoke failed'));
    expect(await signOutBrowser()).toBe('local-only');
    expect(fixture.getSession).not.toHaveBeenCalled();
    expect(fixture.signOut).toHaveBeenCalledTimes(1);
    expect(isIntentionalSignOut()).toBe(false);
  });
});
