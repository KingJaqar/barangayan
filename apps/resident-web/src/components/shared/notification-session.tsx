'use client';

import { useEffect } from 'react';

import { isIntentionalSignOut } from '@/lib/auth/sign-out';
import { showPendingLoginNotification } from '@/lib/auth/session-feedback';
import { eventId, notify, setNotificationSession } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Reports the signed-in account (from the layout's existing server auth read) to the
 * notification adapter, so an account change or sign-out clears the previous account's
 * toasts and suppresses its still-pending outcomes. After an explicit login, reads the
 * resident's name once for the welcome toast. Renders nothing.
 *
 * While an account is signed in, it also listens (locally — the browser client is a
 * singleton and the listener makes no request) for a SIGNED_OUT that this tab didn't
 * start: the session expired or was revoked, or another tab logged out. It then clears
 * the previous account's notifications and says so once. Routing is unchanged: the
 * next navigation or refresh follows the existing guest/login redirects.
 */
export function NotificationSession({ userId, callbackOnly = false }: { userId: string | null; callbackOnly?: boolean }) {
  useEffect(() => {
    if (callbackOnly) return;
    setNotificationSession(userId);
    let active = true;
    // Synchronous callback receipts must wait for the root host's mount effect.
    // Effect replay/unmount cancels the obsolete delivery before it consumes one.
    queueMicrotask(() => { if (active) void showPendingLoginNotification(userId); });
    return () => { active = false; };
  }, [userId, callbackOnly]);

  useEffect(() => {
    let currentUserId = userId;
    const { data } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (isIntentionalSignOut()) return;
      const previousUserId = currentUserId;
      currentUserId = session?.user.id ?? null;
      // Invalidate pending UI outcomes immediately on an account switch, before the
      // next server layout arrives. This reuses the existing local subscription.
      setNotificationSession(session?.user.id ?? null);
      if (callbackOnly) void showPendingLoginNotification(currentUserId, true);
      if (event !== 'SIGNED_OUT' || !previousUserId) return;
      setNotificationSession(null);
      // Issued after the session change, so the cleared bookkeeping can't suppress it;
      // a repeated SIGNED_OUT for the same account still shows it once.
      notify.info("You've been logged out", {
        id: eventId('session-ended', previousUserId),
        keepOnSessionChange: true,
        description: 'Your session ended. Log in again to continue.',
      });
    });
    return () => data.subscription.unsubscribe();
  }, [userId, callbackOnly]);

  return null;
}
