import { usePathname, useRouter } from 'expo-router';
import { useEffect, useReducer, useRef, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { createReplayGuard, createTapIntent, pushInboxId, type TapContext } from '@/lib/notification-tap';
import { clearNotificationTap, subscribeToNotificationTaps } from '@/lib/push-notifications';
import { setupAllowsApp } from '@/lib/setup-navigation';

/**
 * Opens the Announcements hub on the item a tapped notification points at. The tap arrives the same way from a cold start,
 * a warm app and a foreground banner, and each response is handled once. The payload is only a pointer: the screen re-reads
 * the row as the signed-in owner, so another account's notification, a purged row or a forged id opens nothing and shows
 * "no longer available". A tap received while the session is restoring waits for it; one for an account that has changed,
 * received signed out, or that the app cannot open yet (setup, password recovery) is dropped.
 */
export function NotificationTapHandler() {
  const { session, isLoading, isPasswordRecovery, setupRoute, setup } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [guard] = useState(createReplayGuard);
  const [intent] = useState(createTapIntent);
  const [received, markReceived] = useReducer((count: number) => count + 1, 0);

  const userId = session?.user.id ?? null;
  const restoring = isLoading;
  // The root index redirects into the app after restoration; opening before that would leave the redirect on top.
  const reachable: boolean | null = isPasswordRecovery || !userId ? false
    : setup.state === 'loading' || pathname === '/' ? null
    : setupAllowsApp(setupRoute, setup);
  const latest = useRef<Pick<TapContext, 'restoring' | 'userId'>>({ restoring, userId });
  useEffect(() => { latest.current = { restoring, userId }; });

  useEffect(() => subscribeToNotificationTaps(tap => {
    if (guard.handled(tap.id)) return;
    clearNotificationTap();
    const inboxId = pushInboxId(tap.data);
    if (!inboxId) return;
    intent.receive(inboxId, latest.current);
    markReceived();
  }), [guard, intent]);

  useEffect(() => {
    const step = intent.settle({ restoring, userId, reachable });
    if (step.type === 'open') router.push({ pathname: '/announcements', params: { notificationId: step.inboxId } });
  }, [intent, router, received, restoring, userId, reachable]);

  return null;
}
