'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminBrowseDatabase } from '@/lib/admin-tables/queries/schema';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/** Detail membership is checked by ID through the same tenant/active-admin view,
 * independently of the current search, filters and page. A failed read is never
 * interpreted as deletion. Aborted/stale reads cannot replace another record. */
export function useProfileTableDetail<T extends { id: string }>(name: 'residents' | 'households' | 'incidents' | 'health' | 'applicants', revision: unknown,
  settle: () => Promise<boolean>) {
  const [selected, setSelected] = useState<T | null>(null);
  const [loaded, setLoaded] = useState<{ id: string; revision: unknown; retryVersion: number;
    status: 'ready' | 'unavailable' | 'error' } | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const trigger = useRef<HTMLElement | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  const generation = useRef(0);
  const id = selected?.id;
  const open = useCallback(async (row: T, source?: HTMLElement) => {
    const version = ++generation.current;
    const origin = source ?? document.activeElement as HTMLElement | null;
    if (!await settle() || version !== generation.current) return;
    trigger.current = origin;
    setLoaded(null); setSelected(row);
  }, [settle]);
  const close = useCallback(() => {
    generation.current++;
    container.current?.querySelector('dialog')?.close();
    setSelected(null);
    const origin = trigger.current;
    // Closing a native dialog restores focus when its trigger still exists.
    // The search control is a stable fallback when pagination removed that row.
    const fallback = container.current?.querySelector<HTMLInputElement>('input[type="search"]');
    (origin?.isConnected && origin !== document.body && !origin.closest('[inert]') ? origin : fallback)?.focus({ preventScroll: true });
  }, []);
  const retry = useCallback(() => setRetryVersion(value => value + 1), []);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let current = true;
    const db = createSupabaseBrowserClient() as unknown as SupabaseClient<AdminBrowseDatabase>;
    void (async () => {
      try {
        const { data, error } = await db.from(`admin_${name}_browse`).select('row').eq('id', id)
          .retry(false).abortSignal(controller.signal).maybeSingle();
        if (!current) return;
        const finish = (status: 'ready' | 'unavailable' | 'error') => setLoaded({ id, revision, retryVersion, status });
        if (error) { finish('error'); return; }
        if (!data) { finish('unavailable'); return; }
        const row = data.row as unknown as T;
        if (row?.id !== id) { finish('error'); return; }
        setSelected(row); finish('ready');
      } catch { if (current) setLoaded({ id, revision, retryVersion, status: 'error' }); }
      finally { clearTimeout(timeout); }
    })();
    return () => { current = false; clearTimeout(timeout); controller.abort(); };
  }, [name, id, revision, retryVersion]);
  const status = loaded && loaded.id === id && loaded.revision === revision && loaded.retryVersion === retryVersion ? loaded.status : 'loading' as const;
  return { selected, status, open, close, retry, containerRef: container };
}
