'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export interface IncidentCategoryRow {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  is_trash_related: boolean;
}

/** Fetches all incident categories (C-005) — public read, no auth needed. */
export function useIncidentCategories(): {
  categories: IncidentCategoryRow[];
  isLoading: boolean;
} {
  const [categories, setCategories] = useState<IncidentCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from('incident_categories')
      .select('id, name, color, icon, is_trash_related')
      .order('name')
      .then(({ data }) => {
        setCategories((data ?? []) as IncidentCategoryRow[]);
        setIsLoading(false);
      });
  }, []);

  return { categories, isLoading };
}
