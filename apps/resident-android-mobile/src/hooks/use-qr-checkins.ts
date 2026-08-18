import { useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@barangayan/shared';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { enqueueCheckin, getQueuedCheckins, clearQueuedCheckins } from '@/lib/emergency-cache';

export type EvacuationCenterCheckin = Tables<'evacuation_center_checkins'>;

const CHECKIN_QUEUE_TAG = 'evacuation_center_checkins_queue';

type UseQrCheckinsResult = {
  checkins: EvacuationCenterCheckin[];
  isLoading: boolean;
  error: string | null;
  checkIn: (evacuationCenterId: string) => Promise<EvacuationCenterCheckin | null>;
  updateHouseholdStatus: () => Promise<boolean>;
  refetch: () => Promise<void>;
  syncPendingCheckins: () => Promise<void>;
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

    const payload = {
      evacuation_center_id: evacuationCenterId,
      user_id: session.user.id,
      barangay_id: profile.barangay_id,
    };

    const { data, error: qErr } = await supabase
      .from('evacuation_center_checkins')
      .insert(payload)
      .select('*')
      .single();

    if (qErr) {
      await enqueueCheckin(CHECKIN_QUEUE_TAG, {
        id: `${session.user.id}-${evacuationCenterId}-${Date.now()}`,
        data: payload as Record<string, unknown>,
        timestamp: Date.now(),
      });
      setError(qErr.message);
      setIsLoading(false);
      return null;
    }

    setCheckins((prev) => [data as EvacuationCenterCheckin, ...prev]);
    setIsLoading(false);
    return data as EvacuationCenterCheckin;
  }

  async function syncPendingCheckins(): Promise<void> {
    const pending = await getQueuedCheckins(CHECKIN_QUEUE_TAG);
    if (pending.length === 0) return;

    for (const entry of pending) {
      const { data, error: qErr } = await supabase
        .from('evacuation_center_checkins')
        .insert(entry.data as Tables<'evacuation_center_checkins'>)
        .select('*')
        .single();

      if (!qErr && data) {
        setCheckins((prev) => [data as EvacuationCenterCheckin, ...prev]);
      }
    }

    await clearQueuedCheckins(CHECKIN_QUEUE_TAG);
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

  return { checkins, isLoading, error, checkIn, updateHouseholdStatus, refetch: fetchCheckins, syncPendingCheckins };
}
