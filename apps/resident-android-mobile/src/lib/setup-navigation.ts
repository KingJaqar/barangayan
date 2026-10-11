import type { ResidentSetupRoute, ResidentSetupLoad } from '@barangayan/shared';
import type { GoogleReauthPurpose } from './google-auth-flow';
export function setupAllowsApp(route: ResidentSetupRoute, setup: ResidentSetupLoad) {
  if (['home','existing_access','settings_profile'].includes(route.destination)) return true;
  if (route.destination !== 'manage_password' || setup.state !== 'ready') return false;
  return !(setup.status.registrationOrigin === 'email_otp' && setup.status.passwordSet === null);
}
export function setupDestination(route: ResidentSetupRoute, setup: ResidentSetupLoad): '/home' | '/account-setup' | '/settings/profile' | '/settings/change-password' {
  if (route.destination === 'settings_profile') return '/settings/profile';
  if (route.destination === 'manage_password' && setupAllowsApp(route, setup)) return '/settings/change-password';
  return setupAllowsApp(route, setup) ? '/home' : '/account-setup';
}

export type ReauthTarget = '/settings/change-password' | '/settings';
/** Settings reauthentication returns to the action it was started for. */
export function reauthReturnTarget(purpose: GoogleReauthPurpose | null): ReauthTarget {
  return purpose === 'set_password' ? '/settings/change-password' : '/settings';
}
export type CallbackNavigation = { type: 'none' } | { type: 'back' } | { type: 'replace'; href: ReauthTarget | ReturnType<typeof setupDestination> | '/(auth)/forgot-password' };
/** Where the Google callback screen goes once its exchange has finished. */
export function callbackNavigation({ finished, recovery, signedIn, statusLoading, reauthTarget, appAllowed, canGoBack, destination }: {
  finished: boolean; recovery: boolean; signedIn: boolean; statusLoading: boolean; reauthTarget: ReauthTarget | null;
  appAllowed: boolean; canGoBack: boolean; destination: ReturnType<typeof setupDestination>;
}): CallbackNavigation {
  if (!finished) return { type: 'none' };
  if (recovery) return { type: 'replace', href: '/(auth)/forgot-password' };
  if (!signedIn || statusLoading) return { type: 'none' };
  // Warm return: the Settings screen that started reauthentication is still below
  // the callback; going back avoids mounting a duplicate screen (and dialogs).
  // Cold start has nothing to return to, so open the target fresh.
  if (reauthTarget && appAllowed) return canGoBack ? { type: 'back' } : { type: 'replace', href: reauthTarget };
  return { type: 'replace', href: destination };
}

const handedOffCallbacks = new Set<string>();
/** The exact native Google callback, `barangayan://auth/callback`. */
export function isNativeAuthCallback(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const incoming = new URL(url);
    return incoming.protocol === 'barangayan:' && incoming.hostname === 'auth' && incoming.pathname === '/callback';
  } catch { return false; }
}
/**
 * A native callback not yet handed to the callback screen. On an Android cold start into the
 * existing task the callback arrives as a new intent, but Expo Router takes its initial URL from
 * the recreated activity's original intent and starts at the root. The root redirect must wait
 * for the hand-off instead of sending the resident to the signed-out entry screen.
 */
export function nativeCallbackPending(url: string | null | undefined): url is string {
  return isNativeAuthCallback(url) && !handedOffCallbacks.has(url);
}
export function markNativeCallbackHandedOff(url: string) { handedOffCallbacks.add(url); }
