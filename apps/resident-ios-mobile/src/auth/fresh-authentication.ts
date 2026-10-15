import type { ProviderAttempt, ReauthPurpose } from './provider-flow';

/**
 * Application window for a sensitive action unlocked by fresh provider authentication. The
 * server enforces its own window independently (`has_recent_authentication`); this one only
 * decides whether the app offers the action.
 */
export const FRESH_AUTH_WINDOW_MS = 5 * 60_000;
// Device and Auth clocks differ; skew alone must never stretch the window materially.
const CLOCK_SKEW_MS = 2 * 60_000;

type AuthMethod = { method: string; timestamp: number };
export type SessionClaims = { sub: string; sessionId: string | null; amr: AuthMethod[] };

/** Reads the Auth-issued token this client already received. `amr` timestamps survive refresh. */
export function sessionClaims(accessToken: string | null | undefined): SessionClaims | null {
  try {
    const part = accessToken?.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const utf8 = Array.from(atob(base64), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
    const value: unknown = JSON.parse(decodeURIComponent(utf8));
    if (!value || typeof value !== 'object') return null;
    const claims = value as { sub?: unknown; session_id?: unknown; amr?: unknown };
    if (typeof claims.sub !== 'string' || !Array.isArray(claims.amr)) return null;
    const amr = claims.amr.filter((entry): entry is AuthMethod => !!entry && typeof entry === 'object'
      && typeof (entry as AuthMethod).method === 'string' && Number.isFinite((entry as AuthMethod).timestamp));
    return { sub: claims.sub, sessionId: typeof claims.session_id === 'string' ? claims.session_id : null, amr };
  } catch { return null; }
}

export type ReauthenticationState = 'fresh' | 'expired' | 'mismatch' | 'none';
/**
 * A completed same-user attempt for this purpose AND an Auth-recorded authentication after the
 * attempt started. Neither half alone is accepted. Google reauthentication is recorded by Auth
 * as `oauth`; Apple's identity-token exchange may be recorded under a different method, so the
 * Apple check only requires a fresh Auth-issued timestamp tied to the completed Apple attempt.
 */
export function reauthenticationState({ attempt, purpose, accessToken, userId, now = Date.now() }: {
  attempt: ProviderAttempt | null; purpose: ReauthPurpose; accessToken: string | null | undefined; userId: string | null | undefined; now?: number;
}): ReauthenticationState {
  if (!attempt || attempt.intent !== 'reauthenticate' || attempt.purpose !== purpose || attempt.phase !== 'complete') return 'none';
  if (!userId || attempt.expectedUserId !== userId || attempt.userId !== userId) return 'mismatch';
  const claims = sessionClaims(accessToken);
  if (!claims || claims.sub !== userId) return 'mismatch';
  if (attempt.started > now || now - attempt.started > FRESH_AUTH_WINDOW_MS) return 'expired';
  const recorded = claims.amr.some(({ method, timestamp }) => {
    const at = timestamp * 1000;
    const methodOk = attempt.provider === 'google' ? method === 'oauth' : true;
    return methodOk && at >= attempt.started - CLOCK_SKEW_MS && at <= now + CLOCK_SKEW_MS && now - at <= FRESH_AUTH_WINDOW_MS + CLOCK_SKEW_MS;
  });
  return recorded ? 'fresh' : 'expired';
}
