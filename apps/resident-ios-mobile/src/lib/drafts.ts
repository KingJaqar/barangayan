import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { DataScope } from '../data/scope';
import { createProtectedDrafts } from './protected-drafts';
import { createSecureStorage } from './secure-storage-core';

// Same Keychain service and accessibility as the session: device-only, unlocked access.
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'barangayan.resident.ios',
};

export const drafts = createProtectedDrafts(createSecureStorage({
  getItem: (key) => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: (key) => SecureStore.deleteItemAsync(key, options),
}, 'resident-ios.drafts'));

/** Persistent tombstone: set before a purge, cleared only after it fully succeeds. */
const PURGE_PENDING = 'resident-ios.drafts.purge-pending';

/**
 * Removes every private draft. If removal is interrupted (Keychain error, app killed), the
 * tombstone makes the next launch finish it before any draft can be read.
 */
export async function purgeAllDrafts(): Promise<void> {
  await AsyncStorage.setItem(PURGE_PENDING, '1');
  await drafts.purgeAll();
  await AsyncStorage.removeItem(PURGE_PENDING);
}

export async function finishPendingDraftPurge(): Promise<void> {
  if (await AsyncStorage.getItem(PURGE_PENDING)) await purgeAllDrafts();
}

/**
 * After a different account signs in, drafts of every other account are removed. If that
 * fails, the tombstone purges everything on the next launch (fail closed toward privacy).
 */
export async function purgeOtherAccountDrafts(scope: DataScope): Promise<void> {
  try { await drafts.purgeOthers(scope); } catch { await AsyncStorage.setItem(PURGE_PENDING, '1'); }
}
