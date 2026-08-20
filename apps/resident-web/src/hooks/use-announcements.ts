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
 */
export function useAnnouncements(options: { barangayId: string | null; category?: AnnouncementCategory }): {
  announcements: AnnouncementRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { barangayId, category } = options;
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const doFetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    let query = supabase.from('announcements').select('*').is('deleted_at', null).order('published_at', { ascending: false });

    if (barangayId) query = query.eq('barangay_id', barangayId);
    if (category) query = query.eq('category', category);

    query.then(({ data, error: qErr }) => {
      if (cancelledRef.current) return;
      if (qErr) {
        setError(qErr.message);
      } else {
        setAnnouncements((data ?? []) as AnnouncementRow[]);
      }
      setIsLoading(false);
    });
  }, [barangayId, category]);

  useEffect(() => {
    cancelledRef.current = false;
    // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
    // react-hooks/set-state-in-effect.
    Promise.resolve().then(() => doFetch());

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(uniqueChannelName(`announcements:${category ?? 'all'}:${barangayId ?? 'all'}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        if (!cancelledRef.current) doFetch();
      })
      .subscribe();

    return () => {
      cancelledRef.current = true;
      supabase.removeChannel(channel);
    };
  }, [doFetch, barangayId, category]);

  return { announcements, isLoading, error, refetch: doFetch };
}
