import type { Tables } from '@barangayan/shared';
import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

export type Profile = Tables<'profiles'> & {
  barangays: Pick<Tables<'barangays'>, 'name' | 'boundary'> | null;
};

// ─── Context ─────────────────────────────────────────────────────────────────

interface ProfileContextValue {
  profile: Profile | null;
  isLoading: boolean;
  refetch: () => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  isLoading: true,
  refetch: () => {},
});

/**
 * Provides the logged-in resident's profile to the entire subtree. Mount this
 * once near the root (inside AuthProvider) so every screen shares one fetch and
 * one cached value — uploading a new avatar in ProfileScreen immediately reflects
 * in Home, Settings, Health registration, etc. without each screen refetching
 * independently.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
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
    supabase
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

  return createElement(ProfileContext.Provider, { value: { profile, isLoading, refetch } }, children);
}

/**
 * The logged-in resident's own profile row (RLS: auth.uid() = id), joined with their
 * barangay's name for display. Backed by a shared ProfileProvider context so that any
 * call to refetch() (e.g. after uploading a new avatar) propagates to every screen that
 * calls useProfile() — no per-screen independent fetches.
 */
export function useProfile() {
  return useContext(ProfileContext);
}
