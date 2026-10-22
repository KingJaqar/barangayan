import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type WasteZoneOption = { id: string; name: string };

/**
 * Fetches active waste-collection zones for the incident report form's zone
 * picker. The form displays them for trash-related categories only.
 */
export function useWasteZones(barangayId: string | null): { zones: WasteZoneOption[]; isLoading: boolean; error: string | null; retry: () => void } {
  const [zones, setZones] = useState<WasteZoneOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!barangayId) {
      setZones([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    supabase
      .from('waste_zones')
      .select('id, name')
      .eq('barangay_id', barangayId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) setError('Collection zones could not be loaded. Please try again.');
        else setZones(data ?? []);
        setIsLoading(false);
      }, () => {
        if (cancelled) return;
        setError('Collection zones could not be loaded. Please try again.');
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [barangayId, attempt]);

  return { zones, isLoading, error, retry: () => setAttempt(value => value + 1) };
}
