import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { uniqueChannelName } from '@/lib/realtime-channel';
import type { Tables } from '@barangayan/shared';

export type FaqArticle = Tables<'faq_articles'>;

export function useFaqArticles(barangayId: string | null): {
  articles: FaqArticle[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [articles, setArticles] = useState<FaqArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guests have no barangay: read unscoped and let RLS decide (anon policy from 0088,
  // incomplete-account browsing from 0103), as resident-web does.
  const doFetch = useCallback(() => {
    setIsLoading(true);
    setError(null);

    let query = supabase.from('faq_articles').select('*').eq('is_active', true).is('deleted_at', null);
    if (barangayId) query = query.eq('barangay_id', barangayId);
    query
      .order('sort_order', { ascending: true })
      .then(({ data, error: qErr }) => {
        if (qErr) {
          setError(qErr.message);
        } else {
          setArticles((data ?? []) as FaqArticle[]);
        }
        setIsLoading(false);
      });
  }, [barangayId]);

  useEffect(() => {
    let cancelled = false;

    doFetch();
    // Guest reads span barangays, so there is no single-barangay change feed to follow.
    if (!barangayId) return;

    const channel = supabase
      .channel(uniqueChannelName(`faq-articles:${barangayId}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'faq_articles',
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

  return { articles, isLoading, error, refetch: doFetch };
}
