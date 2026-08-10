import { useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@barangayan/shared';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';

export type EvacuationCenterCheckin = Tables<'evacuation_center_checkins'>;

type UseQrCheckinsResult = {
  checkins: EvacuationCenterCheckin[];
  isLoading: boolean;
  error: string | null;
  checkIn: (evacuationCenterId: string) => Promise<EvacuationCenterCheckin | null>;
  updateHouseholdStatus: () => Promise<boolean>;
  refetch: () => Promise<void>;
};

export function useQrCheckins(): UseQrCheckinsResult {
  const { session } = useAuth();
  const { profile } = useProfile();
  const [checkins, setCheckins] = useState<EvacuationCenterCheckin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchCheckins() {
    if (!session?.user?.id) {
      setCheckins([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from('evacuation_center_checkins')
      .select('*')
      .eq('user_id', session.user.id)
      .order('checked_in_at', { ascending: false });

    if (qErr) {
      setError(qErr.message);
    } else {
      setCheckins((data ?? []) as EvacuationCenterCheckin[]);
    }
    setIsLoading(false);
  }

  async function checkIn(evacuationCenterId: string): Promise<EvacuationCenterCheckin | null> {
    if (!session?.user?.id || !profile?.barangay_id) {
      setError('You must be signed in to check in.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: qErr } = await supabase
      .from('evacuation_center_checkins')
      .insert({
        evacuation_center_id: evacuationCenterId,
        user_id: session.user.id,
        barangay_id: profile.barangay_id,
      })
      .select('*')
      .single();

    if (qErr) {
      setError(qErr.message);
      setIsLoading(false);
      return null;
    }

    setCheckins((prev) => [data as EvacuationCenterCheckin, ...prev]);
    setIsLoading(false);
    return data as EvacuationCenterCheckin;
  }

  async function updateHouseholdStatus(): Promise<boolean> {
    if (!session?.user?.id) {
      return false;
    }

    const { error: updateError } = await supabase
      .from('household_members')
      .update({ is_checked_in: true })
      .eq('profile_id', session.user.id);

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    return true;
  }

  return { checkins, isLoading, error, checkIn, updateHouseholdStatus, refetch: fetchCheckins };
}
