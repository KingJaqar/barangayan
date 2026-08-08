import type { LatLng, MapMarker, Tables } from '@barangayan/shared';
import { sortByDistanceFrom } from '@barangayan/shared';
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type EvacuationCenterRow = Tables<'evacuation_centers'>;

/** EvacuationCenterRow with an optional distance (metres) from the user's location. */
export type EvacuationCenterWithDistance = EvacuationCenterRow & {
  distanceMeters?: number;
  /** Parsed from the `position` JSON column for convenience. */
  position: LatLng;
};

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
} {
  const { barangayId, userPosition } = options;

  const [rawCenters, setRawCenters] = useState<EvacuationCenterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(() => {
    if (!barangayId) {
      setRawCenters([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    supabase
      .from('evacuation_centers')
      .select('*')
      .eq('barangay_id', barangayId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .then(({ data, error: qErr }) => {
        if (qErr) {
          setError(qErr.message);
        } else {
          setRawCenters(data ?? []);
        }
        setIsLoading(false);
      });
  }, [barangayId]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

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
      return { ...c, position: { lat: pos.lat, lng: pos.lng } };
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

  return { centers, markers, isLoading, error, refetch: doFetch };
}
