'use client';

import type { Tables } from '@barangayan/shared';
import { useCallback, useRef, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export type EvacuationCenterCheckin = Tables<'evacuation_center_checkins'>;

/**
 * Why the latest check-in did not succeed (see `lastCheckInFailure`):
 * - `rejected`: the service answered with an error, so no check-in was recorded.
 * - `unconfirmed`: no answer arrived, so the check-in may or may not have been recorded.
 */
export type CheckInFailure = 'rejected' | 'unconfirmed';

type UseQrCheckinsResult = {
  isLoading: boolean;
  error: string | null;
  checkIn: (evacuationCenterId: string) => Promise<EvacuationCenterCheckin | null>;
  /** Marks every member of this resident's household as checked in — the
   * `household_members` table (not the jsonb roster, see use-family-members.ts) is the
   * canonical store for `is_checked_in`, matching mobile's use-qr-checkins.ts exactly. */
  updateHouseholdStatus: () => Promise<boolean>;
  /** Failure kind of the most recent `checkIn`, or null if it succeeded. */
  lastCheckInFailure: () => CheckInFailure | null;
};

/**
 * Web port of use-qr-checkins.ts [C-011]. The offline check-in queue
 * (enqueueCheckin/AsyncStorage) is dropped — offline support is a non-goal for web (plan
 * §9) — a failed check-in here surfaces an error toast instead of queueing silently.
 *
 * Feedback plan RW-LT-05: the request, payload and return contracts are unchanged. A
 * thrown rejection is now a failed check-in (never an unhandled one), and
 * `lastCheckInFailure()` tells a rejected insert from one whose response never arrived
 * (postgrest-js reports a failed fetch as status 0), so the screen can avoid claiming a
 * definite failure it cannot know. Nothing here retries.
 */
export function useQrCheckins(userId: string | null, barangayId: string | null): UseQrCheckinsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const failureRef = useRef<CheckInFailure | null>(null);

  const checkIn = useCallback(
    async (evacuationCenterId: string): Promise<EvacuationCenterCheckin | null> => {
      failureRef.current = null;
      if (!userId || !barangayId) {
        failureRef.current = 'rejected';
        setError('You must be signed in to check in.');
        return null;
      }
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error: qErr, status } = await supabase
          .from('evacuation_center_checkins')
          .insert({ evacuation_center_id: evacuationCenterId, user_id: userId, barangay_id: barangayId })
          .select('*')
          .single();

        if (qErr) {
          failureRef.current = status === 0 ? 'unconfirmed' : 'rejected';
          setError(qErr.message);
          return null;
        }
        return data as EvacuationCenterCheckin;
      } catch (thrown) {
        failureRef.current = 'unconfirmed';
        setError(thrown instanceof Error ? thrown.message : 'Request failed');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, barangayId],
  );

  const updateHouseholdStatus = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.from('household_members').update({ is_checked_in: true }).eq('profile_id', userId);

      if (updateError) {
        setError(updateError.message);
        return false;
      }
      return true;
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'Request failed');
      return false;
    }
  }, [userId]);

  const lastCheckInFailure = useCallback(() => failureRef.current, []);

  return { isLoading, error, checkIn, updateHouseholdStatus, lastCheckInFailure };
}
