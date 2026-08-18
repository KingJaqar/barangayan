import type { Tables } from '@barangayan/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { IncidentStatus } from '@/constants/incident-status';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

export type MyIncidentRow = Tables<'incidents'> & {
  incident_categories: {
    name: string;
    icon: string | null;
    color: string;
  } | null;
};

/**
 * Fetches the signed-in resident's own submitted incident reports.
 *
 * Mirrors the pattern of use-incidents.ts but scoped to reporter_id = current user
 * so the Reports tab's "Incident Reports / Active / Resolved" sub-tabs only show
 * the resident's personal submissions — not the whole community feed (which the
 * Maps screen already handles).
 *
 * Subscribes to Realtime so admin status updates (open → in_progress → resolved)
 * appear in real time without a manual pull-to-refresh.
 */
export function useMyIncidents(options: {
  /** If provided, only rows whose `status` matches are returned. An array matches any of
   * the given statuses (e.g. the "Active" segment = open OR in_progress). */
  status?: IncidentStatus | IncidentStatus[];
} = {}): {
  incidents: MyIncidentRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { status } = options;

  const [incidents, setIncidents] = useState<MyIncidentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Unique per hook instance — same reason documents-list.tsx does this. removeChannel()
  // is async, so on any remount (switching Reports sub-tabs, or the router.replace back
  // from reports/new after a submit) the next effect calls supabase.channel() before the
  // old channel has actually been torn down. With a fixed topic that returns the SAME,
  // already-subscribed channel, and .on() then throws "cannot add postgres_changes
  // callbacks ... after subscribe()".
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));

  const buildQuery = useCallback(() => {
    let q = supabase
      .from('incidents')
      .select('*, incident_categories(name, icon, color)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (userId) q = q.eq('reporter_id', userId);
    if (Array.isArray(status)) {
      if (status.length > 0) q = q.in('status', status);
    } else if (status) {
      q = q.eq('status', status);
    }

    return q;
  }, [userId, status]);

  /**
   * @param showSkeleton `false` refreshes the rows in place — used for background
   *   refreshes where flashing the skeleton over an already-populated list would be worse
   *   than briefly showing stale data.
   */
  const fetchIncidents = useCallback(
    (showSkeleton: boolean) => {
      if (!userId) {
        setIncidents([]);
        setIsLoading(false);
        return;
      }

      if (showSkeleton) setIsLoading(true);
      setError(null);

      buildQuery().then(({ data, error: qErr }) => {
        if (qErr) {
          setError(qErr.message);
          setIsLoading(false);
          return;
        }
        setIncidents(data ?? []);
        setIsLoading(false);
      });
    },
    [userId, buildQuery],
  );

  const refetch = useCallback(() => fetchIncidents(true), [fetchIncidents]);

  // Refetch whenever the Reports screen regains focus.
  //
  // The Realtime subscription below is the primary path, but it only works if the table
  // is in the supabase_realtime publication (added in 0027) — and a resident who filed
  // or withdrew a report is coming back from a pushed screen to a list that never
  // unmounted, so without this the stale card stays on screen. Cheap, and correct even
  // when Realtime is unavailable (offline, publication misconfigured, socket dropped).
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        // The mount effect below already runs the initial fetch.
        isFirstFocus.current = false;
        return;
      }
      fetchIncidents(false);
    }, [fetchIncidents]),
  );

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setIncidents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    buildQuery().then(({ data, error: qErr }) => {
      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
      } else {
        setIncidents(data ?? []);
      }
      setIsLoading(false);
    });

    // Live: re-fetch when any of the user's incidents change (admin updates status).
    const channel = supabase
      .channel(`my-incidents:${userId}:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
          filter: `reporter_id=eq.${userId}`,
        },
        () => {
          buildQuery().then(({ data }) => {
            if (!cancelled) setIncidents(data ?? []);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, buildQuery, instanceId]);

  return { incidents, isLoading, error, refetch };
}
