'use client';

import { useEffect } from 'react';
import { useScopedRead } from '@/hooks/use-scoped-read';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';
import type { Tables } from '@barangayan/shared';

export type FaqArticle = Tables<'faq_articles'>;

/**
 * Web port of apps/resident-android-mobile/src/hooks/use-faq-articles.ts — same
 * query shape, same realtime subscription, browser Supabase client instead of mobile's.
 *
 * `barangayId` is null for guests — faq_articles has an anon read policy with no
 * barangay filter (see the migration granting guest read access on faq_articles), same
 * convention as use-emergency-guidelines.ts: the query goes unscoped instead of
 * skipping entirely.
 */
export function useFaqArticles(barangayId: string | null): {
  articles: FaqArticle[];
  isLoading: boolean;
  error: string | null;
  errorAnnounced: boolean;
  refetch: (contentName?: string) => void;
} {
  const read = useScopedRead<FaqArticle[]>(barangayId ?? '*', () => {
    const supabase = createSupabaseBrowserClient();
    let query = supabase.from('faq_articles').select('*').eq('is_active', true).is('deleted_at', null);
    if (barangayId) query = query.eq('barangay_id', barangayId);

    return query
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => ({ data: (data ?? []) as FaqArticle[], error }));
  });
  const { refetch } = read;

  useEffect(() => {
    if (!barangayId) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(uniqueChannelName(`faq-articles:${barangayId}`))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'faq_articles', filter: `barangay_id=eq.${barangayId}` },
        () => refetch(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, barangayId]);

  return { articles: read.data ?? [], isLoading: read.isLoading, error: read.error, errorAnnounced: read.errorAnnounced, refetch };
}
