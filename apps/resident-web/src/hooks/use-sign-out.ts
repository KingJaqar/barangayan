'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { safeResidentRedirect } from '@barangayan/shared';

import { useResetPreferencesOnLogout } from '@/components/theme/use-reset-preferences';
import { signOutBrowser } from '@/lib/auth/sign-out';
import { notifyLoggedOut } from '@/lib/auth/session-feedback';
import { beginAttempt, notify } from '@/lib/notify';

/**
 * One logout flow for every "Log out"/"Sign out" control (header, settings sidebar,
 * complete-profile). Pending follows the awaited sign-out; repeated activation is
 * ignored. Preferences reset and the move to /login happen only once the browser is
 * signed out. A failure keeps the resident where they are with usable controls and
 * one error notification. A successful sign-out shows a toast that survives the move
 * to /login.
 *
 * `scope` defaults to this application's session, including its other browser tabs.
 * `next` optionally preserves a safe in-app destination when switching accounts.
 */
export function useSignOut(scope: 'global' | 'local' = 'local', next?: string) {
  const router = useRouter();
  const resetPreferences = useResetPreferencesOnLogout();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const attempt = beginAttempt('sign-out');
    const outcome = await signOutBrowser(scope);

    if (outcome === 'failed') {
      busy.current = false;
      setPending(false);
      notify.error("Couldn't log out", { id: attempt, description: 'You are still logged in. Check your connection, then try again.' });
      return;
    }

    // Clear theme/accent/font so guest mode doesn't inherit this resident's appearance
    // (see use-reset-preferences.ts) — only now that the browser is signed out.
    resetPreferences();
    if (outcome === 'local-only' && scope !== 'local') {
      notify.warning('Logged out on this browser', {
        id: attempt,
        keepOnSessionChange: true,
        description: "We couldn't reach the server to end your other sessions. Devices that were already logged in may stay logged in.",
      });
    } else {
      notifyLoggedOut();
    }
    // Stay pending until /login replaces this screen.
    router.replace(next ? `/login?next=${encodeURIComponent(safeResidentRedirect(next))}` : '/login');
    router.refresh();
  }

  return { signOut, pending };
}
