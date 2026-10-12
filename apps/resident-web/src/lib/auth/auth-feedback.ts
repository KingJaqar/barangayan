import { isAuthError, isAuthRetryableFetchError, isAuthSessionMissingError, isAuthWeakPasswordError } from '@supabase/supabase-js';

/**
 * Classifies a Supabase Auth result for resident-facing feedback. It reads the error's
 * type, HTTP status, and code (never message substrings), so a network failure is no
 * longer reported as wrong credentials and raw provider text never reaches the page.
 *
 * - `connection`: the request failed in transit or timed out (boundedAuthFetch aborts
 *   at 15 s), or a gateway error came back. For a write, the server may still have
 *   completed it, so callers describe that outcome as unconfirmed.
 * - `rate-limit`: Auth refused because of too many attempts.
 * - `service`: Auth answered with a server error.
 * - `session`: there is no session to act on (expired or signed out).
 * - `rejected`: Auth answered and refused the input (credentials, code, password rules).
 */
export type AuthFailureKind = 'connection' | 'rate-limit' | 'service' | 'session' | 'rejected';

const RATE_LIMIT_CODES = new Set(['over_request_rate_limit', 'over_email_send_rate_limit', 'over_sms_send_rate_limit']);

export function authFailureKind(error: unknown): AuthFailureKind {
  if (isAuthSessionMissingError(error)) return 'session';
  // auth-js wraps 5xx answers as "retryable fetch errors" too; only status 0 means the
  // request never got an answer.
  if (isAuthRetryableFetchError(error)) return (error.status ?? 0) > 0 ? 'service' : 'connection';
  if (isAuthWeakPasswordError(error)) return 'rejected';
  if (isAuthError(error)) {
    const status = error.status ?? 400;
    if (status === 429 || (error.code && RATE_LIMIT_CODES.has(error.code))) return 'rate-limit';
    if (status >= 500) return 'service';
    return 'rejected';
  }
  // A thrown non-Auth failure (fetch TypeError, abort) never got an Auth answer.
  return 'connection';
}

/** The Auth error code, when Auth supplied one. */
export function authErrorCode(error: unknown): string | undefined {
  return isAuthError(error) ? error.code : undefined;
}

/** True when a weak-password rejection says the password appeared in a known breach. */
export function isBreachedPassword(error: unknown): boolean {
  return isAuthWeakPasswordError(error) && error.reasons.includes('pwned');
}

export const AUTH_MESSAGES = {
  connection: "We couldn't reach the server. Check your connection, then try again.",
  rateLimit: 'Too many attempts. Please wait a moment, then try again.',
  service: 'This service is having trouble right now. Please try again shortly.',
} as const;

/**
 * Resident-facing text for a failed `complete_resident_profile` call. PostgREST reports a
 * transport failure as status 0; the function raises fixed snake_case tokens, matched
 * exactly here.
 */
export function profileCompletionFailure(error: { message: string }, status: number): { uncertain: boolean; message: string } {
  if (status === 0) {
    return { uncertain: true, message: "We couldn't confirm that your profile was saved. Check your connection, then submit again." };
  }
  switch (error.message) {
    case 'invalid_coordinates':
    case 'location_outside_or_unavailable':
      return { uncertain: false, message: 'Your pinned location must be inside the barangay. Adjust the map pin, then try again.' };
    case 'invalid_profile_fields':
      return { uncertain: false, message: 'Some required details are missing or invalid. Review the form, then try again.' };
    case 'registration_locality_not_configured':
      return { uncertain: false, message: "Profile completion isn't available right now. Please try again later." };
    case 'authentication_required':
    case 'resident_identity_required':
    case 'forbidden':
      return { uncertain: false, message: "Your session can't complete this profile. Sign out, log in again, then retry." };
    default:
      return { uncertain: false, message: "We couldn't save your profile. Please try again." };
  }
}
