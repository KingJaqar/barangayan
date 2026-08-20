'use client';

import { useCallback, useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Tables } from '@barangayan/shared';

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

  const doFetch = useCallback(() => {
    setIsLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    supabase
      .from('profiles')
      .select(
        'id, first_name, last_name, middle_name, suffix, sex, email, mobile_number, house_no, street, city, employment_status, occupation, id_verification_status, avatar_url, id_type, id_photo_urls, barangay_id, theme_preference, accent_color, font_preference, household_members, barangays(name)',
      )
      .eq('id', userId)
      .single()
      .then(({ data, error: qErr }) => {
        if (qErr) {
          setError(qErr.message);
        } else {
          setProfile(data as ProfileWithBarangay | null);
        }
        setIsLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    Promise.resolve().then(() => doFetch());
  }, [doFetch]);

  return { profile, isLoading, error, refetch: doFetch };
}
