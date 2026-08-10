import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@barangayan/shared';

export type EmergencyQrContent = Tables<'emergency_qr_content'>;

export function useEmergencyQrContent(barangayId: string | null) {
  const [content, setContent] = useState<EmergencyQrContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(() => {
    if (!barangayId) {
      setContent([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    supabase
      .from('emergency_qr_content')
      .select('*')
      .eq('barangay_id', barangayId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .then(({ data, error: qErr }) => {
        if (qErr) {
          setError(qErr.message);
        } else {
          setContent((data ?? []) as EmergencyQrContent[]);
        }
        setIsLoading(false);
      });
  }, [barangayId]);

  useEffect(() => {
    let cancelled = false;

    doFetch();

    const channel = supabase
      .channel('mobile-emergency-qr-content')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_qr_content',
          filter: `barangay_id=eq.${barangayId}`,
        },
        () => {
          if (!cancelled) doFetch();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [doFetch, barangayId]);

  return { content, isLoading, error, refetch: doFetch };
}
