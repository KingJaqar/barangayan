import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'emergency_cache_';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function keyFor(tag: string): string {
  return `${CACHE_PREFIX}${tag}`;
}

export async function getCachedData<T>(tag: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(tag));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(keyFor(tag));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export async function setCachedData<T>(tag: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(keyFor(tag), JSON.stringify(entry));
  } catch {
    // Storage full or unavailable — non-blocking
  }
}
