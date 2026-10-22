import * as Notifications from 'expo-notifications';
import type { PermissionState, PushPort } from './push-controller';

/**
 * The only module that touches `expo-notifications` (SDK 57). Everything above it works against `PushPort`, so the logic is
 * tested without the native module. Behavior that needs the module itself (permission prompt, token, delivery, taps) can only
 * be seen on a physical iPhone.
 */
function permissionState(status: Notifications.NotificationPermissionsStatus): PermissionState {
  switch (status.ios?.status) {
    case Notifications.IosAuthorizationStatus.AUTHORIZED:
    case Notifications.IosAuthorizationStatus.PROVISIONAL:
    case Notifications.IosAuthorizationStatus.EPHEMERAL:
      return 'granted';
    case Notifications.IosAuthorizationStatus.DENIED:
      return 'denied';
    case Notifications.IosAuthorizationStatus.NOT_DETERMINED:
      return 'undetermined';
    default:
      return status.granted ? 'granted' : status.canAskAgain ? 'undetermined' : 'denied';
  }
}

export const nativePushPort: PushPort = {
  async permission() { return permissionState(await Notifications.getPermissionsAsync()); },
  // Alerts and sound only: the app sets no badge, and never asks for critical alerts (plan §3).
  async requestPermission() {
    return permissionState(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } }));
  },
  async token() {
    try { return (await Notifications.getExpoPushTokenAsync()).data; } catch { return null; }
  },
};

let presentationConfigured = false;
/** While the app is open an alert shows as a banner and in the list; it sets no badge. Calling it again does nothing. */
export function configureForegroundPresentation(): void {
  if (presentationConfigured) return;
  presentationConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** Calls `onChange` when the device's push address changes, so the new token can be registered. Returns the unsubscribe. */
export function onDeviceTokenChange(onChange: () => void): () => void {
  const subscription = Notifications.addPushTokenListener(() => onChange());
  return () => subscription.remove();
}

/** A tapped notification: its identifier (for replay suppression) and its data (an untrusted pointer). */
export type NotificationTap = { id: string; data: unknown };

/** The last notification response: undefined while unknown, null when there is none. Covers cold start and warm taps. */
export function useNotificationTap(): NotificationTap | null | undefined {
  const response = Notifications.useLastNotificationResponse();
  if (response === undefined || response === null) return response;
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return null;
  return { id: response.notification.request.identifier, data: response.notification.request.content.data };
}

export function clearNotificationTap(): void {
  Notifications.clearLastNotificationResponse();
}
