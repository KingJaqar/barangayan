import type { Tables } from '@barangayan/shared';
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type IncidentCategoryRow = Tables<'incident_categories'>;

/**
 * Fetches the barangay's configurable incident categories — these drive the
 * Maps screen's filter pills. One-shot fetch (categories rarely change mid-session).
 *
 * Returns null for `categories` while loading so callers can render skeleton pills.
 */
export function useIncidentCategories(barangayId: string | null): {
  categories: IncidentCategoryRow[];
  isLoading: boolean;
} {
  const [categories, setCategories] = useState<IncidentCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(() => {
    if (!barangayId) {
      setCategories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    supabase
      .from('incident_categories')
      .select('*')
      .eq('barangay_id', barangayId)
      .order('name', { ascending: true })
      .then(({ data }) => {
        setCategories(data ?? []);
        setIsLoading(false);
      });
  }, [barangayId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { categories, isLoading };
}
