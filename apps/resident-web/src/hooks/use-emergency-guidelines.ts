'use client';

import type { Tables } from '@barangayan/shared';
import { useEffect } from 'react';

import { useScopedRead } from '@/hooks/use-scoped-read';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';

export type EmergencyGuideline = Tables<'emergency_information'>;

/**
 * Web port of apps/resident-android-mobile/src/hooks/use-emergency-guidelines.ts
 * [C-013]. Offline caching (AsyncStorage + the 6s seed-data fallback) is dropped —
 * offline support is an explicit non-goal for resident-web (plan §9/§14 Phase 7).
 *
 * Read state (feedback plan RW-LT-05): scoped by barangay with newest-request-wins
 * (see use-scoped-read.ts). `isLoading` keeps its meaning (any fetch in flight, including a
 * Realtime refetch); `isInitialLoading` / `isRefreshing` / `isReady` let consumers keep a
 * loaded list visible during a refresh and tell a failed read from an empty one.
 */
export function useEmergencyGuidelines(barangayId: string | null): {
  guidelines: EmergencyGuideline[];
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isReady: boolean;
  error: string | null;
  errorAnnounced: boolean;
  refetch: (contentName?: string) => void;
} {
  const read = useScopedRead<EmergencyGuideline[]>(barangayId ?? '*', () => {
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from('emergency_information')
      .select('*')
      .eq('category', 'guidelines')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (barangayId) query = query.eq('barangay_id', barangayId);
    return query.then(({ data, error }) => ({ data: (data ?? []) as EmergencyGuideline[], error }));
  });
  const { refetch } = read;

  useEffect(() => {
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
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [barangayId, refetch]);

  return {
    guidelines: read.data ?? [],
    isLoading: read.isLoading,
    isInitialLoading: read.isInitialLoading,
    isRefreshing: read.isRefreshing,
    isReady: read.isReady,
    error: read.error,
    errorAnnounced: read.errorAnnounced,
    refetch,
  };
}
