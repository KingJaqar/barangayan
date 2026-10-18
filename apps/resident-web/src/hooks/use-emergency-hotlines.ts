'use client';

import type { Tables } from '@barangayan/shared';
import { useEffect } from 'react';

import { useScopedRead } from '@/hooks/use-scoped-read';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';

export type EmergencyHotline = Tables<'emergency_information'>;

/** Web port of use-emergency-hotlines.ts [C-013] — see use-emergency-guidelines.ts's
 * doc comments for the offline-caching-dropped rationale and the read-state fields, which
 * apply identically here. */
export function useEmergencyHotlines(barangayId: string | null): {
  hotlines: EmergencyHotline[];
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isReady: boolean;
  error: string | null;
  errorAnnounced: boolean;
  refetch: (contentName?: string) => void;
} {
  const read = useScopedRead<EmergencyHotline[]>(barangayId ?? '*', () => {
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from('emergency_information')
      .select('*')
      .eq('category', 'hotlines')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (barangayId) query = query.eq('barangay_id', barangayId);
    return query.then(({ data, error }) => ({ data: (data ?? []) as EmergencyHotline[], error }));
  });
  const { refetch } = read;

  useEffect(() => {
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
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [barangayId, refetch]);

  return {
    hotlines: read.data ?? [],
    isLoading: read.isLoading,
    isInitialLoading: read.isInitialLoading,
    isRefreshing: read.isRefreshing,
    isReady: read.isReady,
    error: read.error,
    errorAnnounced: read.errorAnnounced,
    refetch,
  };
}
