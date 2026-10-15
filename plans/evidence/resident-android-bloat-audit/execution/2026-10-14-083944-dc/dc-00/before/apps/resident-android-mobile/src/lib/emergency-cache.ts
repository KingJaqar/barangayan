import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'emergency_cache_';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const QUEUE_PREFIX = 'emergency_queue_';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface QueueEntry {
  id: string;
  data: Record<string, unknown>;
  timestamp: number;
}

function keyFor(tag: string): string {
  return `${CACHE_PREFIX}${tag}`;
}

function queueKeyFor(tag: string): string {
  return `${QUEUE_PREFIX}${tag}`;
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

export async function clearEmergencyCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    // ignore
  }
}

export async function enqueueCheckin(tag: string, entry: QueueEntry): Promise<void> {
  try {
    const existing = await getQueuedCheckins(tag);
    existing.push(entry);
    await AsyncStorage.setItem(queueKeyFor(tag), JSON.stringify(existing));
  } catch {
    // Storage full or unavailable — non-blocking
  }
}

export async function getQueuedCheckins(tag: string): Promise<QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(queueKeyFor(tag));
    if (!raw) return [];
    return JSON.parse(raw) as QueueEntry[];
  } catch {
    return [];
  }
}

export async function clearQueuedCheckins(tag: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(queueKeyFor(tag));
  } catch {
    // ignore
  }
}
