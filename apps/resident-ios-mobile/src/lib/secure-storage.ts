import * as SecureStore from 'expo-secure-store';
import { createSecureStorage } from './secure-storage-core';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'barangayan.resident.ios',
};

export function newSessionStorage(prefix: string) {
  return createSecureStorage({
    getItem: (key) => SecureStore.getItemAsync(key, options),
    setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
    removeItem: (key) => SecureStore.deleteItemAsync(key, options),
  }, prefix);
}
