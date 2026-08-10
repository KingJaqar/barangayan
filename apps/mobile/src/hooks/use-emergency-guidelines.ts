import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@barangayan/shared';

export type EmergencyGuideline = Tables<'emergency_information'>;

export function useEmergencyGuidelines(barangayId: string | null): {
  guidelines: EmergencyGuideline[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [guidelines, setGuidelines] = useState<EmergencyGuideline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(() => {
    if (!barangayId) {
      setGuidelines([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    supabase
      .from('emergency_information')
      .select('*')
      .eq('barangay_id', barangayId)
      .eq('category', 'guidelines')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .then(({ data, error: qErr }) => {
        if (qErr) {
          setError(qErr.message);
        } else {
          setGuidelines((data ?? []) as EmergencyGuideline[]);
        }
        setIsLoading(false);
      });
  }, [barangayId]);

  useEffect(() => {
    let cancelled = false;

    doFetch();

    const channel = supabase
      .channel('emergency-guidelines')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_information',
          filter: `category=eq.guidelines`,
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

  return { guidelines, isLoading, error, refetch: doFetch };
}
