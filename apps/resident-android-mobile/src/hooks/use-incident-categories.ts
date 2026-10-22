import type { Tables } from '@barangayan/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type IncidentCategoryRow = Tables<'incident_categories'>;

/**
 * Fetches the barangay's configurable incident categories — these drive the
 * Maps screen's filter pills. One-shot fetch (categories rarely change mid-session).
 *
 * Exposes loading/error/retry without changing category selection or query scope.
 */
export function useIncidentCategories(barangayId: string | null): {
  categories: IncidentCategoryRow[];
  isLoading: boolean;
  error: string | null;
  retry: () => void;
} {
  const [categories, setCategories] = useState<IncidentCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const lifecycle = useRef({ active: false });

  const fetch = useCallback(() => {
    const ticket = ++request.current;
    const owner = lifecycle.current;
    if (!barangayId) {
      setCategories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    supabase
      .from('incident_categories')
      .select('*')
      .eq('barangay_id', barangayId)
      .order('name', { ascending: true })
      .then(({ data, error: queryError }) => {
        if (!owner.active || ticket !== request.current) return;
        if (queryError) setError('Incident categories could not be loaded. Please try again.');
        else setCategories(data ?? []);
        setIsLoading(false);
      }, () => {
        if (!owner.active || ticket !== request.current) return;
        setError('Incident categories could not be loaded. Please try again.');
        setIsLoading(false);
      });
  }, [barangayId]);

  useEffect(() => {
    const owner = { active: true };
    lifecycle.current = owner;
    fetch();
    return () => { owner.active = false; };
  }, [fetch]);

  return { categories, isLoading, error, retry: fetch };
}
