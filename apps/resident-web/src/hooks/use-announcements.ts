'use client';

import type { AnnouncementCategory, Tables } from '@barangayan/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';

export type AnnouncementRow = Tables<'announcements'>;

/**
 * One parameterized hook backing both this phase's Alerts tab (`category: 'emergency'`)
 * and Phase 6's Announcements feed (no category filter) — resolves the plan's CC-004,
 * which flagged mobile's separate use-emergency-announcements.ts / use-announcements.ts
 * as possibly-redundant hooks over the same `announcements` table [C-007] with different
 * filters. They are: this single hook replaces both. Whoever builds Phase 6 should import
 * this hook rather than writing a second one.
 *
 * Read state (resident-web feedback plan RW-LT-03): results and failures are keyed by the
 * barangay/category identity, so a filter change never shows another filter's rows and a
 * response for an older request (an earlier filter, or a refetch overtaken by a newer one)
 * is ignored. `isLoading` keeps its original meaning (any fetch in flight, including a
 * Realtime refetch); `isInitialLoading` / `isRefreshing` split it for consumers that keep
 * same-identity rows visible during a refresh, and `isReady` says a result (possibly
 * empty) exists for the current identity. `error` is the current identity's latest
 * failure, from either a returned error or a thrown rejection.
 */
export function useAnnouncements(options: { barangayId: string | null; category?: AnnouncementCategory }): {
  announcements: AnnouncementRow[];
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isReady: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { barangayId, category } = options;
  const identity = `${barangayId ?? '*'}|${category ?? '*'}`;
  const [result, setResult] = useState<{ identity: string; rows: AnnouncementRow[] } | null>(null);
  const [failure, setFailure] = useState<{ identity: string; message: string } | null>(null);
  const [fetching, setFetching] = useState<string | null>(null);
  const activeRef = useRef(false);
  const generationRef = useRef(0);

  const doFetch = useCallback(() => {
    // Only the newest request may settle state; older responses are dropped.
    const generation = ++generationRef.current;
    const isCurrent = () => activeRef.current && generation === generationRef.current;
    setFetching(identity);
    setFailure(null);
    const supabase = createSupabaseBrowserClient();

    let query = supabase.from('announcements').select('*').is('deleted_at', null).order('published_at', { ascending: false });

    if (barangayId) query = query.eq('barangay_id', barangayId);
    if (category) query = query.eq('category', category);

    query.then(
      ({ data, error: qErr }) => {
        if (!isCurrent()) return;
        if (qErr) {
          setFailure({ identity, message: qErr.message });
        } else {
          setResult({ identity, rows: (data ?? []) as AnnouncementRow[] });
        }
        setFetching(null);
      },
      (thrown: unknown) => {
        if (!isCurrent()) return;
        setFailure({ identity, message: thrown instanceof Error ? thrown.message : 'Request failed' });
        setFetching(null);
      },
    );
  }, [identity, barangayId, category]);

  useEffect(() => {
    activeRef.current = true;
    // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
    // react-hooks/set-state-in-effect.
    Promise.resolve().then(() => {
      if (activeRef.current) doFetch();
    });

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(uniqueChannelName(`announcements:${category ?? 'all'}:${barangayId ?? 'all'}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        if (activeRef.current) doFetch();
      })
      .subscribe();

    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [doFetch, barangayId, category]);

  const isReady = result?.identity === identity;
  const error = failure?.identity === identity ? failure.message : null;
  // Before the first fetch for this identity starts, nothing is known yet: that is
  // initial loading too (never an empty state).
  const isInitialLoading = !isReady && error === null;
  const isRefreshing = isReady && fetching === identity;

  return {
    announcements: isReady ? result.rows : [],
    isLoading: isInitialLoading || isRefreshing,
    isInitialLoading,
    isRefreshing,
    isReady,
    error,
    refetch: doFetch,
  };
}
