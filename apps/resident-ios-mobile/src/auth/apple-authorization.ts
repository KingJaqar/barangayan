/**
 * The one-time Apple authorization code from a fresh Apple confirmation for account deletion. Apple requires the app to
 * disconnect the Apple sign-in when its account is deleted, and that needs this code. It is held in memory only (never
 * stored), belongs to one user, is used once, and expires with the confirmation window.
 */
const HOLD_MS = 5 * 60_000;
let held: { userId: string; code: string; at: number } | null = null;

export function holdAppleAuthorizationCode(userId: string, code: string, now = Date.now()): void {
  held = { userId, code, at: now };
}

/** Returns the code once for the same user while it is fresh; any other call returns null. */
export function takeAppleAuthorizationCode(userId: string, now = Date.now()): string | null {
  const current = held;
  held = null;
  return current && current.userId === userId && now - current.at >= 0 && now - current.at <= HOLD_MS ? current.code : null;
}

export function clearAppleAuthorizationCode(): void {
  held = null;
}
