import { EMAIL_REGEX, newPasswordSchema, PASSWORD_COMPLEXITY_REGEX } from '@barangayan/shared';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { authSetupRequests, SetupWriteBoundary } from './setup-request';

type RecoveryAuth = Pick<SupabaseClient['auth'], 'resetPasswordForEmail' | 'verifyOtp' | 'getSession' | 'updateUser'>;
type RecoveryAccount = Pick<Session['user'], 'id' | 'email'>;

/** A navigation hint is not proof of recovery. Only a verified code unlocks the
 * password write, for the exact session it created. Restarting requires a new code. */
export class PasswordRecoveryFlow {
  private verified: { userId: string; accessToken: string } | null = null;

  constructor(private readonly auth: RecoveryAuth) {}

  clear() { this.verified = null; }

  async send(email: string, account?: RecoveryAccount | null) {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) throw new Error('Enter a valid email address');
    if (account && normalized !== account.email?.trim().toLowerCase()) {
      throw new Error('Use the email address for your signed-in account.');
    }
    this.clear();
    await authSetupRequests.run(async () => {
      const { error } = await this.auth.resetPasswordForEmail(normalized);
      if (error) throw error;
    });
    return normalized;
  }

  async verify(email: string, code: string, account?: RecoveryAccount | null) {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) throw new Error('Request a new reset code for your email.');
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit reset code');
    if (account && normalized !== account.email?.trim().toLowerCase()) {
      throw new Error('Use the reset code for your signed-in account.');
    }
    this.clear();
    const { data, error } = await authSetupRequests.run(() => this.auth.verifyOtp({ type: 'recovery', email: normalized, token: code }));
    if (error) throw error;
    if (!data.session || !data.user || (account && data.user.id !== account.id)) {
      throw new Error('The recovery session could not be confirmed. Request a new reset code.');
    }
    this.verified = { userId: data.user.id, accessToken: data.session.access_token };
  }

  async update(password: string, confirmPassword: string) {
    const result = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) throw new Error(result.error.issues[0].message);
    if (!PASSWORD_COMPLEXITY_REGEX.test(password)) {
      throw new Error('Password must include an uppercase letter, a number, and a special character');
    }
    const verified = this.verified;
    if (!verified) throw new Error('Verify your reset code before setting a new password.');
    const boundary = new SetupWriteBoundary();
    try {
      await authSetupRequests.run(async () => {
        const { data, error: sessionError } = await this.auth.getSession();
        if (sessionError) throw sessionError;
        if (this.verified !== verified || data.session?.user.id !== verified.userId || data.session.access_token !== verified.accessToken) {
          this.clear();
          throw new Error('Your recovery session changed or expired. Request a new reset code.');
        }
        boundary.begin();
        const { error } = await this.auth.updateUser({ password: result.data.password });
        if (error) throw error;
      });
    } finally {
      boundary.close();
    }
    this.clear();
  }
}

export function recoveryErrorMessage(cause: unknown) {
  if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') return cause.message;
  return 'Check your connection and try again.';
}
