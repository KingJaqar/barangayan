import { AccountRequestScope, type Tables } from '@barangayan/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

export type Profile = Tables<'profiles'> & {
  barangays: (Pick<Tables<'barangays'>, 'name' | 'boundary'> & {
    barangay_localities: Pick<Tables<'barangay_localities'>, 'display_name' | 'city' | 'province'> | null;
  }) | null;
};
const cacheKey = (id: string) => `resident_profile_v2:${id}`;
export async function clearProfileCache(userId?: string) {
  await AsyncStorage.removeItem('emergency_cache_resident_profile');
  if (userId) await AsyncStorage.removeItem(cacheKey(userId));
}
interface ProfileContextValue { profile: Profile | null; isLoading: boolean; error: string | null; refetch: () => void; }
const ProfileContext = createContext<ProfileContextValue>({ profile: null, isLoading: true, error: null, refetch: () => {} });

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const scope = useRef(new AccountRequestScope());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refetch = useCallback(() => {
    if (!userId) return;
    const ticket = scope.current.begin(userId);
    setIsLoading(true);
    setError(null);
    supabase.from('profiles').select('*, barangays(name, boundary, barangay_localities(display_name, city, province))')
      .eq('id', userId).maybeSingle().then(async ({ data, error: queryError }) => {
        if (!scope.current.accepts(ticket, userId)) return;
        if (queryError) {
          setError('Could not refresh your profile. Reconnect and try again.');
          setProfile(previous => previous?.id === userId ? { ...previous, id_verification_status: null, approved_id_submission_id: null } : null);
          // Offline demographic data is useful; cached approval is never trusted.
          try {
            const raw = await AsyncStorage.getItem(cacheKey(userId));
            const cached = raw ? JSON.parse(raw) as Profile : null;
            if (cached && scope.current.accepts(ticket, cached.id)) setProfile({ ...cached, id_verification_status: null, approved_id_submission_id: null });
          } catch { /* Offline cache is optional. */ }
        } else if (!data) {
          setProfile(null);
          await clearProfileCache(userId).catch(() => {});
        } else if (scope.current.accepts(ticket, data.id)) {
          const value = data as unknown as Profile;
          setProfile(value);
          await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(value)).catch(() => {});
          if (!scope.current.accepts(ticket, userId)) await AsyncStorage.removeItem(cacheKey(userId)).catch(() => {});
        }
        if (scope.current.accepts(ticket, userId)) setIsLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    let active = true;
    const requestScope = scope.current;
    requestScope.setOwner(userId);
    clearProfileCache().catch(() => {});
    if (!userId) { requestScope.clear(); return; }
    Promise.resolve().then(() => { if (active) refetch(); });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') refetch(); });
    const channel = supabase.channel(`profile:${userId}`).on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}`,
    }, refetch).subscribe();
    return () => {
      active = false;
      requestScope.clear();
      foreground.remove();
      supabase.removeChannel(channel);
      clearProfileCache(userId).catch(() => {});
    };
  }, [userId, refetch]);
  const visible = userId && profile?.id === userId ? profile : null;
  return createElement(ProfileContext.Provider, { value: { profile: visible, isLoading: !!userId && isLoading, error: userId ? error : null, refetch } }, children);
}
export function useProfile() { return useContext(ProfileContext); }
