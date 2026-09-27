export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Every value (including metadata) remains inside Keychain. Double buffering means
// interrupted writes never combine old and new chunks. A missing chunk fails closed.
const CHUNK_LENGTH = 450; // <=1800 UTF-8 bytes even for four-byte code points.
const MAX_CHUNKS = 128;
export function createSecureStorage(store: KeyValueStore, prefix: string) {
  let disabled = false;
  let tail = Promise.resolve();
  const serial = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
  const keyName = (key: string) => `${prefix}.${key.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const metadata = async (key: string) => {
    const raw = await store.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('slot' in value) || !('count' in value) ||
        (value.slot !== 0 && value.slot !== 1) || !Number.isInteger(value.count) ||
        typeof value.count !== 'number' || value.count < 1 || value.count > MAX_CHUNKS) {
      throw new Error('Secure session metadata is invalid.');
    }
    return value as { slot: number; count: number };
  };
  return {
    getItem: (key: string) => serial(async () => {
      if (disabled) return null;
      const name = keyName(key);
      const meta = await metadata(name);
      if (!meta) return null;
      const chunks: string[] = [];
      for (let i = 0; i < meta.count; i++) {
        const part = await store.getItem(`${name}.${meta.slot}.${i}`);
        if (part === null) throw new Error('Secure session is incomplete. Sign in again.');
        chunks.push(part);
      }
      return chunks.join('');
    }),
    setItem: (key: string, value: string) => serial(async () => {
      if (disabled) throw new Error('This session has ended.');
      const name = keyName(key);
      const old = await metadata(name);
      const slot = old?.slot === 0 ? 1 : 0;
      const characters = Array.from(value);
      const count = Math.max(1, Math.ceil(characters.length / CHUNK_LENGTH));
      if (count > MAX_CHUNKS) throw new Error('Session is too large for secure storage.');
      for (let i = 0; i < count; i++) {
        await store.setItem(`${name}.${slot}.${i}`, characters.slice(i * CHUNK_LENGTH, (i + 1) * CHUNK_LENGTH).join(''));
      }
      if (disabled) throw new Error('This session has ended.');
      await store.setItem(name, JSON.stringify({ slot, count }));
      if (old) for (let i = 0; i < old.count; i++) await store.removeItem(`${name}.${old.slot}.${i}`);
    }),
    removeItem: (key: string) => serial(async () => {
      const name = keyName(key);
      // Delete commit marker first, then both slots including interrupted writes.
      await store.removeItem(name);
      const results = await Promise.allSettled(Array.from({ length: MAX_CHUNKS * 2 }, (_, i) =>
        store.removeItem(`${name}.${Math.floor(i / MAX_CHUNKS)}.${i % MAX_CHUNKS}`)));
      if (results.some((r) => r.status === 'rejected')) throw new Error('Secure cleanup needs retry.');
    }),
    disable: () => { disabled = true; },
  };
}
