'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { AccountRequestScope, type Tables } from '@barangayan/shared';

export type ProfileWithBarangay = Pick<
  Tables<'profiles'>,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'middle_name'
  | 'suffix'
  | 'sex'
  | 'email'
  | 'mobile_number'
  | 'house_no'
  | 'street'
  | 'city'
  | 'province'
  | 'current_id_submission_id'
  | 'approved_id_submission_id'
  | 'id_repair_required'
  | 'employment_status'
  | 'occupation'
  | 'id_verification_status'
  | 'avatar_url'
  | 'id_type'
  | 'id_photo_urls'
  | 'barangay_id'
  | 'theme_preference'
  | 'accent_color'
  | 'font_preference'
  | 'household_members'
> & {
  barangays: Pick<Tables<'barangays'>, 'name'> | null;
};

/**
 * Thin client-side profile hook for Settings pages. Unlike the mobile app's
 * ProfileProvider (which carries a cache layer for offline use), this is a straightforward
 * fetch-on-mount, refetch-on-demand hook — no offline infra in resident-web v1.
 * Pages that need profile data server-side fetch it directly via requireUser() or a
 * separate server query; this hook is for client components that need to read or react
 * to profile changes after an action (e.g. avatar upload, profile form save).
 */
export function useProfile(userId: string): {
  profile: ProfileWithBarangay | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [profile, setProfile] = useState<ProfileWithBarangay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scope = useRef(new AccountRequestScope());

  const doFetch = useCallback(() => {
    const ticket = scope.current.begin(userId);
    setIsLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    supabase
      .from('profiles')
      .select(
        'id, first_name, last_name, middle_name, suffix, sex, email, mobile_number, house_no, street, city, province, current_id_submission_id, approved_id_submission_id, id_repair_required, employment_status, occupation, id_verification_status, avatar_url, id_type, id_photo_urls, barangay_id, theme_preference, accent_color, font_preference, household_members, barangays(name)',
      )
      .eq('id', userId)
      .single()
      .then(({ data, error: qErr }) => {
        if (!scope.current.accepts(ticket, userId)) return;
        if (qErr) {
          setProfile(null);
          setError(qErr.message);
        } else {
          setProfile(data as ProfileWithBarangay | null);
        }
        setIsLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    let active = true;
    const requestScope = scope.current;
    requestScope.setOwner(userId);
    Promise.resolve().then(() => { if (active) doFetch(); });
    const supabase = createSupabaseBrowserClient();
    const onFocus = () => doFetch();
    window.addEventListener('focus', onFocus);
    const channel = supabase.channel(`profile:${userId}`).on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}`,
    }, doFetch).subscribe();
    return () => { active = false; requestScope.clear(); window.removeEventListener('focus', onFocus); supabase.removeChannel(channel); };
  }, [doFetch, userId]);

  return { profile: profile?.id === userId ? profile : null, isLoading, error, refetch: doFetch };
}
