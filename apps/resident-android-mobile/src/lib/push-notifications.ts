import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsType from 'expo-notifications';

import {
  createSerialQueue,
  registerDevice,
  releaseDevice,
  retryPendingRelease,
  type PermissionState,
  type PushApi,
  type PushPort,
  type RecordStore,
  type RegistrationResult,
} from '@/lib/push-registration';
import type { PushTap } from '@/lib/notification-tap';
import { supabase } from '@/lib/supabase';

// Remote push notifications were removed from Expo Go on Android in SDK 53 — merely
// *importing* expo-notifications there throws (its module-level auto-registration code
// runs on import, before any of our own guards get a chance to run). So the module must
// never be statically imported; it's lazy-required, and only outside Expo Go.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** The one channel alerts use. The `expo-notifications` plugin in app.json makes it the channel remote pushes arrive on. */
const CHANNEL_ID = 'default';
/** Not cleared by sign-out: it carries the retry marker for a token release that could not be confirmed. */
const RECORD_KEY = 'push-token-record-v1';
const RELEASE_TIMEOUT_MS = 5000;

let notificationsModule: typeof NotificationsType | null = null;
let handlerConfigured = false;
let channelReady: Promise<unknown> | null = null;

function getNotifications(): typeof NotificationsType | null {
  if (isExpoGo) return null;
  if (!notificationsModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require('expo-notifications') as typeof NotificationsType;
  }
  if (!handlerConfigured) {
    handlerConfigured = true;
    // Foreground presentation — the server's push arrives while the app is open, and the banner/sound
    // should show immediately rather than being queued/suppressed.
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

/** Android 13+ shows the permission prompt only once a channel exists, so every permission or token call goes through here first. */
function ensureChannel(Notifications: typeof NotificationsType): Promise<unknown> {
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Barangay alerts',
    importance: Notifications.AndroidImportance.HIGH,
  }).catch((error) => {
    channelReady = null;
    throw error;
  });
  return channelReady;
}

function permissionState(status: NotificationsType.NotificationPermissionsStatus): PermissionState {
  if (status.granted) return 'granted';
  return status.status === 'undetermined' ? 'undetermined' : 'denied';
}

const nativePort: PushPort = {
  async permission() {
    const Notifications = getNotifications();
    if (!Notifications) return 'denied';
    return permissionState(await Notifications.getPermissionsAsync());
  },
  async requestPermission() {
    const Notifications = getNotifications();
    if (!Notifications) return 'denied';
    await ensureChannel(Notifications);
    return permissionState(await Notifications.requestPermissionsAsync());
  },
  async token() {
    const Notifications = getNotifications();
    // Emulators have no push capability and Expo Go cannot receive remote push; neither is an error.
    if (!Notifications || !Device.isDevice) return null;
    await ensureChannel(Notifications);
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    try {
      return (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    } catch {
      return null;
    }
  },
};

const recordStore: RecordStore = {
  read: () => AsyncStorage.getItem(RECORD_KEY),
  write: (value) => (value === null ? AsyncStorage.removeItem(RECORD_KEY) : AsyncStorage.setItem(RECORD_KEY, value)),
};

const api: PushApi = {
  async register(token) {
    const { error } = await supabase.rpc('upsert_push_token', { p_expo_push_token: token, p_device_type: 'android' });
    if (error) throw new Error('Push token could not be registered.');
  },
  // The server releases a token for whoever holds it, so this works signed out; a slow connection ends at the timeout and leaves the retry marker.
  async release(token) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RELEASE_TIMEOUT_MS);
    try {
      const { error } = await supabase.rpc('release_push_token', { p_expo_push_token: token }).abortSignal(controller.signal);
      if (error) throw new Error('Push token could not be released.');
    } finally {
      clearTimeout(timer);
    }
  },
};

/** Every registration and removal on this device goes through one queue, so a sign-out release never lands after the next account's registration. */
const pushQueue = createSerialQueue();

/**
 * Registers this device's token for the signed-in account (idempotent; safe on every foreground). Only an explicit action —
 * turning alerts on — may show the OS permission prompt; a denied or undetermined permission leaves history intact and
 * is never retried by the app on its own.
 */
export function registerPushToken(userId: string, options: { askPermission?: boolean } = {}): Promise<RegistrationResult> {
  return pushQueue(() => registerDevice({ port: nativePort, api, store: recordStore, userId, askPermission: options.askPermission ?? false }));
}

/** Removes this device's token from the account that signed out or opted out; an unconfirmed removal is retried by `retryPendingPushRelease`. */
export async function unregisterPushToken(userId: string): Promise<void> {
  await pushQueue(() => releaseDevice({ api, store: recordStore, userId, port: nativePort }));
}

/** Completes an unconfirmed removal, signed in or not. Called when the app opens or returns to the foreground. */
export async function retryPendingPushRelease(): Promise<void> {
  await pushQueue(() => retryPendingRelease({ api, store: recordStore }));
}

/** Calls `onChange` when the device's push address changes, so the new token can be registered. Returns the unsubscribe. */
export function onDeviceTokenChange(onChange: () => void): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};
  const subscription = Notifications.addPushTokenListener(() => onChange());
  return () => subscription.remove();
}

/**
 * Calls `onTap` for every tapped notification, the one that cold-started the app included. The data is an untrusted
 * pointer. Returns the unsubscribe.
 */
export function subscribeToNotificationTaps(onTap: (tap: PushTap) => void): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};
  const emit = (response: NotificationsType.NotificationResponse | null) => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    onTap({ id: response.notification.request.identifier, data: response.notification.request.content.data });
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(emit);
  emit(Notifications.getLastNotificationResponse());
  return () => subscription.remove();
}

/** Forgets the last response once it was taken over, so it is not delivered again after a remount. */
export function clearNotificationTap(): void {
  getNotifications()?.clearLastNotificationResponse();
}

/**
 * Immediately presents a local notification. Only the Health alerts still use it; the migrated alerts
 * (announcements, document requests, incident reports) arrive as server pushes.
 */
export async function presentNotification(title: string, body: string): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    await ensureChannel(Notifications);
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { channelId: CHANNEL_ID },
    });
  } catch (error) {
    console.warn('Failed to present notification:', error);
  }
}
