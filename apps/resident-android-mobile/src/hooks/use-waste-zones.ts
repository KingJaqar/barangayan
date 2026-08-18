import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type WasteZoneOption = { id: string; name: string };

/**
 * Fetches active waste-collection zones for the incident report form's zone
 * picker (ticket 15 — links trash-related reports to a zone_id so they can
 * finally be grouped/scored by zone). Only fetched when a trash-related
 * category is selected — see reports/new.tsx.
 */
export function useWasteZones(barangayId: string | null): { zones: WasteZoneOption[]; isLoading: boolean } {
  const [zones, setZones] = useState<WasteZoneOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!barangayId) {
      setZones([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    supabase
      .from('waste_zones')
      .select('id, name')
      .eq('barangay_id', barangayId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setZones(data ?? []);
        setIsLoading(false);
      });
  }, [barangayId]);

  return { zones, isLoading };
}
