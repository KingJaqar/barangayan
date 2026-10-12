'use client';

import type { LatLng, MapMarker, Tables } from '@barangayan/shared';
import { haversineDistanceMeters, sortByDistanceFrom } from '@barangayan/shared';

import { useScopedRead } from '@/hooks/use-scoped-read';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export type EvacuationCenterRow = Tables<'evacuation_centers'>;

/** EvacuationCenterRow with an optional distance (metres) from the user's location. */
export type EvacuationCenterWithDistance = EvacuationCenterRow & {
  distanceMeters?: number;
  /** Estimated walking time in minutes (assumes ~1.2 m/s walking pace) — a straight-line
   * estimate, refined per-center by the real OSRM route once selected (see
   * lib/osrm.ts's getWalkingRoute, used in centers-map.tsx). */
  estimatedMinutes?: number;
  /** Parsed from the `position` JSON column for convenience. */
  position: LatLng;
};

/**
 * Web port of use-evacuation-centers.ts [C-010]. No offline cache (non-goal for web) and
 * no Realtime subscription — admins update centers infrequently, matching mobile's own
 * reasoning for skipping Realtime here.
 */
export function useEvacuationCenters(options: { barangayId: string | null; userPosition?: LatLng | null }): {
  centers: EvacuationCenterWithDistance[];
  markers: MapMarker[];
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isReady: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { barangayId, userPosition } = options;

  // Read state is scoped by barangay with newest-request-wins (see use-scoped-read.ts);
  // `isLoading` keeps its meaning (any fetch in flight) while `isInitialLoading` /
  // `isRefreshing` / `isReady` let consumers tell a failed read from an empty one.
  const read = useScopedRead<EvacuationCenterRow[]>(barangayId ?? '*', () => {
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from('evacuation_centers')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });
    if (barangayId) query = query.eq('barangay_id', barangayId);
    return query.then(({ data, error }) => ({ data: (data ?? []) as EvacuationCenterRow[], error }));
  });
  const rawCenters = read.data ?? [];

  const parsedCenters: EvacuationCenterWithDistance[] = rawCenters
    .filter((c) => {
      const pos = c.position as { lat?: unknown; lng?: unknown } | null;
      return pos !== null && typeof pos === 'object' && typeof pos.lat === 'number' && typeof pos.lng === 'number';
    })
    .map((c) => {
      const pos = c.position as { lat: number; lng: number };
      const base = { ...c, position: { lat: pos.lat, lng: pos.lng } } as EvacuationCenterWithDistance;
      if (userPosition) {
        base.distanceMeters = haversineDistanceMeters(userPosition, base.position);
        base.estimatedMinutes = Math.max(1, Math.round(base.distanceMeters / 72));
      }
      return base;
    });

  const centers: EvacuationCenterWithDistance[] = userPosition ? sortByDistanceFrom(userPosition, parsedCenters) : parsedCenters;

  const markers: MapMarker[] = centers.map((c) => ({ id: c.id, position: c.position, kind: 'evacuation', label: c.name }));

  return {
    centers,
    markers,
    isLoading: read.isLoading,
    isInitialLoading: read.isInitialLoading,
    isRefreshing: read.isRefreshing,
    isReady: read.isReady,
    error: read.error,
    refetch: read.refetch,
  };
}
