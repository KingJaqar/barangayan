import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@barangayan/shared';
import { getCachedData, setCachedData } from '@/lib/emergency-cache';
import { uniqueChannelName } from '@/lib/realtime-channel';
import { EMERGENCY_SEED_HOTLINES } from '@/data/emergency-seed-data';

export type EmergencyHotline = Tables<'emergency_information'>;

const CACHE_TAG = 'emergency_hotlines';

export function useEmergencyHotlines(barangayId: string | null): {
  hotlines: EmergencyHotline[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  isOffline: boolean;
} {
  const [hotlines, setHotlines] = useState<EmergencyHotline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const cancelledRef = useRef(false);
  const seedShownRef = useRef(false);
  const hotlinesCountRef = useRef(0);

  const doFetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setIsOffline(false);

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
        setIsOffline(true);
      } else {
        const parsed = (data ?? []) as EmergencyHotline[];
        setHotlines(parsed);
        hotlinesCountRef.current = parsed.length;
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
      const cached = await getCachedData<EmergencyHotline[]>(CACHE_TAG);
      if (cached && cached.length > 0 && !cancelledRef.current) {
        setHotlines(cached);
        hotlinesCountRef.current = cached.length;
        setIsLoading(false);
        setIsOffline(true);
      }

      doFetch();

      if (!cached || cached.length === 0) {
        const timer = setTimeout(() => {
          if (!cancelledRef.current && !seedShownRef.current && hotlinesCountRef.current === 0) {
            seedShownRef.current = true;
            setHotlines(EMERGENCY_SEED_HOTLINES as unknown as EmergencyHotline[]);
            setIsOffline(true);
            setIsLoading(false);
          }
        }, 6000);

        return () => clearTimeout(timer);
      }
    }

    init();

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

  return { hotlines, isLoading, error, refetch: doFetch, isOffline };
}

export { EMERGENCY_SEED_HOTLINES };
