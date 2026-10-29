import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { profileCompletionSchema } from '../schemas/service-foundations';
import { getResidentAccountSetupStatus, residentAccountSetupStatusSchema, residentCodeStepSchema, residentDetailsStepSchema, residentPasswordStepSchema, residentSetupFailure, residentSetupRoute, type ResidentAccountSetupStatus } from './resident-account-setup';

const status: ResidentAccountSetupStatus = { registrationOrigin: 'email_otp', profileComplete: false, passwordSet: false, hasGoogleIdentity: false };
const route = (changes: Partial<ResidentAccountSetupStatus> = {}, intent: Parameters<typeof residentSetupRoute>[0]['intent'] = 'sign_in') => residentSetupRoute({ session: 'authenticated', intent, setup: { state: 'ready', status: { ...status, ...changes } } });

describe('resident setup contracts', () => {
  it('reuses completion rules and preserves six-digit strings', () => {
    expect(residentDetailsStepSchema).toBe(profileCompletionSchema);
    expect(residentCodeStepSchema.parse({ code: '001234' }).code).toBe('001234');
    for (const code of [123456, '12345', '1234567', ' 123456', 'abcdef']) expect(residentCodeStepSchema.safeParse({ code }).success).toBe(false);
    expect(residentPasswordStepSchema.safeParse({ password: 'Chosen1!', confirmPassword: 'Chosen1!' }).success).toBe(true);
    expect(residentPasswordStepSchema.safeParse({ password: 'Chosen1!', confirmPassword: 'Other1!' }).success).toBe(false);
    expect(residentPasswordStepSchema.safeParse({ password: 'password', confirmPassword: 'password' }).success).toBe(false);
    expect(residentPasswordStepSchema.safeParse({ password: 'Chosen1!', confirmPassword: 'Chosen1!', currentPassword: 'invented' }).success).toBe(false);
  });
  it('enforces email order even after Google linking or Settings navigation', () => {
    expect(route()).toEqual({ destination: 'details', required: true, returnTo: 'home' });
    expect(route({ hasGoogleIdentity: true }, 'settings_password').destination).toBe('details');
    expect(route({ profileComplete: true })).toEqual({ destination: 'password', required: true, returnTo: 'home' });
    expect(route({ profileComplete: true, passwordSet: null }).destination).toBe('manage_password');
    expect(route({ profileComplete: true, passwordSet: true }).destination).toBe('home');
  });
  it('requires proof of residency between details and password for an unsubmitted email registrant only', () => {
    const idStep = { destination: 'id_verification', required: true, returnTo: 'home' };
    expect(route({ profileComplete: true, idSubmitted: false })).toEqual(idStep);
    expect(route({ profileComplete: true, idSubmitted: false, hasGoogleIdentity: true }, 'settings_password')).toEqual(idStep);
    expect(route({ profileComplete: false, idSubmitted: false }).destination).toBe('details');
    expect(route({ profileComplete: true, idSubmitted: true })).toEqual({ destination: 'password', required: true, returnTo: 'home' });
    expect(route({ profileComplete: true, idSubmitted: undefined }).destination).toBe('password');
    for (const origin of ['google', 'legacy'] as const) {
      expect(route({ registrationOrigin: origin, profileComplete: true, idSubmitted: false, hasGoogleIdentity: true }, 'google_details_saved')).toEqual({ destination: 'password', required: false, returnTo: 'home' });
      expect(route({ registrationOrigin: origin, profileComplete: true, idSubmitted: false }).destination).toBe('home');
    }
  });
  it('does not retroactively gate email registrants who already finished setup', () => {
    expect(route({ profileComplete: true, passwordSet: true, idSubmitted: false }).destination).toBe('home');
    expect(route({ profileComplete: true, passwordSet: null, idSubmitted: false }).destination).toBe('manage_password');
  });
  it('accepts the status with or without the ID flag and rejects a non-boolean one', () => {
    expect(residentAccountSetupStatusSchema.parse({ ...status, idSubmitted: false }).idSubmitted).toBe(false);
    expect(residentAccountSetupStatusSchema.parse(status).idSubmitted).toBeUndefined();
    expect(residentAccountSetupStatusSchema.safeParse({ ...status, idSubmitted: 'no' }).success).toBe(false);
  });
  it('keeps Google completion/password optional and legacy uncertainty safe', () => {
    expect(route({ registrationOrigin: 'google', hasGoogleIdentity: true }).destination).toBe('home');
    expect(route({ registrationOrigin: 'google', hasGoogleIdentity: true }, 'google_signup')).toEqual({ destination: 'details', required: false, returnTo: 'home' });
    expect(route({ registrationOrigin: 'google', profileComplete: true, hasGoogleIdentity: true }, 'google_details_saved')).toEqual({ destination: 'password', required: false, returnTo: 'home' });
    expect(route({ registrationOrigin: 'legacy', passwordSet: null, hasGoogleIdentity: true }, 'settings_password').destination).toBe('manage_password');
    expect(route({ registrationOrigin: 'legacy', passwordSet: null }).destination).toBe('home');
    expect(route({ registrationOrigin: 'google', hasGoogleIdentity: true }, 'settings_password')).toEqual({ destination: 'password', required: false, returnTo: 'settings' });
    expect(route({ registrationOrigin: 'google' }, 'settings_profile').destination).toBe('settings_profile');
  });
  it('prioritizes restoration, recovery and account boundaries without defaulting failed status', () => {
    expect(residentSetupRoute({ session: 'restoring', intent: 'email_signup', recovery: true }).destination).toBe('restoring');
    expect(residentSetupRoute({ session: 'authenticated', intent: 'sign_in', recovery: true }).destination).toBe('recovery');
    expect(residentSetupRoute({ session: 'signed_out', intent: 'sign_in', recovery: true }).destination).toBe('recovery');
    expect(residentSetupRoute({ session: 'signed_out', intent: 'email_signup', pendingCode: true }).destination).toBe('code');
    expect(residentSetupRoute({ session: 'signed_out', intent: 'sign_in', guest: true }).destination).toBe('home');
    expect(residentSetupRoute({ session: 'signed_out', intent: 'sign_in' }).destination).toBe('login');
    expect(residentSetupRoute({ session: 'authenticated', intent: 'sign_in', actor: 'staff' }).destination).toBe('existing_access');
    expect(residentSetupRoute({ session: 'authenticated', intent: 'sign_in' }).destination).toBe('status_loading');
    expect(residentSetupRoute({ session: 'authenticated', intent: 'sign_in', setup: { state: 'error', failure: residentSetupFailure({ code: '55000' }) } }).destination).toBe('status_error');
  });
  it.each([['42501', 'forbidden'], ['55000', 'state_unavailable'], ['otp_expired', 'expired_code'], ['over_email_send_rate_limit', 'rate_limit'], ['22023', 'invalid_input']])('maps %s without reflecting backend text', (code, kind) => expect(residentSetupFailure({ code }).kind).toBe(kind));
  it.each(['session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used'])('requires fresh sign-in for %s rather than retrying a revoked session', code => {
    expect(residentSetupFailure({ code, status: 403 })).toEqual({ kind: 'session_expired', message: 'Your session has ended. Sign out and sign in again to continue setup.', retryable: false });
  });
  it('treats an HTTP 401 as an ended session rather than a retryable setup failure', () => {
    expect(residentSetupFailure({ status: 401, code: 'PGRST301' })).toMatchObject({ kind: 'session_expired', retryable: false });
  });
  it('preserves the setup RPC response status when its error object has no HTTP status', async () => {
    const client = { rpc: () => ({ abortSignal: async () => ({ data: null, error: { code: 'PGRST301' }, status: 401 }) }) } as unknown as SupabaseClient<Database>;
    await expect(getResidentAccountSetupStatus(client)).rejects.toMatchObject({ failure: { kind: 'session_expired', retryable: false } });
  });
  it('reads caller-only status and rejects malformed/error responses', async () => {
    const rpc = vi.fn().mockReturnValue({ abortSignal: vi.fn().mockResolvedValue({ data: status, error: null }) });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    await expect(getResidentAccountSetupStatus(client)).resolves.toEqual(status);
    expect(rpc).toHaveBeenCalledWith('get_resident_account_setup_status');
    rpc.mockReturnValue({ abortSignal: vi.fn().mockResolvedValue({ data: { ...status, encrypted_password: 'secret' }, error: null }) });
    await expect(getResidentAccountSetupStatus(client)).rejects.toMatchObject({ failure: { kind: 'state_unavailable' } });
    rpc.mockReturnValue({ abortSignal: vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } }) });
    await expect(getResidentAccountSetupStatus(client)).rejects.toMatchObject({ failure: { kind: 'forbidden' } });
  });
  it('bounds the status request and maps aborted PostgREST errors to a retry', async () => {
    vi.useFakeTimers();
    try {
      const client = { rpc: () => ({ abortSignal: (signal: AbortSignal) => new Promise(resolve => signal.addEventListener('abort', () => resolve({ data: null, error: { code: '', message: 'AbortError' } }))) }) } as unknown as SupabaseClient<Database>;
      const result = expect(getResidentAccountSetupStatus(client)).rejects.toMatchObject({ failure: { kind: 'network' } });
      await vi.advanceTimersByTimeAsync(10000);
      await result;
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
