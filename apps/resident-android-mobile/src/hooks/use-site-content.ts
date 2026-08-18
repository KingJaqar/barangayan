import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { uniqueChannelName } from '@/lib/realtime-channel';
import type { Tables } from '@barangayan/shared';

export type SiteContentItem = Tables<'site_content'>;

export function useSiteContent(barangayId: string | null): {
  items: SiteContentItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [items, setItems] = useState<SiteContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(() => {
    setIsLoading(true);
    setError(null);

    let q = supabase
      .from('site_content')
      .select('*')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (barangayId) q = q.eq('barangay_id', barangayId);

    q.then(({ data, error: qErr }) => {
      if (qErr) {
        setError(qErr.message);
      } else {
        setItems((data ?? []) as SiteContentItem[]);
      }
      setIsLoading(false);
    });
  }, [barangayId]);

  useEffect(() => {
    let cancelled = false;

    doFetch();

    const channelName = uniqueChannelName(`site-content:${barangayId ?? 'global'}`);
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_content',
          filter: barangayId ? `barangay_id=eq.${barangayId}` : undefined,
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

  return { items, isLoading, error, refetch: doFetch };
}
