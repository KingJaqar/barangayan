import type { LatLng, MapMarker, Tables } from '@barangayan/shared';
import { haversineDistanceMeters, sortByDistanceFrom } from '@barangayan/shared';
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { getCachedData, setCachedData } from '@/lib/emergency-cache';

export type EvacuationCenterRow = Tables<'evacuation_centers'>;

/** EvacuationCenterRow with an optional distance (metres) from the user's location. */
export type EvacuationCenterWithDistance = EvacuationCenterRow & {
  distanceMeters?: number;
  /** Estimated walking time in minutes (assumes ~1.2 m/s walking pace). */
  estimatedMinutes?: number;
  /** Parsed from the `position` JSON column for convenience. */
  position: LatLng;
};

const CACHE_TAG = 'evacuation_centers';

/**
 * Fetches active evacuation centers for the barangay. No Realtime subscription —
 * admins update centers infrequently and a stale list for one session is acceptable.
 *
 * If `userPosition` is provided the returned `centers` array is sorted nearest-first
 * using the existing haversine utility from @barangayan/shared.
 */
export function useEvacuationCenters(options: {
  barangayId: string | null;
  userPosition?: LatLng | null;
}): {
  centers: EvacuationCenterWithDistance[];
  markers: MapMarker[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  isOffline: boolean;
} {
  const { barangayId, userPosition } = options;

  const [rawCenters, setRawCenters] = useState<EvacuationCenterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const doFetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setIsOffline(false);

    let query = supabase
      .from('evacuation_centers')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (barangayId) {
      query = query.eq('barangay_id', barangayId);
    }

    query.then(({ data, error: qErr }) => {
      if (qErr) {
        setError(qErr.message);
        setIsOffline(true);
      } else {
        const parsed = (data ?? []) as EvacuationCenterRow[];
        setRawCenters(parsed);
        setCachedData(CACHE_TAG, parsed);
        setIsOffline(false);
      }
      setIsLoading(false);
    });
  }, [barangayId]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const cached = await getCachedData<EvacuationCenterRow[]>(CACHE_TAG);
      if (cached && cached.length > 0 && !cancelled) {
        setRawCenters(cached);
        setIsLoading(false);
        setIsOffline(true);
      }

      doFetch();
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [doFetch, barangayId]);

  // Parse each center's `position` JSON column into a typed LatLng, filter out
  // any malformed rows, then optionally sort by distance from the user.
  const parsedCenters: EvacuationCenterWithDistance[] = rawCenters
    .filter((c) => {
      const pos = c.position as { lat?: unknown; lng?: unknown } | null;
      return (
        pos !== null &&
        typeof pos === 'object' &&
        typeof pos.lat === 'number' &&
        typeof pos.lng === 'number'
      );
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

  const centers: EvacuationCenterWithDistance[] = userPosition
    ? sortByDistanceFrom(userPosition, parsedCenters)
    : parsedCenters;

  const markers: MapMarker[] = centers.map((c) => ({
    id: c.id,
    position: c.position,
    kind: 'evacuation',
    label: c.name,
  }));

  return { centers, markers, isLoading, error, refetch: doFetch, isOffline };
}
