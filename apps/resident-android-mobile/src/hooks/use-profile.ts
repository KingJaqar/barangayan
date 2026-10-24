import { type Tables } from '@barangayan/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/use-auth';
import { useRefreshResource } from '@/hooks/use-refresh-resource';
import { safeReadRetryDelay } from '@/lib/setup-refresh';
import { supabase } from '@/lib/supabase';

export type Profile = Tables<'profiles'> & {
  barangays: (Pick<Tables<'barangays'>, 'name' | 'boundary'> & {
    barangay_localities: Pick<Tables<'barangay_localities'>, 'display_name' | 'city' | 'province'> | null;
  }) | null;
};
const cacheKey = (id: string) => `resident_profile_v2:${id}`;
const refreshError = 'Could not refresh your profile. Reconnect and try again.';
export async function clearProfileCache(userId?: string) {
  await AsyncStorage.removeItem('emergency_cache_resident_profile');
  if (userId) await AsyncStorage.removeItem(cacheKey(userId));
}

interface ProfileRead { profile: Profile | null; serialized: string; error: string | null; }
interface ProfileData { profile: Profile | null; refetch: () => void; }
interface ProfileStatus { isLoading: boolean; isInitialLoading: boolean; isRefreshing: boolean; error: string | null; }
const ProfileDataContext = createContext<ProfileData>({ profile: null, refetch: () => {} });
const ProfileStatusContext = createContext<ProfileStatus>({ isLoading: true, isInitialLoading: true, isRefreshing: false, error: null });

function unverified(profile: Profile): Profile {
  return { ...profile, id_verification_status: null, approved_id_submission_id: null };
}
function retainProfile(previous: ProfileRead | undefined, next: ProfileRead): ProfileRead {
  if (next.error && previous?.profile) {
    const profile = unverified(previous.profile);
    next = { ...next, profile, serialized: JSON.stringify(profile) };
  }
  if (previous?.serialized === next.serialized && previous.error === next.error) return previous;
  if (previous?.profile && next.profile &&
    JSON.stringify(previous.profile.barangays) === JSON.stringify(next.profile.barangays)) {
    return { ...next, profile: { ...next.profile, barangays: previous.profile.barangays } };
  }
  return next;
}
function retryWait(delay: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new Error(refreshError)); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, delay);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  // Serialize writes/removals so a late cache write cannot resurrect a signed-out account.
  const cacheWork = useRef(Promise.resolve());
  const queueCache = useCallback((work: () => Promise<void>) => {
    cacheWork.current = cacheWork.current.then(work).catch(() => {});
  }, []);
  const load = useCallback(async (signal: AbortSignal): Promise<ProfileRead> => {
    if (!userId) return { profile: null, serialized: 'null', error: null };
    for (let attempt = 0; ; attempt++) {
      const { data, error } = await supabase.from('profiles')
        .select('*, barangays(name, boundary, barangay_localities(display_name, city, province))')
        .eq('id', userId).abortSignal(signal).maybeSingle();
      if (signal.aborted) throw new Error(refreshError);
      if (!error) {
        if (data && data.id !== userId) throw new Error(refreshError);
        const profile = data as Profile | null;
        return { profile, serialized: JSON.stringify(profile), error: null };
      }
      const delay = safeReadRetryDelay(attempt);
      if (delay !== null) { await retryWait(delay, signal); continue; }
      let profile: Profile | null = null;
      try {
        const raw = await AsyncStorage.getItem(cacheKey(userId));
        const cached = raw ? JSON.parse(raw) as Profile : null;
        if (cached?.id === userId) profile = unverified(cached);
      } catch { /* Offline demographic cache is optional and never grants approval. */ }
      return { profile, serialized: JSON.stringify(profile), error: refreshError };
    }
  }, [userId]);
  const { data, fetching, loading, refreshing, error, refresh, invalidate } = useRefreshResource(userId ?? 'guest', load, refreshError, retainProfile);
  const refetch = useCallback(() => { if (userId) void invalidate(); }, [userId, invalidate]);

  useEffect(() => {
    queueCache(() => clearProfileCache());
    if (!userId) return;
    void refresh();
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void invalidate(); });
    let subscribed = false;
    const channel = supabase.channel(`profile:${userId}`).on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}`,
    }, refetch).subscribe(status => {
      if (status !== 'SUBSCRIBED') return;
      // Initial subscription joins the mount read; reconnection catches missed changes.
      if (subscribed) void invalidate(); else void refresh();
      subscribed = true;
    });
    return () => {
      foreground.remove();
      void supabase.removeChannel(channel);
      queueCache(() => clearProfileCache(userId));
    };
  }, [userId, refresh, invalidate, refetch, queueCache]);
  useEffect(() => {
    if (!userId || !data || data.error) return;
    queueCache(() => data.profile ? AsyncStorage.setItem(cacheKey(userId), data.serialized) : clearProfileCache(userId));
  }, [userId, data, queueCache]);

  const failure = error ?? data?.error ?? null;
  const visible = useMemo(() => {
    const profile = userId && data?.profile?.id === userId ? data.profile : null;
    return profile && failure ? unverified(profile) : profile;
  }, [userId, data, failure]);
  const value = useMemo(() => ({ profile: visible, refetch }), [visible, refetch]);
  // Keep legacy isLoading checks fail-closed throughout verification refreshes.
  const status = useMemo(() => ({ isLoading: !!userId && (fetching || (!data && !failure)),
    isInitialLoading: !!userId && (loading || (!data && !failure)), isRefreshing: !!userId && refreshing,
    error: userId ? failure : null }), [userId, fetching, data, loading, refreshing, failure]);
  return createElement(ProfileDataContext.Provider, { value },
    createElement(ProfileStatusContext.Provider, { value: status }, children));
}
export function useProfileData() { return useContext(ProfileDataContext); }
export function useProfile() { return { ...useProfileData(), ...useContext(ProfileStatusContext) }; }
