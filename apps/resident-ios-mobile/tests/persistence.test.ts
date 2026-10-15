import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createPublicCache, freshness, type CachePolicy } from '../src/data/public-cache';
import { createProtectedDrafts } from '../src/lib/protected-drafts';
import { createSecureStorage, type KeyValueStore } from '../src/lib/secure-storage-core';

function memory() {
  const entries = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (key) => entries.get(key) ?? null,
    setItem: async (key, value) => { entries.set(key, value); },
    removeItem: async (key) => { entries.delete(key); },
  };
  return { entries, store };
}
const TENANT = '22222222-2222-4222-8222-222222222222';
const scopeA = { environment: 'staging' as const, barangayId: TENANT, userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
const scopeB = { ...scopeA, userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
const draft = z.object({ notes: z.string() });

function drafts() {
  const keychain = memory();
  return { keychain, drafts: createProtectedDrafts(createSecureStorage(keychain.store, 'drafts'), () => 1000) };
}

describe('protected drafts (P02-T04, F07)', () => {
  it('round-trips a draft only for the same account, tenant, environment, kind and schema version', async () => {
    const { drafts: store } = drafts();
    await store.save(scopeA, 'request-form', 1, { notes: 'private' });
    expect(await store.read(scopeA, 'request-form', 1, draft)).toEqual({ value: { notes: 'private' }, savedAt: 1000 });
    expect(await store.read(scopeB, 'request-form', 1, draft)).toBeNull();
    expect(await store.read({ ...scopeA, environment: 'production' }, 'request-form', 1, draft)).toBeNull();
    expect(await store.read(scopeA, 'request-form', 2, draft)).toBeNull();
    // The older-schema read discarded the entry rather than hiding it.
    expect(await store.read(scopeA, 'request-form', 1, draft)).toBeNull();
  });
  it('refuses guest drafts and reports Keychain write failures without any plaintext fallback', async () => {
    const keychain = memory();
    const store = createProtectedDrafts(createSecureStorage({ ...keychain.store, setItem: async () => { throw new Error('errSecInteractionNotAllowed'); } }, 'drafts'));
    await expect(store.save({ ...scopeA, userId: null }, 'request-form', 1, { notes: 'x' })).rejects.toMatchObject({ kind: 'session' });
    await expect(store.save(scopeA, 'request-form', 1, { notes: 'x' })).rejects.toThrow();
    expect([...keychain.entries.values()].some((value) => value.includes('"notes"'))).toBe(false);
  });
  it('purges every account on logout and other accounts on account switch', async () => {
    const { drafts: store, keychain } = drafts();
    await store.save(scopeA, 'request-form', 1, { notes: 'a' });
    await store.save(scopeB, 'concern-form', 1, { notes: 'b' });
    await store.purgeOthers(scopeB);
    expect(await store.read(scopeB, 'concern-form', 1, draft)).not.toBeNull();
    expect([...keychain.entries.values()].some((value) => value.includes('"a"'))).toBe(false);
    await store.purgeAll();
    expect(await store.read(scopeB, 'concern-form', 1, draft)).toBeNull();
    expect([...keychain.entries.keys()].filter((key) => key.includes('draft.'))).toEqual([]);
  });
  it('indexes an entry before writing it, so an interrupted write is still purged', async () => {
    const keychain = memory();
    let failValue = true;
    const store = createProtectedDrafts(createSecureStorage({
      ...keychain.store,
      setItem: async (key, value) => { if (failValue && key.includes('draft.') && !key.includes('draft-index')) throw new Error('killed'); await keychain.store.setItem(key, value); },
    }, 'drafts'));
    await expect(store.save(scopeA, 'request-form', 1, { notes: 'x' })).rejects.toThrow();
    failValue = false;
    await store.purgeAll();
    expect(JSON.parse(await createSecureStorage(keychain.store, 'drafts').getItem('draft-index') ?? '[]')).toEqual([]);
  });
  it('keeps a failed removal in the index and reports it, so cleanup can be retried', async () => {
    const keychain = memory();
    let failRemove = false;
    const store = createProtectedDrafts(createSecureStorage({ ...keychain.store, removeItem: async (key) => { if (failRemove && key.includes('draft.')) throw new Error('locked'); await keychain.store.removeItem(key); } }, 'drafts'));
    await store.save(scopeA, 'request-form', 1, { notes: 'x' });
    failRemove = true;
    await expect(store.purgeAll()).rejects.toThrow(/retry/i);
    failRemove = false;
    await store.purgeAll();
    expect(await store.read(scopeA, 'request-form', 1, draft)).toBeNull();
  });
});

const policy: CachePolicy = { contractVersion: 1, staleAfterMs: 100, expireAfterMs: 1000 };
const items = z.array(z.object({ id: z.string() }));

describe('public emergency cache (P02-T07, F07)', () => {
  it('labels freshness, including clock moved backwards', () => {
    expect(freshness(1000, 1050, policy)).toBe('fresh');
    expect(freshness(1000, 1200, policy)).toBe('stale');
    expect(freshness(1000, 3000, policy)).toBe('expired');
    expect(freshness(1000, 900, policy)).toBe('expired');
  });
  it('returns the copy only for the same environment, tenant, key and contract version', async () => {
    const { store, entries } = memory();
    let now = 1000;
    const cache = createPublicCache(store, { environment: 'staging', barangayId: TENANT }, () => now);
    expect(await cache.write('centers', [{ id: 'c1' }], policy)).toBe(true);
    now = 1500;
    expect(await cache.read('centers', items, policy)).toEqual({ data: [{ id: 'c1' }], fetchedAt: 1000, freshness: 'stale' });
    expect(await createPublicCache(store, { environment: 'production', barangayId: TENANT }).read('centers', items, policy)).toBeNull();
    expect(await createPublicCache(store, { environment: 'staging', barangayId: '33333333-3333-4333-8333-333333333333' }).read('centers', items, policy)).toBeNull();
    expect(await cache.read('centers', items, { ...policy, contractVersion: 2 })).toBeNull();
    expect(entries.size).toBe(0); // the mismatched-version entry was discarded
  });
  it('discards corrupt or tampered entries instead of showing them', async () => {
    const { store, entries } = memory();
    const cache = createPublicCache(store, { environment: 'staging', barangayId: TENANT }, () => 1000);
    entries.set(`resident-ios.public.staging.${TENANT}.centers`, '{not json');
    expect(await cache.read('centers', items, policy)).toBeNull();
    entries.set(`resident-ios.public.staging.${TENANT}.centers`, JSON.stringify({ format: 1, environment: 'staging', barangayId: 'other', key: 'centers', contractVersion: 1, fetchedAt: 1, data: [] }));
    expect(await cache.read('centers', items, policy)).toBeNull();
    expect(entries.size).toBe(0);
  });
  it('reports a failed write instead of throwing, so fresh data is still shown', async () => {
    const cache = createPublicCache({ getItem: async () => null, setItem: async () => { throw new Error('full'); }, removeItem: async () => undefined }, { environment: 'staging', barangayId: TENANT });
    expect(await cache.write('centers', [], policy)).toBe(false);
  });
});
