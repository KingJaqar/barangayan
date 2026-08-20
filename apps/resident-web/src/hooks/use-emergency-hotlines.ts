'use client';

import type { Tables } from '@barangayan/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';

export type EmergencyHotline = Tables<'emergency_information'>;

/** Web port of use-emergency-hotlines.ts [C-013] — see use-emergency-guidelines.ts's
 * doc comment for the offline-caching-dropped rationale, which applies identically here. */
export function useEmergencyHotlines(barangayId: string | null): {
  hotlines: EmergencyHotline[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [hotlines, setHotlines] = useState<EmergencyHotline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const doFetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    let query = supabase
      .from('emergency_information')
      .select('*')
      .eq('category', 'hotlines')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (barangayId) {
      query = query.eq('barangay_id', barangayId);
    }

    query.then(({ data, error: qErr }) => {
      if (cancelledRef.current) return;
      if (qErr) {
        setError(qErr.message);
      } else {
        setHotlines((data ?? []) as EmergencyHotline[]);
      }
      setIsLoading(false);
    });
  }, [barangayId]);

  useEffect(() => {
    cancelledRef.current = false;
    // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
    // react-hooks/set-state-in-effect.
    Promise.resolve().then(() => doFetch());

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(uniqueChannelName(`emergency-hotlines:${barangayId ?? 'all'}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_information',
          filter: barangayId ? `barangay_id=eq.${barangayId}` : undefined,
        },
        () => {
          if (!cancelledRef.current) doFetch();
        },
      )
      .subscribe();

    return () => {
      cancelledRef.current = true;
      supabase.removeChannel(channel);
    };
  }, [doFetch, barangayId]);

  return { hotlines, isLoading, error, refetch: doFetch };
}
