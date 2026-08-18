import { ANNOUNCEMENT_CATEGORY_META, type Tables } from '@barangayan/shared';
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { getCachedData, setCachedData } from '@/lib/emergency-cache';
import { uniqueChannelName } from '@/lib/realtime-channel';

export type EmergencyAnnouncement = Tables<'announcements'>;

const CACHE_TAG = 'emergency_announcements';

export function useEmergencyAnnouncements() {
  const [items, setItems] = useState<EmergencyAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const cancelledRef = useRef(false);

  async function fetchEmergencies() {
    try {
      const { data, error: qErr } = await supabase
        .from('announcements')
        .select('*')
        .eq('category', 'emergency')
        .is('deleted_at', null)
        .order('published_at', { ascending: false });

      if (qErr) throw qErr;
      if (!cancelledRef.current) {
        setItems(data ?? []);
        setError(null);
        setIsOffline(false);
        await setCachedData(CACHE_TAG, (data ?? []) as EmergencyAnnouncement[]);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load emergency announcements');
        setIsOffline(true);
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    cancelledRef.current = false;

    async function init() {
      const cached = await getCachedData<EmergencyAnnouncement[]>(CACHE_TAG);
      if (cached && cached.length > 0 && !cancelledRef.current) {
        setItems(cached);
        setLoading(false);
        setIsOffline(true);
      }

      fetchEmergencies();
    }

    init();

    const channel = supabase
      .channel(uniqueChannelName('emergency-announcements'))
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
      cancelledRef.current = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const refetch = () => {
    setLoading(true);
    setError(null);
    setIsOffline(false);
    supabase
      .from('announcements')
      .select('*')
      .eq('category', 'emergency')
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .then(({ data, error: qErr }) => {
        if (qErr) {
          setError(qErr.message);
          setIsOffline(true);
        } else {
          setItems(data ?? []);
          setError(null);
          setIsOffline(false);
          setCachedData(CACHE_TAG, (data ?? []) as EmergencyAnnouncement[]);
        }
        setLoading(false);
      });
  };

  return { items, loading, error, refetch, isOffline };
}

export { ANNOUNCEMENT_CATEGORY_META };
