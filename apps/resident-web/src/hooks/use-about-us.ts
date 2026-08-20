'use client';

import { useCallback, useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';
import type { Tables } from '@barangayan/shared';

export type AboutUs = Tables<'about_us'>;
export type DeveloperProfile = Tables<'developer_profiles'>;

/**
 * Web port of apps/resident-android-mobile/src/hooks/use-about-us.ts.
 * Fetches the barangay's About Us content and developer profiles.
 */
export function useAboutUs(barangayId: string | null): {
  about: AboutUs | null;
  developers: DeveloperProfile[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [about, setAbout] = useState<AboutUs | null>(null);
  const [developers, setDevelopers] = useState<DeveloperProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(() => {
    if (!barangayId) {
      Promise.resolve().then(() => {
        setAbout(null);
        setDevelopers([]);
        setIsLoading(false);
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    supabase
      .from('about_us')
      .select('*')
      .eq('barangay_id', barangayId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle()
      .then(async ({ data: aboutRow, error: aboutErr }) => {
        if (aboutErr) {
          setError(aboutErr.message);
          setIsLoading(false);
          return;
        }
        setAbout((aboutRow ?? null) as AboutUs | null);

        if (!aboutRow) {
          setDevelopers([]);
          setIsLoading(false);
          return;
        }

        const { data: devRows, error: devErr } = await supabase
          .from('developer_profiles')
          .select('*')
          .eq('about_us_id', aboutRow.id)
          .is('deleted_at', null)
          .order('sort_order', { ascending: true });

        if (devErr) {
          setError(devErr.message);
        } else {
          setDevelopers((devRows ?? []) as DeveloperProfile[]);
        }
        setIsLoading(false);
      });
  }, [barangayId]);

  useEffect(() => {
    Promise.resolve().then(() => doFetch());

    if (!barangayId) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(uniqueChannelName(`about-us:${barangayId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'about_us', filter: `barangay_id=eq.${barangayId}` }, doFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'developer_profiles' }, doFetch)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doFetch, barangayId]);

  return { about, developers, isLoading, error, refetch: doFetch };
}
