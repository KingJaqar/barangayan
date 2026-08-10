import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@barangayan/shared';

export type EmergencyHotline = Tables<'emergency_information'>;

export function useEmergencyHotlines(barangayId: string | null): {
  hotlines: EmergencyHotline[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [hotlines, setHotlines] = useState<EmergencyHotline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(() => {
    if (!barangayId) {
      setHotlines([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    supabase
      .from('emergency_information')
      .select('*')
      .eq('barangay_id', barangayId)
      .eq('category', 'hotlines')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .then(({ data, error: qErr }) => {
        if (qErr) {
          setError(qErr.message);
        } else {
          setHotlines((data ?? []) as EmergencyHotline[]);
        }
        setIsLoading(false);
      });
  }, [barangayId]);

  useEffect(() => {
    let cancelled = false;

    doFetch();

    const channel = supabase
      .channel('emergency-hotlines')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_information',
          filter: `category=eq.hotlines`,
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
  }, [doFetch]);

  return { hotlines, isLoading, error, refetch: doFetch };
}
