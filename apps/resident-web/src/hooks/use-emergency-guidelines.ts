'use client';

import type { Tables } from '@barangayan/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';

export type EmergencyGuideline = Tables<'emergency_information'>;

/**
 * Web port of apps/resident-android-mobile/src/hooks/use-emergency-guidelines.ts
 * [C-013]. Offline caching (AsyncStorage + the 6s seed-data fallback) is dropped —
 * offline support is an explicit non-goal for resident-web (plan §9/§14 Phase 7).
 */
export function useEmergencyGuidelines(barangayId: string | null): {
  guidelines: EmergencyGuideline[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [guidelines, setGuidelines] = useState<EmergencyGuideline[]>([]);
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
      .eq('category', 'guidelines')
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
        setGuidelines((data ?? []) as EmergencyGuideline[]);
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
      .channel(uniqueChannelName(`emergency-guidelines:${barangayId ?? 'all'}`))
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

  return { guidelines, isLoading, error, refetch: doFetch };
}
