/** Only a plain custom scheme can carry the OAuth callback; web, Expo-Go and dev-server URLs cannot. */
const SCHEME = /^[a-z][a-z0-9+.-]*$/;
const NON_CALLBACK_SCHEMES = new Set(['http', 'https', 'exp', 'exps', 'file', 'javascript', 'data']);

/**
 * Builds the registered OAuth callback `<scheme>://auth/callback` from the build's configured URL
 * scheme (`IOS_URL_SCHEME`, prerequisite PR-03). Returns null when no scheme is configured, so
 * browser sign-in is unavailable instead of using a guessed or foreign callback.
 */
export function buildCallbackUrl(scheme: string | null | undefined): string | null {
  const value = typeof scheme === 'string' ? scheme.trim().toLowerCase() : '';
  // `exp+<slug>` is the development client's own launcher scheme, never an approved callback.
  if (!SCHEME.test(value) || NON_CALLBACK_SCHEMES.has(value) || value.startsWith('exp+')) return null;
  return `${value}://auth/callback`;
}

export type CallbackResult = { ok: true; code: string } | { ok: false; reason: 'invalid' | 'declined' | 'incomplete' };

/**
 * Accepts only the exact registered callback with exactly one non-empty `code` and no fragment,
 * credentials or port. Anything else - another host, path, scheme, repeated or missing code - is
 * rejected, so unsolicited or replayed links cannot start an exchange.
 */
export function parseCallback(value: string, expected: string): CallbackResult {
  let url: URL;
  let target: URL;
  try { url = new URL(value); target = new URL(expected); } catch { return { ok: false, reason: 'invalid' }; }
  if (url.protocol !== target.protocol || url.hostname !== target.hostname || url.pathname !== target.pathname
    || url.hash || url.username || url.password || url.port) return { ok: false, reason: 'invalid' };
  if (url.searchParams.has('error') || url.searchParams.has('error_description')) return { ok: false, reason: 'declined' };
  const codes = url.searchParams.getAll('code');
  if (codes.length !== 1 || !codes[0]) return { ok: false, reason: 'incomplete' };
  return { ok: true, code: codes[0] };
}

export function isCallbackUrl(value: string | null | undefined, expected: string | null): value is string {
  if (!value || !expected) return false;
  try {
    const url = new URL(value);
    const target = new URL(expected);
    return url.protocol === target.protocol && url.hostname === target.hostname && url.pathname === target.pathname;
  } catch { return false; }
}

export function callbackFailureMessage(reason: 'invalid' | 'declined' | 'incomplete'): string {
  if (reason === 'declined') return 'Google sign-in was cancelled or declined. Please try again.';
  if (reason === 'incomplete') return 'The sign-in response has expired or is incomplete. Please sign in again.';
  return 'This sign-in link is not valid. Please start sign-in again.';
}
