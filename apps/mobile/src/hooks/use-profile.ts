import type { Tables } from '@barangayan/shared';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

export type Profile = Tables<'profiles'> & {
  barangays: Pick<Tables<'barangays'>, 'name' | 'boundary'> | null;
};

/**
 * The logged-in resident's own profile row (RLS: auth.uid() = id), joined with their
 * barangay's name for display. App-local for now — becomes a candidate for
 * packages/shared once apps/web's resident portal needs the same query (AGENTS.md §1),
 * not before (no second real call site yet to inform the right shared shape).
 */
export function useProfile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!session) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    return supabase
      .from('profiles')
      .select('*, barangays(name, boundary)')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setProfile(data as Profile | null);
        setIsLoading(false);
      });
  }, [session]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { profile, isLoading, refetch };
}
