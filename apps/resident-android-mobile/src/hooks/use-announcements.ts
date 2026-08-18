import { ANNOUNCEMENT_CATEGORIES, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';

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
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function buildQuery() {
      let q = supabase
        .from('announcements')
        .select('*')
        .is('deleted_at', null)
        .order('published_at', { ascending: false });
      if (category !== 'all') q = q.eq('category', category);
      return q;
    }

    buildQuery().then(({ data }) => {
      if (!cancelled) {
        setItems(data ?? []);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel(uniqueChannelName(`announcements:${category}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        buildQuery().then(({ data }) => {
          if (!cancelled) setItems(data ?? []);
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [category]);

  return { items, loading };
}
