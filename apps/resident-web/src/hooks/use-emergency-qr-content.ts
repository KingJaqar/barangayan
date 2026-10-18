'use client';

import type { Tables } from '@barangayan/shared';
import { useEffect } from 'react';

import { useScopedRead } from '@/hooks/use-scoped-read';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';

export type EmergencyQrContentRow = Tables<'emergency_qr_content'>;

/** Web port of use-emergency-qr-content.ts [C-014] — backs the Scan tab's "Why Scan" /
 * "How It Works" instructional cards. Offline caching dropped, see
 * use-emergency-guidelines.ts's doc comment (which also explains the read-state fields). */
export function useEmergencyQrContent(barangayId: string | null): {
  content: EmergencyQrContentRow[];
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isReady: boolean;
  error: string | null;
  errorAnnounced: boolean;
  refetch: (contentName?: string) => void;
} {
  const read = useScopedRead<EmergencyQrContentRow[]>(barangayId ?? '*', () => {
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from('emergency_qr_content')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (barangayId) query = query.eq('barangay_id', barangayId);
    return query.then(({ data, error }) => ({ data: (data ?? []) as EmergencyQrContentRow[], error }));
  });
  const { refetch } = read;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(uniqueChannelName(`emergency-qr-content:${barangayId ?? 'all'}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_qr_content',
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
    content: read.data ?? [],
    isLoading: read.isLoading,
    isInitialLoading: read.isInitialLoading,
    isRefreshing: read.isRefreshing,
    isReady: read.isReady,
    error: read.error,
    errorAnnounced: read.errorAnnounced,
    refetch,
  };
}
