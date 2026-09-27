import { describe, expect, it } from 'vitest';
import { createSecureStorage, type KeyValueStore } from '../src/lib/secure-storage-core';

function fixture() {
  const entries = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (key) => entries.get(key) ?? null,
    setItem: async (key, value) => { entries.set(key, value); },
    removeItem: async (key) => { entries.delete(key); },
  };
  return { entries, store, storage: createSecureStorage(store, 'test') };
}
describe('Keychain storage boundary', () => {
  it('round-trips realistic large Unicode session metadata using bounded secure values', async () => {
    const { entries, storage } = fixture();
    const session = JSON.stringify({ access_token: 'a'.repeat(5000), user: { name: '🏡José'.repeat(2000) } });
    await storage.setItem('auth', session);
    expect(await storage.getItem('auth')).toBe(session);
    for (const value of entries.values()) expect(new TextEncoder().encode(value).byteLength).toBeLessThan(2048);
  });
  it('retains the prior complete session after an interrupted replacement', async () => {
    const { storage, store } = fixture();
    await storage.setItem('auth', 'previous');
    const original = store.setItem;
    store.setItem = async (key, value) => { if (key.endsWith('.1.1')) throw new Error('Keychain failed'); await original(key, value); };
    await expect(storage.setItem('auth', 'new'.repeat(500))).rejects.toThrow();
    expect(await storage.getItem('auth')).toBe('previous');
  });
  it('fails closed for a missing secure chunk without plaintext fallback', async () => {
    const { storage, entries } = fixture();
    await storage.setItem('auth', 'secret');
    entries.delete('test.auth.0.0');
    await expect(storage.getItem('auth')).rejects.toThrow('incomplete');
  });
  it('logout rejects late writes and removes both committed and interrupted slots', async () => {
    const { storage, entries } = fixture();
    await storage.setItem('auth', 'secret');
    entries.set('test.auth.1.4', 'interrupted');
    storage.disable();
    await expect(storage.setItem('auth', 'late')).rejects.toThrow('ended');
    await storage.removeItem('auth');
    expect(await storage.getItem('auth')).toBeNull();
    expect(entries.size).toBe(0);
  });
  it('rejects unbounded payloads and malformed metadata', async () => {
    const { storage, entries } = fixture();
    await expect(storage.setItem('auth', 'x'.repeat(60000))).rejects.toThrow('large');
    entries.set('test.auth', '{"slot":0,"count":999999}');
    await expect(storage.getItem('auth')).rejects.toThrow('metadata');
  });
});
