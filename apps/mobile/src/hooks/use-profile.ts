import type { Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

type Profile = Tables<'profiles'> & { barangays: Pick<Tables<'barangays'>, 'name'> | null };

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

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    supabase
      .from('profiles')
      .select('*, barangays(name)')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setProfile(data as Profile | null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  return { profile, isLoading };
}
