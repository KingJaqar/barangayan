'use client';

import { useCallback, useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';
import type { Tables } from '@barangayan/shared';

export type SiteContentItem = Tables<'site_content'>;

/**
 * Web port of apps/resident-android-mobile/src/hooks/use-site-content.ts.
 * Fetches Terms of Service and Privacy Policy for the resident's barangay.
 */
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

    const supabase = createSupabaseBrowserClient();
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
    Promise.resolve().then(() => doFetch());

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(uniqueChannelName(`site-content:${barangayId ?? 'global'}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_content',
          filter: barangayId ? `barangay_id=eq.${barangayId}` : undefined,
        },
        doFetch,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doFetch, barangayId]);

  return { items, isLoading, error, refetch: doFetch };
}
