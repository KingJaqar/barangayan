import { z, type ZodType } from 'zod';
import type { KeyValueStore } from '../lib/secure-storage-core';

/**
 * Cache for *public* tenant content only — emergency guidelines/hotlines, QR guidance and
 * evacuation centers (plan §3, P02-T07, A51-014…017). Private records are never written
 * here: they stay in memory, and drafts go to the protected (Keychain) store.
 *
 * Every entry carries environment, tenant, cache key, contract version and fetch time.
 * A mismatched or corrupt entry is discarded, never shown. Freshness is explicit so an
 * old operational fact cannot look current.
 */
export type CachePolicy = {
  /** Bump when the cached projection's shape changes; older entries are discarded. */
  contractVersion: number;
  /** Older than this: shown with a "may be out of date" label. */
  staleAfterMs: number;
  /** Older than this: shown only as expired reference information, never as current. */
  expireAfterMs: number;
};
export type Freshness = 'fresh' | 'stale' | 'expired';
export type CachedValue<T> = { data: T; fetchedAt: number; freshness: Freshness };
export type PublicScope = { environment: string; barangayId: string };

const envelope = z.object({
  format: z.literal(1),
  environment: z.string(),
  barangayId: z.string(),
  key: z.string(),
  contractVersion: z.number().int(),
  fetchedAt: z.number().int().positive(),
  data: z.unknown(),
});

export function freshness(fetchedAt: number, now: number, policy: CachePolicy): Freshness {
  const age = now - fetchedAt;
  // A future timestamp means the device clock moved; treat it as untrustworthy.
  if (age < 0 || age > policy.expireAfterMs) return 'expired';
  return age > policy.staleAfterMs ? 'stale' : 'fresh';
}

export function createPublicCache(store: KeyValueStore, scope: PublicScope, now: () => number = Date.now) {
  const storageKey = (key: string) => `resident-ios.public.${scope.environment}.${scope.barangayId}.${key}`;
  return {
    async read<T>(key: string, schema: ZodType<T>, policy: CachePolicy): Promise<CachedValue<T> | null> {
      let raw: string | null;
      try { raw = await store.getItem(storageKey(key)); } catch { return null; }
      if (!raw) return null;
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      const entry = envelope.safeParse(parsed);
      const data = entry.success ? schema.safeParse(entry.data.data) : null;
      if (!entry.success || !data?.success || entry.data.environment !== scope.environment || entry.data.barangayId !== scope.barangayId ||
          entry.data.key !== key || entry.data.contractVersion !== policy.contractVersion) {
        await store.removeItem(storageKey(key)).catch(() => undefined);
        return null;
      }
      return { data: data.data, fetchedAt: entry.data.fetchedAt, freshness: freshness(entry.data.fetchedAt, now(), policy) };
    },
    /** Returns false when the device could not store the copy; the fresh data is still shown. */
    async write<T>(key: string, data: T, policy: CachePolicy): Promise<boolean> {
      const value = { format: 1, environment: scope.environment, barangayId: scope.barangayId, key, contractVersion: policy.contractVersion, fetchedAt: now(), data };
      try { await store.setItem(storageKey(key), JSON.stringify(value)); return true; } catch { return false; }
    },
  };
}

const HOUR = 60 * 60 * 1000;
/** Guidelines/hotlines change rarely; a month-old copy is reference only. (Decision P02-D04.) */
export const EMERGENCY_CONTENT_POLICY: CachePolicy = { contractVersion: 1, staleAfterMs: 24 * HOUR, expireAfterMs: 30 * 24 * HOUR };
/** Occupancy is an operational fact: stale after Android's 30-minute cache TTL, expired after a day. (Decision P02-D04.) */
export const CENTER_POLICY: CachePolicy = { contractVersion: 1, staleAfterMs: HOUR / 2, expireAfterMs: 24 * HOUR };
