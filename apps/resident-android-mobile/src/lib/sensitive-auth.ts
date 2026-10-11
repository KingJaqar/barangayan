import type { ResidentSetupLoad } from '@barangayan/shared';
import type { GoogleAttempt, GoogleReauthPurpose } from './google-auth-flow';

/** Application window for a Settings action unlocked by fresh Google authentication.
 * It is enforced by this app only; Supabase Auth's own password policy is separate. */
export const FRESH_AUTH_WINDOW_MS = 5 * 60_000;
// Device and Auth clocks differ; never let skew alone stretch the window materially.
const CLOCK_SKEW_MS = 2 * 60_000;

type AuthMethod = { method: string; timestamp: number };
export type SessionClaims = { sub: string; sessionId: string | null; amr: AuthMethod[] };

/** Reads the Auth-issued access token this client already received over TLS. The
 * `amr` timestamps are set by Supabase Auth at sign-in and survive token refresh. */
export function sessionClaims(accessToken: string | null | undefined): SessionClaims | null {
  try {
    const part = accessToken?.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const utf8 = Array.from(atob(base64), char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
    const value = JSON.parse(decodeURIComponent(utf8));
    if (typeof value?.sub !== 'string' || !Array.isArray(value.amr)) return null;
    const amr = value.amr.filter((entry: AuthMethod) => typeof entry?.method === 'string' && Number.isFinite(entry?.timestamp));
    return { sub: value.sub, sessionId: typeof value.session_id === 'string' ? value.session_id : null, amr };
  } catch { return null; }
}

export type ReauthenticationState = 'fresh' | 'expired' | 'mismatch' | 'none';
/** A completed same-user attempt for this purpose AND a Google (oauth) authentication
 * recorded by Auth after that attempt started. Neither half alone is accepted. */
export function reauthenticationState({ attempt, purpose, accessToken, userId, now = Date.now() }: {
  attempt: GoogleAttempt | null; purpose: GoogleReauthPurpose; accessToken: string | null | undefined; userId: string | null | undefined; now?: number;
}): ReauthenticationState {
  if (!attempt || attempt.intent !== 'reauthenticate' || attempt.purpose !== purpose || attempt.phase !== 'complete') return 'none';
  if (!userId || attempt.expectedUserId !== userId || attempt.userId !== userId) return 'mismatch';
  const claims = sessionClaims(accessToken);
  if (!claims || claims.sub !== userId) return 'mismatch';
  if (attempt.started > now || now - attempt.started > FRESH_AUTH_WINDOW_MS) return 'expired';
  const google = claims.amr.some(({ method, timestamp }) => {
    const at = timestamp * 1000;
    return method === 'oauth' && at >= attempt.started - CLOCK_SKEW_MS && at <= now + CLOCK_SKEW_MS && now - at <= FRESH_AUTH_WINDOW_MS + CLOCK_SKEW_MS;
  });
  return google ? 'fresh' : 'expired';
}

/** Authoritative password modes: an unknown legacy history is never "not set". */
export type PasswordMode = 'loading' | 'error' | 'change' | 'manage' | 'create_with_google' | 'recover_only';
export function passwordMode(setup: ResidentSetupLoad): PasswordMode {
  if (setup.state !== 'ready') return setup.state;
  const { passwordSet, hasGoogleIdentity } = setup.status;
  if (passwordSet === true) return 'change';
  if (passwordSet === null) return 'manage';
  return hasGoogleIdentity ? 'create_with_google' : 'recover_only';
}

/** How Delete My Account confirms it is the owner, from the server password state:
 * an existing (or unknown legacy) password is re-entered; a passwordless Google
 * resident uses fresh same-account Google authentication; otherwise none is offered. */
export type DeletionConfirmation = 'unavailable' | 'recover_first' | 'google' | 'password';
export function deletionConfirmation(setup: ResidentSetupLoad): DeletionConfirmation {
  const mode = passwordMode(setup);
  if (mode === 'loading' || mode === 'error') return 'unavailable';
  if (mode === 'recover_only') return 'recover_first';
  return mode === 'create_with_google' ? 'google' : 'password';
}

export type SettingsRow ={ title: string; subtitle: string; warning: boolean };
export function accountSettingsRows(setup: ResidentSetupLoad): { profile: SettingsRow; password: SettingsRow } {
  const mode = passwordMode(setup);
  const profile: SettingsRow = setup.state === 'loading' ? { title: 'Edit Profile', subtitle: 'Checking personal details…', warning: false }
    : setup.state === 'error' ? { title: 'Edit Profile', subtitle: 'Personal details status unavailable', warning: false }
    : setup.status.profileComplete ? { title: 'Edit Profile', subtitle: 'Edit Profile', warning: false }
    : { title: 'Edit Profile', subtitle: 'Personal details incomplete', warning: true };
  const password: SettingsRow = mode === 'loading' ? { title: 'Password', subtitle: 'Checking password status…', warning: false }
    : mode === 'error' ? { title: 'Password', subtitle: 'Password status unavailable', warning: false }
    : mode === 'change' ? { title: 'Change Password', subtitle: '', warning: false }
    : mode === 'manage' ? { title: 'Manage Password', subtitle: 'Change or recover your existing password', warning: false }
    : { title: 'Set Password', subtitle: 'Password not set', warning: true };
  return { profile, password };
}
