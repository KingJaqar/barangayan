import { EMAIL_REGEX, newPasswordSchema, PASSWORD_COMPLEXITY_REGEX } from '@barangayan/shared';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { authRequests, WriteBoundary } from './request-gate';
import { classifyFailure } from '../data/outcome';

type RecoveryAuth = Pick<SupabaseClient['auth'], 'resetPasswordForEmail' | 'verifyOtp' | 'getSession' | 'updateUser' | 'signOut'>;
type RecoveryAccount = Pick<Session['user'], 'id' | 'email'>;

export const RECOVERY_RESEND_SECONDS = 45;
/** A recovery hint older than this no longer keeps the recovery stack reachable after a restart. */
export const RECOVERY_HINT_MS = 60 * 60_000;

/**
 * A navigation hint is not proof of recovery. Only a verified code unlocks the password write,
 * and only for the exact session it created; restarting requires a new code.
 */
export class RecoveryFlow {
  private verified: { userId: string; accessToken: string; expiresAt: number } | null = null;

  constructor(private readonly auth: RecoveryAuth) {}

  get isVerified() { return this.verified !== null && Date.now() < this.verified.expiresAt; }
  clear() { this.verified = null; }

  async send(email: string, account?: RecoveryAccount | null) {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) throw new Error('Enter a valid email address.');
    if (account && normalized !== account.email?.trim().toLowerCase()) throw new Error('Use the email address for your signed-in account.');
    this.clear();
    await authRequests.run(async () => {
      const { error } = await this.auth.resetPasswordForEmail(normalized);
      if (error) throw error;
    });
    return normalized;
  }

  async verify(email: string, code: string, account?: RecoveryAccount | null) {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) throw new Error('Request a new reset code for your email.');
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit reset code.');
    if (account && normalized !== account.email?.trim().toLowerCase()) throw new Error('Use the reset code for your signed-in account.');
    this.clear();
    const { data, error } = await authRequests.run(() => this.auth.verifyOtp({ type: 'recovery', email: normalized, token: code }));
    if (error) throw error;
    if (account && data.user && data.user.id !== account.id) {
      // verifyOtp installs its session before returning; rejecting its result alone leaves it signed in.
      const current = await this.auth.getSession();
      if (!current.error && current.data.session?.user.id === data.user.id) {
        const result = await this.auth.signOut({ scope: 'local' });
        if (result.error) throw new Error('Unable to clear the unintended recovery session. Sign out before trying again.');
      }
    }
    if (!data.session || !data.user || data.session.user.id !== data.user.id || (account && data.user.id !== account.id)) {
      throw new Error('The recovery session could not be confirmed. Request a new reset code.');
    }
    this.verified = { userId: data.user.id, accessToken: data.session.access_token, expiresAt: Date.now() + RECOVERY_HINT_MS };
  }

  async update(password: string, confirmPassword: string) {
    const parsed = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    if (!PASSWORD_COMPLEXITY_REGEX.test(password)) throw new Error('Password must include an uppercase letter, a number, and a special character.');
    const verified = this.verified;
    if (!verified || !this.isVerified) { this.clear(); throw new Error('Verify your reset code before setting a new password.'); }
    const boundary = new WriteBoundary();
    try {
      await authRequests.run(async () => {
        const { data, error: sessionError } = await this.auth.getSession();
        if (sessionError) throw sessionError;
        if (this.verified !== verified || !this.isVerified || data.session?.user.id !== verified.userId || data.session.access_token !== verified.accessToken) {
          this.clear();
          throw new Error('Your recovery session changed or expired. Request a new reset code.');
        }
        boundary.begin();
        const { error } = await this.auth.updateUser({ password: parsed.data.password });
        if (error) throw error;
      });
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : null;
      if (boundary.started && code !== 'weak_password' && code !== 'same_password' && classifyFailure(cause, { write: true }) === 'unknown-commit') {
        this.clear();
        throw new Error('The password update could not be confirmed. Request a new reset code before trying again.');
      }
      throw cause;
    } finally { boundary.close(); }
    this.clear();
  }
}

/** Short, safe copy for a recovery failure: library codes become plain-language messages. */
export function recoveryErrorMessage(cause: unknown): string {
  const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code: unknown }).code) : '';
  const status = cause && typeof cause === 'object' && 'status' in cause ? (cause as { status: unknown }).status : undefined;
  if (code === 'otp_expired' || code === 'validation_failed') return 'This code is invalid or expired. Request a new code.';
  if (status === 429 || code.includes('rate_limit')) return 'Please wait before requesting another code.';
  if (code === 'same_password') return 'Choose a password different from your current one.';
  if (code === 'weak_password') return 'Choose a stronger password.';
  if (cause instanceof Error && ['AuthRetryableFetchError', 'TypeError', 'AbortError'].includes(cause.name)) {
    return 'Unable to connect. Check your connection and try again.';
  }
  // Locally thrown messages above are already resident-safe; raw provider text never is.
  if (cause instanceof Error && !('code' in cause) && !('status' in cause) && cause.name === 'Error') return cause.message;
  return 'Unable to complete this step. Check your connection and try again.';
}
