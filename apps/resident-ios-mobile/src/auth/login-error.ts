/** Password sign-in cannot distinguish an unknown email from a wrong password. */
export function loginErrorMessage(cause: unknown): string {
  const error = cause && typeof cause === 'object' ? cause as { code?: unknown; status?: unknown; name?: unknown } : null;
  if (error?.code === 'invalid_credentials') return 'Email or password is incorrect.';
  if (error?.code === 'email_not_confirmed') return 'Verify your email before logging in.';
  if (error?.status === 429 || error?.code === 'over_request_rate_limit') return 'Too many login attempts. Please wait and try again.';
  if (error?.name === 'AuthRetryableFetchError' || error?.name === 'TypeError' || error?.name === 'AbortError') {
    return 'Unable to connect. Check your internet connection and try again.';
  }
  return 'Unable to log in right now. Please try again.';
}
