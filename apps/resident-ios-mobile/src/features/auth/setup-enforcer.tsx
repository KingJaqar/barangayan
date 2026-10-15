import { usePathname, useRootNavigationState, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { useAuthFlow } from '../../auth/auth-flow';
import { actionNeedsProfile, allowedDuringSetup } from '../../auth/setup-route';
import { useResident } from '../../lib/runtime';

/**
 * Keeps a signed-in resident inside the server-owned setup flow until required setup is
 * committed, and routes service actions to profile completion when the profile is incomplete.
 * Public browsing is never blocked: guests and residents with complete setup pass untouched.
 */
export function SetupEnforcer() {
  const { session, recovery } = useResident();
  const { appAllowed, setup } = useAuthFlow();
  const pathname = usePathname();
  const router = useRouter();
  // Navigation is only possible once the root navigator has mounted.
  const navigationReady = !!useRootNavigationState()?.key;
  const profileIncomplete = setup.state === 'ready' && !setup.status.profileComplete;
  const target = !navigationReady || !session || recovery ? null
    : !appAllowed ? (allowedDuringSetup(pathname) ? null : '/account-setup')
    : profileIncomplete && actionNeedsProfile(pathname) ? `/complete-profile?next=${encodeURIComponent(pathname)}`
    : null;
  useEffect(() => {
    if (target) router.replace(target as Href);
  }, [target, router]);
  return null;
}
