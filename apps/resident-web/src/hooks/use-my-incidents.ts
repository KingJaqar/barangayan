'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';

export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'withdrawn';

export interface MyIncidentRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  photo_urls: string[];
  created_at: string;
  confirmation_count: number;
  resolved_read_at: string | null;
  address: string | null;
  specific_area_details: string | null;
  location: { lat: number; lng: number } | null;
  incident_categories: { id: string; name: string; color: string | null; icon: string | null } | null;
}

interface UseMyIncidentsOptions {
  /** When provided, only incidents matching this status (or any in the array) are fetched. */
  status?: IncidentStatus | IncidentStatus[];
}

/**
 * Fetches the signed-in resident's own incident reports (C-004) with an optional status
 * filter. Backs the My Reports page's All / Active / Resolved tabs. Realtime-subscribed so
 * the list updates when an admin changes a status or the resident withdraws.
 *
 * statusKey is a stable sorted string derived from the `status` prop so it can be used
 * as a primitive dependency without triggering the react-hooks/exhaustive-deps rule that
 * forbids JSON.stringify() in dependency arrays.
 */
export function useMyIncidents({ status }: UseMyIncidentsOptions = {}): {
  incidents: MyIncidentRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  // Convert to a stable sorted comma-separated key once, outside callbacks.
  const statusKey = status === undefined
    ? ''
    : Array.isArray(status)
      ? [...status].sort().join(',')
      : status;

  const [incidents, setIncidents] = useState<MyIncidentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const channelCleanupRef = useRef<(() => void) | null>(null);

  const doFetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelledRef.current || !user) {
        if (!cancelledRef.current) setIsLoading(false);
        return;
      }

      const statuses = statusKey ? statusKey.split(',') : [];

      let query = supabase
        .from('incidents')
        .select(
          'id, title, description, status, photo_urls, created_at, confirmation_count, resolved_read_at, address, specific_area_details, location, incident_categories(id, name, color, icon)',
        )
        .eq('reporter_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (statuses.length > 0) {
        query = query.in('status', statuses);
      }

      query.then(({ data, error: qErr }) => {
        if (cancelledRef.current) return;
        if (qErr) {
          setError(qErr.message);
        } else {
          setIncidents((data ?? []) as unknown as MyIncidentRow[]);
        }
        setIsLoading(false);
      });
    });
  }, [statusKey]);

  useEffect(() => {
    cancelledRef.current = false;
    // Microtask-wrapped to keep setState out of the synchronous effect body.
    Promise.resolve().then(() => doFetch());

    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelledRef.current || !user) return;

      const channel = supabase
        .channel(uniqueChannelName(`my-incidents:${user.id}:${statusKey}`))
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'incidents', filter: `reporter_id=eq.${user.id}` },
          () => { if (!cancelledRef.current) doFetch(); },
        )
        .subscribe();

      channelCleanupRef.current = () => supabase.removeChannel(channel);
    });

    return () => {
      cancelledRef.current = true;
      channelCleanupRef.current?.();
      channelCleanupRef.current = null;
    };
  }, [doFetch, statusKey]);

  return { incidents, isLoading, error, refetch: doFetch };
}
