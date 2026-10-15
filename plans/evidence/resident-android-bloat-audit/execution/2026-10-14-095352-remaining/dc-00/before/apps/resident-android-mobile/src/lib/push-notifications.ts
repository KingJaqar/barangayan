import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsType from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Remote push notifications were removed from Expo Go on Android in SDK 53 — merely
// *importing* expo-notifications there throws (its module-level auto-registration code
// runs on import, before any of our own guards get a chance to run). So the module must
// never be statically imported; it's lazy-required, and only outside Expo Go.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let notificationsModule: typeof NotificationsType | null = null;
let handlerConfigured = false;

function getNotifications(): typeof NotificationsType | null {
  if (isExpoGo) return null;
  if (!notificationsModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require('expo-notifications') as typeof NotificationsType;
  }
  if (!handlerConfigured) {
    handlerConfigured = true;
    // Foreground presentation — realtime events arrive instantly via Supabase channels, so
    // we always want the banner/sound to show immediately rather than being queued/suppressed.
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return notificationsModule;
}

let cachedToken: string | null = null;

/**
 * Requests OS permission (if not already granted) and returns the Expo push token for this
 * device. Returns null on simulators/emulators (no push capability), in Expo Go (remote
 * push unsupported there since SDK 53 — needs a development build), or if permission is
 * denied — callers should treat null as "can't register a token right now", not throw.
 */
export async function getExpoPushToken(): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications) {
    console.warn(
      'Push notifications require a development build — unsupported in Expo Go on Android since SDK 53.',
    );
    return null;
  }

  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device — skipping token registration.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Push notification permission denied.');
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    cachedToken = data;
    return data;
  } catch (error) {
    console.warn('Failed to get Expo push token:', error);
    return null;
  }
}

export function getCachedExpoPushToken(): string | null {
  return cachedToken;
}

/**
 * Registers (or refreshes) this device's push token with the backend via the
 * upsert_push_token RPC — idempotent, safe to call on every app foreground.
 */
export async function registerPushToken(): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;

  const deviceType = Platform.OS === 'ios' ? 'ios' : 'android';
  const { error } = await supabase.rpc('upsert_push_token', {
    p_expo_push_token: token,
    p_device_type: deviceType,
  });
  if (error) {
    console.warn('Failed to upsert push token:', error.message);
  }
}

/**
 * Removes this device's token from the backend (e.g. when the user toggles push off or
 * logs out) so it stops receiving deliveries.
 */
export async function unregisterPushToken(): Promise<void> {
  const token = cachedToken;
  if (!token) return;
  const { error } = await supabase.from('push_tokens').delete().eq('expo_push_token', token);
  if (error) {
    console.warn('Failed to remove push token:', error.message);
  }
}

/**
 * Immediately presents a local notification — used for realtime-triggered alerts. Local
 * (non-remote) scheduling still works in Expo Go, but we no-op there for consistency since
 * getNotifications() is the single gate for the whole module.
 */
export async function presentNotification(title: string, body: string): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch (error) {
    console.warn('Failed to present notification:', error);
  }
}

/** Tap handler — logs the payload only; routing is deferred (see plan's Out of Scope). */
export function addNotificationResponseListener(
  callback: (response: NotificationsType.NotificationResponse) => void,
) {
  const Notifications = getNotifications();
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(callback);
}
