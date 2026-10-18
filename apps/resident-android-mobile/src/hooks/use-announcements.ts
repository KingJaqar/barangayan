import { ANNOUNCEMENT_CATEGORIES, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

import { supabase } from '@/lib/supabase';
import { uniqueChannelName } from '@/lib/realtime-channel';

type Announcement = Tables<'announcements'>;

export type { AnnouncementCategory };
export { ANNOUNCEMENT_CATEGORIES };

/**
 * Fetches announcements from the public feed (anon RLS policy applies, so this works for
 * both guests and authenticated residents). Subscribes to Realtime for live updates — the
 * announcements table has Realtime enabled from migration 0003.
 */
export function useAnnouncements(category: AnnouncementCategory | 'all') {
  const { session } = useAuth();
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([category, session?.user.id, retry]);
  const [settled, setSettled] = useState<{ key: string; items: Announcement[]; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    let sequence = 0;

    function buildQuery() {
      let q = supabase
        .from('announcements')
        .select('*')
        .is('deleted_at', null)
        .order('published_at', { ascending: false });
      if (category !== 'all') q = q.eq('category', category);
      return q;
    }

    async function load() {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      const ticket = ++sequence;
      const timeout = setTimeout(() => requestController.abort(), 12000);
      try {
        const { data, error } = await buildQuery().abortSignal(requestController.signal);
        if (error) throw error;
        if (!cancelled && ticket === sequence) setSettled({ key, items: data ?? [], error: null });
      } catch {
        if (!cancelled && ticket === sequence) setSettled({ key, items: [], error: 'Announcements could not be loaded. Please try again.' });
      } finally { clearTimeout(timeout); }
    }
    void load();

    const channel = supabase
      .channel(uniqueChannelName(`announcements:${category}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        void load();
      })
      .subscribe();

    return () => {
      cancelled = true;
      controller?.abort();
      supabase.removeChannel(channel);
    };
  }, [category, key]);

  const result = settled?.key === key ? settled : null;
  return { items: result?.items ?? [], loading: !result, error: result?.error ?? null, retry: () => setRetry(value => value + 1) };
}
