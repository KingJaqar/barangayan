'use client';

import type { Tables } from '@barangayan/shared';
import { useCallback, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export type EvacuationCenterCheckin = Tables<'evacuation_center_checkins'>;

type UseQrCheckinsResult = {
  isLoading: boolean;
  error: string | null;
  checkIn: (evacuationCenterId: string) => Promise<EvacuationCenterCheckin | null>;
  /** Marks every member of this resident's household as checked in — the
   * `household_members` table (not the jsonb roster, see use-family-members.ts) is the
   * canonical store for `is_checked_in`, matching mobile's use-qr-checkins.ts exactly. */
  updateHouseholdStatus: () => Promise<boolean>;
};

/**
 * Web port of use-qr-checkins.ts [C-011]. The offline check-in queue
 * (enqueueCheckin/AsyncStorage) is dropped — offline support is a non-goal for web (plan
 * §9) — a failed check-in here surfaces an error toast instead of queueing silently.
 */
export function useQrCheckins(userId: string | null, barangayId: string | null): UseQrCheckinsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkIn = useCallback(
    async (evacuationCenterId: string): Promise<EvacuationCenterCheckin | null> => {
      if (!userId || !barangayId) {
        setError('You must be signed in to check in.');
        return null;
      }
      setIsLoading(true);
      setError(null);
      const supabase = createSupabaseBrowserClient();

      const { data, error: qErr } = await supabase
        .from('evacuation_center_checkins')
        .insert({ evacuation_center_id: evacuationCenterId, user_id: userId, barangay_id: barangayId })
        .select('*')
        .single();

      setIsLoading(false);
      if (qErr) {
        setError(qErr.message);
        return null;
      }
      return data as EvacuationCenterCheckin;
    },
    [userId, barangayId],
  );

  const updateHouseholdStatus = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.from('household_members').update({ is_checked_in: true }).eq('profile_id', userId);

    if (updateError) {
      setError(updateError.message);
      return false;
    }
    return true;
  }, [userId]);

  return { isLoading, error, checkIn, updateHouseholdStatus };
}
