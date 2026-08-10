import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
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

  const doFetch = useCallback(() => {
    if (!barangayId) {
      setArticles([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    supabase
      .from('faq_articles')
      .select('*')
      .eq('barangay_id', barangayId)
      .eq('is_active', true)
      .is('deleted_at', null)
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

    const channel = supabase
      .channel('faq-articles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'faq_articles',
          filter: `barangay_id=eq.${barangayId ?? ''}`,
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
