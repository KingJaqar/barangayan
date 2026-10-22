import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecordStore } from './push-controller';

/**
 * Where this device remembers which token it registered and for whom (see `PushRecord`). The record holds a push address,
 * not a credential or any resident data, so it uses the same installation storage as the other non-secret markers. It is
 * not removed at logout: a removal that could not be confirmed must survive it.
 */
export function pushRecordStore(host: string): RecordStore {
  const key = `resident-ios.${host}.push-device`;
  return {
    read: () => AsyncStorage.getItem(key),
    write: (value) => (value === null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, value)),
  };
}
