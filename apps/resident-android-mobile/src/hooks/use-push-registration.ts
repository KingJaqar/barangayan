import { useEffect, useRef } from 'react';

import { useAppForeground } from '@/hooks/use-app-foreground';
import { onDeviceTokenChange, registerPushToken, retryPendingPushRelease, unregisterPushToken } from '@/lib/push-notifications';

/**
 * Keeps this device's push token in step with the session. While a resident is signed in with alerts on it registers the
 * token on every foreground and on every device-token change (so a missed or wrongly released registration heals); it
 * releases the token when that resident signs out or the account switches, and completes a release that could not be
 * confirmed earlier. None of it prompts for permission: only turning alerts on in Settings may. Work is bounded to one
 * run per foreground transition, per account change and per token change; listeners are removed on every change.
 */
export function usePushRegistration(userId: string | null, pushEnabled: boolean) {
  const foreground = useAppForeground();

  useEffect(() => {
    if (foreground) retryPendingPushRelease().catch((error) => console.warn('Failed to release push token:', error));
  }, [foreground]);

  // The serial queue keeps the previous resident's release ahead of the next resident's registration.
  const previousUserId = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;
    if (previous && previous !== userId) unregisterPushToken(previous).catch((error) => console.warn('Failed to release push token:', error));
  }, [userId]);

  useEffect(() => {
    if (!userId || !pushEnabled || !foreground) return;
    const register = () => registerPushToken(userId).catch((error) => console.warn('Failed to register push token:', error));
    void register();
    return onDeviceTokenChange(() => { void register(); });
  }, [userId, pushEnabled, foreground]);
}
