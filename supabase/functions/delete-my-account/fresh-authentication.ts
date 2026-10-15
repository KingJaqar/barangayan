// Server-side freshness for destructive account actions. The caller's JWT has already
// been validated by Auth (`getUser`); this only reads its `amr` evidence. Auth sets the
// `amr` timestamps at sign-in and keeps them across token refresh, so a refreshed old
// session is not fresh. Must match the window in request_own_account_deletion().
export const FRESH_AUTHENTICATION_WINDOW_SECONDS = 10 * 60;
const CLOCK_SKEW_SECONDS = 60;

export function latestAuthenticationTime(accessToken: string): number | null {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))));
    if (!Array.isArray(claims?.amr)) return null;
    let latest: number | null = null;
    for (const entry of claims.amr) {
      const timestamp = entry?.timestamp;
      if (typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0 && (latest === null || timestamp > latest)) {
        latest = timestamp;
      }
    }
    return latest;
  } catch {
    return null;
  }
}

export function hasFreshAuthentication(accessToken: string, nowSeconds: number): boolean {
  const authenticatedAt = latestAuthenticationTime(accessToken);
  if (authenticatedAt === null) return false;
  return authenticatedAt <= nowSeconds + CLOCK_SKEW_SECONDS
    && nowSeconds - authenticatedAt <= FRESH_AUTHENTICATION_WINDOW_SECONDS;
}
