import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@barangayan/shared';
import { getCachedData, setCachedData } from '@/lib/emergency-cache';
import { uniqueChannelName } from '@/lib/realtime-channel';
import { EMERGENCY_SEED_GUIDELINES } from '@/data/emergency-seed-data';

export type EmergencyGuideline = Tables<'emergency_information'>;

const CACHE_TAG = 'emergency_guidelines';

export function useEmergencyGuidelines(barangayId: string | null): {
  guidelines: EmergencyGuideline[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  isOffline: boolean;
} {
  const [guidelines, setGuidelines] = useState<EmergencyGuideline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const cancelledRef = useRef(false);
  const seedShownRef = useRef(false);
  const guidelinesCountRef = useRef(0);

  const doFetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setIsOffline(false);

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
        setIsOffline(true);
      } else {
        const parsed = (data ?? []) as EmergencyGuideline[];
        setGuidelines(parsed);
        guidelinesCountRef.current = parsed.length;
        setCachedData(CACHE_TAG, parsed);
        setIsOffline(false);
      }
      setIsLoading(false);
    });
  }, [barangayId]);

  useEffect(() => {
    cancelledRef.current = false;
    seedShownRef.current = false;

    async function init() {
      const cached = await getCachedData<EmergencyGuideline[]>(CACHE_TAG);
      if (cached && cached.length > 0 && !cancelledRef.current) {
        setGuidelines(cached);
        guidelinesCountRef.current = cached.length;
        setIsLoading(false);
        setIsOffline(true);
      }

      doFetch();

      if (!cached || cached.length === 0) {
        const timer = setTimeout(() => {
          if (!cancelledRef.current && !seedShownRef.current && guidelinesCountRef.current === 0) {
            seedShownRef.current = true;
            setGuidelines(EMERGENCY_SEED_GUIDELINES as unknown as EmergencyGuideline[]);
            setIsOffline(true);
            setIsLoading(false);
          }
        }, 6000);

        return () => clearTimeout(timer);
      }
    }

    init();

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

  return { guidelines, isLoading, error, refetch: doFetch, isOffline };
}

export { EMERGENCY_SEED_GUIDELINES };
