'use client';

import { useCallback, useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';
import type { Tables } from '@barangayan/shared';

export type FaqArticle = Tables<'faq_articles'>;

/**
 * Web port of apps/resident-android-mobile/src/hooks/use-faq-articles.ts — same
 * query shape, same realtime subscription, browser Supabase client instead of mobile's.
 */
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
      Promise.resolve().then(() => {
        setArticles([]);
        setIsLoading(false);
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
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
    Promise.resolve().then(() => doFetch());

    if (!barangayId) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(uniqueChannelName(`faq-articles:${barangayId}`))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'faq_articles', filter: `barangay_id=eq.${barangayId}` },
        doFetch,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doFetch, barangayId]);

  return { articles, isLoading, error, refetch: doFetch };
}
