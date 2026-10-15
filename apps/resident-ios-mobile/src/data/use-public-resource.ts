import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { ZodType } from 'zod';
import { useResident } from '../lib/runtime';
import { isCancelled } from './outcome';
import { createPublicCache, freshness, type CachePolicy, type Freshness } from './public-cache';

export type PublicResource<T> = {
  data?: T;
  /** 'network' was confirmed by the server in this session; 'cache' is an earlier offline copy. */
  source?: 'network' | 'cache';
  freshness?: Freshness;
  fetchedAt?: number;
  /** The last refresh failed; any data shown is the cached copy. */
  error?: unknown;
  loading: boolean;
  /** The confirmed data could not be stored for offline use. */
  cacheFailed: boolean;
};

/**
 * Public tenant content with an offline copy (plan P02-T07): the cached copy is shown
 * first with its age, then replaced by the server's answer. A failed refresh keeps the
 * labelled copy instead of an empty screen; there is no offline write queue.
 */
export function usePublicResource<T>(key: string, read: (signal: AbortSignal) => Promise<T>, schema: ZodType<T>, policy: CachePolicy) {
  const { config } = useResident();
  const cache = useMemo(() => createPublicCache(AsyncStorage, { environment: config.environment, barangayId: config.barangayId }), [config.environment, config.barangayId]);
  const scope = `${config.environment}:${config.barangayId}:${key}`;
  const latest = useRef({ read, schema, policy });
  useEffect(() => { latest.current = { read, schema, policy }; });
  const active = useRef<AbortController | null>(null);
  const [state, setState] = useState<PublicResource<T> & { scope: string }>({ scope, loading: true, cacheFailed: false });

  const refresh = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const { read: load, schema: shape, policy: rules } = latest.current;
    setState((previous) => previous.scope === scope ? { ...previous, loading: true } : { scope, loading: true, cacheFailed: false });
    const cached = await cache.read(key, shape, rules);
    if (controller.signal.aborted) return;
    if (cached) setState((previous) => previous.source === 'network' ? previous : { ...previous, data: cached.data, source: 'cache', freshness: cached.freshness, fetchedAt: cached.fetchedAt });
    try {
      const data = await load(controller.signal);
      if (controller.signal.aborted) return;
      const saved = await cache.write(key, data, rules);
      if (controller.signal.aborted) return;
      setState({ scope, data, source: 'network', freshness: 'fresh', fetchedAt: Date.now(), loading: false, cacheFailed: !saved });
    } catch (error) {
      if (controller.signal.aborted || isCancelled(error)) return;
      // Re-age whatever is still shown: a copy confirmed hours ago is no longer fresh.
      setState((previous) => ({ ...previous, scope, loading: false, error, freshness: previous.fetchedAt ? freshness(previous.fetchedAt, Date.now(), rules) : previous.freshness }));
    }
  }, [cache, key, scope]);

  useEffect(() => {
    void refresh();
    const lifecycle = AppState.addEventListener('change', (next) => { if (next === 'active') void refresh(); });
    return () => { active.current?.abort(); lifecycle.remove(); };
  }, [refresh]);

  const current: PublicResource<T> = state.scope === scope ? state : { loading: true, cacheFailed: false };
  return { ...current, refresh };
}
