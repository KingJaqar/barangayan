import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { PASSWORD_COMPLEXITY_REGEX } from '../schemas/auth';
import { profileCompletionSchema } from '../schemas/service-foundations';

/** Creation-only flow hint; the database owns origin/password state afterwards. */
export const EMAIL_OTP_REGISTRATION_METADATA = { resident_registration_origin: 'email_otp' } as const;
export const residentEmailStepSchema = z.object({ email: z.string().trim().email('Enter a valid email address') }).strict();
export const residentCodeStepSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code') }).strict();
export const residentDetailsStepSchema = profileCompletionSchema;
export const residentPasswordStepSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(PASSWORD_COMPLEXITY_REGEX, 'Password must include an uppercase letter, a number, and a special character'),
  confirmPassword: z.string(),
}).strict().refine(value => value.password === value.confirmPassword, { path: ['confirmPassword'], message: "Passwords don't match" });

export const residentAccountSetupStatusSchema = z.object({
  registrationOrigin: z.enum(['email_otp', 'google', 'legacy']),
  profileComplete: z.boolean(),
  passwordSet: z.boolean().nullable(),
  hasGoogleIdentity: z.boolean(),
}).strict();
export type ResidentAccountSetupStatus = z.infer<typeof residentAccountSetupStatusSchema>;
export type ResidentEmailStepInput = z.infer<typeof residentEmailStepSchema>;
export type ResidentCodeStepInput = z.infer<typeof residentCodeStepSchema>;
export type ResidentPasswordStepInput = z.infer<typeof residentPasswordStepSchema>;

export type ResidentSetupFailure = {
  kind: 'rate_limit' | 'expired_code' | 'invalid_code' | 'network' | 'session_expired' | 'forbidden' | 'state_unavailable' | 'invalid_input' | 'unknown';
  message: string;
  retryable: boolean;
};
export function residentSetupFailure(error: { code?: string; status?: number; name?: string } | null | undefined): ResidentSetupFailure {
  if (error?.status === 401 || ['session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used'].includes(error?.code || '') || error?.name === 'AuthSessionMissingError')
    return { kind: 'session_expired', message: 'Your session has ended. Sign out and sign in again to continue setup.', retryable: false };
  if (error?.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error?.code || ''))
    return { kind: 'rate_limit', message: 'Please wait before trying again.', retryable: true };
  if (error?.code === 'otp_expired') return { kind: 'expired_code', message: 'This code is invalid or expired. Request a new code.', retryable: true };
  if (error?.code === 'validation_failed') return { kind: 'invalid_code', message: 'Check the code and try again.', retryable: true };
  if (error?.code === '42501' || error?.status === 403) return { kind: 'forbidden', message: 'This account cannot continue resident setup. Sign out and use the correct account.', retryable: false };
  if (error?.code === '22023') return { kind: 'invalid_input', message: 'Check your details and registration locality, then try again.', retryable: true };
  if (error?.name === 'AbortError' || error?.name === 'AuthRetryableFetchError' || error?.name === 'TypeError')
    return { kind: 'network', message: 'Unable to connect. Check your connection and retry.', retryable: true };
  if (error?.code === '55000') return { kind: 'state_unavailable', message: 'Unable to load account setup. Retry or sign out.', retryable: true };
  return { kind: 'unknown', message: 'Unable to complete this action. Retry or sign out.', retryable: true };
}
export class ResidentSetupStatusError extends Error {
  readonly failure: ResidentSetupFailure;
  constructor(error?: { code?: string; status?: number; name?: string }) {
    const failure = residentSetupFailure(error);
    super(failure.message);
    this.name = 'ResidentSetupStatusError';
    this.failure = failure;
  }
}
/** No caller ID argument and no invented default status on transport/shape failure. */
export async function getResidentAccountSetupStatus(client: SupabaseClient<Database>): Promise<ResidentAccountSetupStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const { data, error, status } = await client.rpc('get_resident_account_setup_status').abortSignal(controller.signal);
    if (error) throw new ResidentSetupStatusError(controller.signal.aborted ? { name: 'AbortError' } : { code: error.code, status });
    const parsed = residentAccountSetupStatusSchema.safeParse(data);
    if (!parsed.success) throw new ResidentSetupStatusError({ code: '55000' });
    return parsed.data;
  } catch (error) {
    if (error instanceof ResidentSetupStatusError) throw error;
    throw new ResidentSetupStatusError(controller.signal.aborted ? { name: 'AbortError' } : error instanceof Error ? { name: error.name } : undefined);
  } finally { clearTimeout(timer); }
}

export type ResidentSetupIntent = 'sign_in' | 'email_signup' | 'google_signup' | 'resume_profile' | 'google_details_saved' | 'settings_profile' | 'settings_password';
export type ResidentSetupLoad = { state: 'loading' } | { state: 'error'; failure: ResidentSetupFailure } | { state: 'ready'; status: ResidentAccountSetupStatus };
export type ResidentSetupRoute =
  | { destination: 'restoring' | 'status_loading' | 'status_error' | 'recovery' | 'existing_access' | 'login' | 'email' | 'code' | 'home' | 'settings_profile' | 'manage_password' }
  | { destination: 'details' | 'password'; required: boolean; returnTo: 'home' | 'settings' };
export type ResidentSetupRoutingInput = {
  session: 'restoring' | 'signed_out' | 'authenticated';
  intent: ResidentSetupIntent;
  recovery?: boolean;
  guest?: boolean;
  pendingCode?: boolean;
  actor?: 'resident' | 'staff' | 'blocked';
  setup?: ResidentSetupLoad;
};
/** Pure decision only: Phase 2 binds these results to Android's coordinator. */
export function residentSetupRoute(input: ResidentSetupRoutingInput): ResidentSetupRoute {
  if (input.session === 'restoring') return { destination: 'restoring' };
  if (input.recovery) return { destination: 'recovery' };
  if (input.session === 'signed_out') {
    if (input.intent === 'email_signup') return { destination: input.pendingCode ? 'code' : 'email' };
    return { destination: input.guest ? 'home' : 'login' };
  }
  if (input.actor && input.actor !== 'resident') return { destination: 'existing_access' };
  if (!input.setup || input.setup.state === 'loading') return { destination: 'status_loading' };
  if (input.setup.state === 'error') return { destination: 'status_error' };
  const status = input.setup.status;
  // Linking Google, guest flags and Settings intent cannot erase email-origin setup.
  if (status.registrationOrigin === 'email_otp') {
    if (!status.profileComplete) return { destination: 'details', required: true, returnTo: 'home' };
    if (status.passwordSet === false) return { destination: 'password', required: true, returnTo: 'home' };
    if (status.passwordSet === null) return { destination: 'manage_password' };
  }
  if (input.intent === 'settings_profile') return { destination: 'settings_profile' };
  if (input.intent === 'settings_password') {
    if (status.passwordSet === false && status.hasGoogleIdentity) return { destination: 'password', required: false, returnTo: 'settings' };
    return { destination: 'manage_password' };
  }
  if (['google_signup', 'resume_profile', 'google_details_saved'].includes(input.intent) && !status.profileComplete)
    return { destination: 'details', required: false, returnTo: 'home' };
  if (input.intent === 'google_details_saved' && status.profileComplete && status.passwordSet === false && status.hasGoogleIdentity)
    return { destination: 'password', required: false, returnTo: 'home' };
  return { destination: 'home' };
}
