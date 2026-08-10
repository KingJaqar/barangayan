import { ANNOUNCEMENT_CATEGORY_META, type Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type EmergencyAnnouncement = Tables<'announcements'>;

/**
 * Shared hook for emergency announcements.
 *
 * Queries the public `announcements` table filtered to `category = 'emergency'`
 * and subscribes to Realtime changes so both the Emergency & DRRM Alerts tab
 * and the Reports > Emergency feed stay in sync without manual refresh.
 */
export function useEmergencyAnnouncements() {
  const [items, setItems] = useState<EmergencyAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEmergencies() {
      try {
        const { data, error: qErr } = await supabase
          .from('announcements')
          .select('*')
          .eq('category', 'emergency')
          .is('deleted_at', null)
          .order('published_at', { ascending: false });

        if (qErr) throw qErr;
        if (!cancelled) {
          setItems(data ?? []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load emergency announcements');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEmergencies();

    const channel = supabase
      .channel('emergency-announcements')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements',
          filter: `category=eq.emergency`,
        },
        () => {
          fetchEmergencies();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const refetch = () => {
    setLoading(true);
    setError(null);
    supabase
      .from('announcements')
      .select('*')
      .eq('category', 'emergency')
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .then(({ data, error: qErr }) => {
        if (qErr) {
          setError(qErr.message);
        } else {
          setItems(data ?? []);
          setError(null);
        }
        setLoading(false);
      });
  };

  return { items, loading, error, refetch };
}

export { ANNOUNCEMENT_CATEGORY_META };
