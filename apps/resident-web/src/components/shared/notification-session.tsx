'use client';

import { useEffect } from 'react';

import { isIntentionalSignOut } from '@/lib/auth/sign-out';
import { eventId, notify, setNotificationSession } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Reports the signed-in account (from the layout's existing server auth read) to the
 * notification adapter, so an account change or sign-out clears the previous account's
 * toasts and suppresses its still-pending outcomes. Renders nothing; makes no request.
 *
 * While an account is signed in, it also listens (locally — the browser client is a
 * singleton and the listener makes no request) for a SIGNED_OUT that this tab didn't
 * start: the session expired or was revoked, or another tab logged out. It then clears
 * the previous account's notifications and says so once. Routing is unchanged: the
 * next navigation or refresh follows the existing guest/login redirects.
 */
export function NotificationSession({ userId }: { userId: string | null }) {
  useEffect(() => {
    setNotificationSession(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const { data } = createSupabaseBrowserClient().auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT' || isIntentionalSignOut()) return;
      setNotificationSession(null);
      // Issued after the session change, so the cleared bookkeeping can't suppress it;
      // a repeated SIGNED_OUT for the same account still shows it once.
      notify.info("You've been logged out", {
        id: eventId('session-ended', userId),
        keepOnSessionChange: true,
        description: 'Your session ended. Log in again to continue.',
      });
    });
    return () => data.subscription.unsubscribe();
  }, [userId]);

  return null;
}
