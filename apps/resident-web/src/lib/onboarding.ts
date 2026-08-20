const KEY_PREFIX = 'barangayan-resident-web-onboarded:';

/**
 * One-time post-login welcome/personalization step (see /onboarding) — gated per
 * account, not per browser, via a localStorage flag keyed by user id (not a
 * `profiles` column: this is a UI tour, not account state worth a migration/RLS
 * surface for). A resident logging in on a second device sees it again once, which is
 * an acceptable, low-stakes trade-off for a one-time tour.
 *
 * Only ever checked/set from the login page's post-auth redirect and the onboarding
 * page itself — never a security or access-control signal.
 */
export function hasCompletedOnboarding(userId: string): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(KEY_PREFIX + userId) !== null;
  } catch {
    return true; // storage disabled — never force a stuck onboarding loop
  }
}

export function markOnboardingComplete(userId: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + userId, '1');
  } catch {
    // Private browsing / storage disabled — the one-time gate just won't stick, which
    // only means the resident might see onboarding again next login. Not fatal.
  }
}
