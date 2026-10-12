import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { boundedAuthFetch } from '@barangayan/shared';
import { SETTINGS_RECOVERY_PASSWORD_HINT, settingsRecoveryPasswordSchema } from './settings-recovery-password';
import { createSupabaseServerClient } from '../supabase/server';
import { authErrorCode, authFailureKind, AUTH_MESSAGES, isBreachedPassword } from './auth-feedback';
import type { SettingsRecoveryFailure, SettingsRecoveryOwner, SettingsRecoveryResult } from './settings-recovery-contract';

const COOKIE = 'barangayan-settings-recovery';
// Match the existing one-hour recovery-code window; Auth still enforces token expiry.
const LIFETIME = 60 * 60;
type RecoveryIntent = SettingsRecoveryOwner & { expiresAt: number; sentAt: number; verified: boolean };
const sessionFailure: SettingsRecoveryFailure = { ok: false, kind: 'session', message: 'Your recovery session changed or ended. Return to Change Password and start again.', href: '/settings/change-password' };

function failure(error: unknown, operation: 'send' | 'verify' | 'update'): SettingsRecoveryFailure {
  const kind = authFailureKind(error);
  if (kind === 'session') return sessionFailure;
  const message = kind === 'connection' ? (operation === 'send'
    ? "We couldn't confirm that a reset code was sent. Check your email before trying again."
    : operation === 'update' ? "We couldn't confirm that your password was changed. Check your connection, then try again." : AUTH_MESSAGES.connection)
    : kind === 'rate-limit' ? AUTH_MESSAGES.rateLimit
    : kind === 'service' ? AUTH_MESSAGES.service
    : operation === 'verify' ? 'That code is invalid or has expired. Check the code, or request a new one.'
    : operation === 'send' ? "We couldn't send a reset code. Please try again."
    : authErrorCode(error) === 'same_password' ? 'Choose a password different from your current one.'
    : authErrorCode(error) === 'weak_password' ? (isBreachedPassword(error) ? 'This password has appeared in a data breach. Choose a different one.' : SETTINGS_RECOVERY_PASSWORD_HINT)
    : "We couldn't update your password. Please try again.";
  return { ok: false, kind, message };
}

/** Auth confirmation alone is insufficient: the profile badge records actual email verification. */
export async function getSettingsRecoveryAccount(expected?: Pick<SettingsRecoveryOwner, 'userId' | 'email'> & { sessionId?: string }): Promise<SettingsRecoveryOwner | SettingsRecoveryFailure> {
  try {
    const client = await createSupabaseServerClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error) throw error;
    if (!user?.email || user.is_anonymous) return sessionFailure;
    const { data: claims, error: claimsError } = await client.auth.getClaims();
    if (claimsError) throw claimsError;
    const sessionId = claims?.claims.session_id;
    if (typeof sessionId !== 'string') return { ok: false, kind: 'session', message: 'We could not validate your sign-in session. Sign out and sign in again before requesting a reset code.', href: '/login' };
    const owner = { userId: user.id, email: user.email, sessionId };
    if (expected && (expected.userId !== owner.userId || (expected.sessionId && expected.sessionId !== sessionId) || expected.email !== owner.email)) return sessionFailure;
    const { data: profile, error: profileError } = await client.from('profiles')
      // Match requireUser: every account role can use resident-web Settings.
      // Ownership and active-profile checks still apply, and the email must be verified.
      .select('email,email_verification_status').eq('id', user.id).is('deleted_at', null).maybeSingle();
    if (profileError) return { ok: false, kind: 'service', message: 'Unable to load your email verification status. Reload and try again.' };
    if (!profile) return { ok: false, kind: 'rejected', message: 'Your active account profile could not be found. Open Profile or contact barangay staff for help.', href: '/settings/profile' };
    if (!profile.email || profile.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return { ok: false, kind: 'mismatch', message: 'Save your sign-in email in Profile before requesting a reset code.', href: '/settings/profile' };
    }
    if (profile.email_verification_status !== 'verified') {
      return { ok: false, kind: 'unverified', message: 'Your email is not yet verified. Verify your email to receive a password reset code.', href: '/settings/email-verification' };
    }
    return owner;
  } catch (error) { return failure(error, 'send'); }
}

async function readIntent(): Promise<RecoveryIntent | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  try {
    const intent = JSON.parse(value) as RecoveryIntent;
    return typeof intent.userId === 'string' && typeof intent.email === 'string' && typeof intent.sessionId === 'string'
      && typeof intent.sentAt === 'number' && typeof intent.verified === 'boolean'
      && typeof intent.expiresAt === 'number' && intent.expiresAt > Date.now() ? intent : null;
  } catch { return null; }
}

async function writeIntent(intent: RecoveryIntent) {
  (await cookies()).set(COOKIE, JSON.stringify(intent), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
    maxAge: Math.max(0, Math.ceil((intent.expiresAt - Date.now()) / 1000)),
  });
}

/** The cookie carries navigation intent, never a recipient or authority to change another account. */
export async function getSettingsRecoveryState(verified: boolean, expectedAccount?: Pick<SettingsRecoveryOwner, 'userId' | 'email'>) {
  const intent = await readIntent();
  if (!intent || intent.verified !== verified) return sessionFailure;
  if (expectedAccount && (intent.userId !== expectedAccount.userId || intent.email !== expectedAccount.email)) return sessionFailure;
  const account = await getSettingsRecoveryAccount(intent);
  return 'ok' in account ? account : intent;
}

export async function sendSettingsRecoveryCode(expected: SettingsRecoveryOwner, resend = false): Promise<SettingsRecoveryResult> {
  try {
    const account = await getSettingsRecoveryAccount(expected);
    if ('ok' in account) return account;
    const previous = await readIntent();
    if (resend && (!previous || previous.verified || previous.userId !== account.userId || previous.sessionId !== account.sessionId)) return sessionFailure;
    if (previous?.userId === account.userId && previous.sessionId === account.sessionId && Date.now() - previous.sentAt < 45000) {
      return { ok: false, kind: 'rate-limit', message: 'Please wait 45 seconds before requesting another code.' };
    }
    // Record an attempt before sending: even a lost response may have delivered mail.
    const now = Date.now();
    await writeIntent({ ...account, sentAt: now, expiresAt: now + LIFETIME * 1000, verified: false });
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.resetPasswordForEmail(account.email);
    if (error) throw error;
    return { ok: true };
  } catch (error) { return failure(error, 'send'); }
}

export async function verifySettingsRecoveryCode(expected: SettingsRecoveryOwner, code: string): Promise<SettingsRecoveryResult> {
  if (!/^\d{6}$/.test(code)) return { ok: false, kind: 'rejected', message: 'Enter the six-digit code from your email.' };
  try {
    const state = await getSettingsRecoveryState(false);
    if ('ok' in state) return state;
    if (state.userId !== expected.userId || state.email !== expected.email || state.sessionId !== expected.sessionId) return sessionFailure;
    // Do not replace the app session until the returned identity and current caller both match.
    const verifier = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: boundedAuthFetch },
    });
    const { data, error } = await verifier.auth.verifyOtp({ type: 'recovery', email: state.email, token: code });
    if (error) throw error;
    const session = data.session;
    const current = await getSettingsRecoveryAccount(expected);
    if (!session || data.user?.id !== state.userId || data.user.email !== state.email || 'ok' in current) {
      if (session) await verifier.auth.signOut({ scope: 'local' }).catch(() => {});
      return 'ok' in current ? current : sessionFailure;
    }
    const { data: claims, error: claimsError } = await verifier.auth.getClaims();
    const sessionId = claims?.claims.session_id;
    if (claimsError || typeof sessionId !== 'string') {
      await verifier.auth.signOut({ scope: 'local' }).catch(() => {});
      return sessionFailure;
    }
    const client = await createSupabaseServerClient();
    const { error: adoptError } = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    if (adoptError) throw adoptError;
    await writeIntent({ ...state, sessionId, verified: true, expiresAt: Date.now() + LIFETIME * 1000 });
    return { ok: true };
  } catch (error) { return failure(error, 'verify'); }
}

export async function updateSettingsRecoveryPassword(expected: SettingsRecoveryOwner, password: string, confirmPassword: string): Promise<SettingsRecoveryResult> {
  const parsed = settingsRecoveryPasswordSchema.safeParse({ password, confirmPassword });
  if (!parsed.success) return { ok: false, kind: 'rejected', message: parsed.error.issues[0].message };
  try {
    const state = await getSettingsRecoveryState(true);
    if ('ok' in state) return state;
    if (state.userId !== expected.userId || state.email !== expected.email || state.sessionId !== expected.sessionId) return sessionFailure;
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error) throw error;
    // Clear the navigation intent after browser sign-out. Deleting it here would
    // re-render the reset route before it can show success or a sign-out retry.
    return { ok: true };
  } catch (error) { return failure(error, 'update'); }
}

export async function clearSettingsRecoveryIntent() {
  (await cookies()).delete(COOKIE);
}
