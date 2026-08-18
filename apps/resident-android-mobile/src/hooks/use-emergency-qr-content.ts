import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@barangayan/shared';
import { getCachedData, setCachedData } from '@/lib/emergency-cache';
import { uniqueChannelName } from '@/lib/realtime-channel';
import { EMERGENCY_SEED_QR_CONTENT } from '@/data/emergency-seed-data';

export type EmergencyQrContent = Tables<'emergency_qr_content'>;

const CACHE_TAG = 'emergency_qr_content';

export function useEmergencyQrContent(barangayId: string | null) {
  const [content, setContent] = useState<EmergencyQrContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const cancelledRef = useRef(false);
  const seedShownRef = useRef(false);
  const contentCountRef = useRef(0);

  const doFetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setIsOffline(false);

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
        setIsOffline(true);
      } else {
        const parsed = (data ?? []) as EmergencyQrContent[];
        setContent(parsed);
        contentCountRef.current = parsed.length;
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
      const cached = await getCachedData<EmergencyQrContent[]>(CACHE_TAG);
      if (cached && cached.length > 0 && !cancelledRef.current) {
        setContent(cached);
        contentCountRef.current = cached.length;
        setIsLoading(false);
        setIsOffline(true);
      }

      doFetch();

      if (!cached || cached.length === 0) {
        const timer = setTimeout(() => {
          if (!cancelledRef.current && !seedShownRef.current && contentCountRef.current === 0) {
            seedShownRef.current = true;
            setContent(EMERGENCY_SEED_QR_CONTENT as unknown as EmergencyQrContent[]);
            setIsOffline(true);
            setIsLoading(false);
          }
        }, 6000);

        return () => clearTimeout(timer);
      }
    }

    init();

    const channel = supabase
      .channel(uniqueChannelName(`mobile-emergency-qr-content:${barangayId ?? 'all'}`))
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

  return { content, isLoading, error, refetch: doFetch, isOffline };
}
