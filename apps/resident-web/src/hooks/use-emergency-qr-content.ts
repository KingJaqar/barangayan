'use client';

import type { Tables } from '@barangayan/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';

export type EmergencyQrContentRow = Tables<'emergency_qr_content'>;

/** Web port of use-emergency-qr-content.ts [C-014] — backs the Scan tab's "Why Scan" /
 * "How It Works" instructional cards. Offline caching dropped, see
 * use-emergency-guidelines.ts's doc comment. */
export function useEmergencyQrContent(barangayId: string | null): {
  content: EmergencyQrContentRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [content, setContent] = useState<EmergencyQrContentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const doFetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    let query = supabase
      .from('emergency_qr_content')
      .select('*')
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
        setContent((data ?? []) as EmergencyQrContentRow[]);
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
      .channel(uniqueChannelName(`emergency-qr-content:${barangayId ?? 'all'}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_qr_content',
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

  return { content, isLoading, error, refetch: doFetch };
}
