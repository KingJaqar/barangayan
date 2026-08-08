import type { MapMarker, Tables } from '@barangayan/shared';
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type IncidentRow = Tables<'incidents'>;

/**
 * Fetches community-reported incidents for the resident's barangay and maps them to
 * MapMarker[] for direct consumption by the Leaflet WebView bridge.
 *
 * Subscribes to Realtime so newly submitted incidents appear on the map without a
 * manual refresh — mirrors the pattern used by use-announcements.ts.
 *
 * Filtering is server-side (categoryIds and searchQuery are sent as PostgREST params)
 * so the payload stays small even when a barangay has many incidents.
 */
export function useIncidents(options: {
  barangayId: string | null;
  /** IDs of the active filter pills — empty array means "show all". */
  categoryIds?: string[];
  /** Free-text search applied to incident title (case-insensitive prefix match). */
  searchQuery?: string;
  status?: 'open' | 'in_progress' | 'resolved';
}): {
  incidents: IncidentRow[];
  markers: MapMarker[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { barangayId, categoryIds, searchQuery, status } = options;

  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = useCallback(() => {
    let q = supabase
      .from('incidents')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (barangayId) q = q.eq('barangay_id', barangayId);
    if (status) q = q.eq('status', status);
    if (categoryIds && categoryIds.length > 0) q = q.in('category_id', categoryIds);
    if (searchQuery && searchQuery.trim().length > 0) {
      q = q.ilike('title', `%${searchQuery.trim()}%`);
    }

    return q;
  }, [barangayId, categoryIds, searchQuery, status]);

  const refetch = useCallback(() => {
    if (!barangayId) {
      setIncidents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
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
  }, [barangayId, buildQuery]);

  useEffect(() => {
    let cancelled = false;

    if (!barangayId) {
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

    // Live updates: re-fetch whenever any incident in this barangay changes.
    // The client-side query already applies filters, so re-fetching is safe.
    const channel = supabase
      .channel(`incidents:${barangayId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents', filter: `barangay_id=eq.${barangayId}` },
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
  }, [barangayId, buildQuery]);

  // Derive MapMarker[] from incident rows so the MapView component needs no
  // knowledge of the incidents table shape.
  const markers: MapMarker[] = incidents
    .filter((inc) => {
      // Guard: location must be a valid { lat, lng } object before we put it on the map.
      const loc = inc.location as { lat?: unknown; lng?: unknown } | null;
      return (
        loc !== null &&
        typeof loc === 'object' &&
        typeof loc.lat === 'number' &&
        typeof loc.lng === 'number'
      );
    })
    .map((inc) => {
      const loc = inc.location as { lat: number; lng: number };
      return {
        id: inc.id,
        position: { lat: loc.lat, lng: loc.lng },
        // kind = category_id so the map can colour-code by category; falls back to 'incident'
        kind: inc.category_id ?? 'incident',
        label: inc.title,
      };
    });

  return { incidents, markers, isLoading, error, refetch };
}
