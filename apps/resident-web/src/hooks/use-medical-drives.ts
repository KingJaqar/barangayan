'use client';

import type { DriveType, Tables } from '@barangayan/shared';
import { DRIVE_TYPE_CONFIG } from '@barangayan/shared';
import { useCallback, useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';

export type MedicalDrive = Tables<'medical_drives'>;
export type DriveRegistrationRow = Tables<'drive_registrations'> & {
  drive?: MedicalDrive | null;
};

export interface RegisterForDriveResult {
  registration_id: string;
  applicant_number: string;
  priority_score: number;
  status: string;
}

/**
 * Web port of mobile's use-medical-drives.ts [C-015, C-016, C-023] — Active Drives is
 * date-scoped (DriveCalendar + selected day), same as mobile, plus My Registrations and
 * the register_for_drive RPC.
 *
 * @param selectedDate  ISO date (YYYY-MM-DD) whose drives should be fetched. Omit for
 *   hook instances that only need myRegistrations/registerForDrive (My Registrations
 *   page, the applicant form) — no drives-by-date query runs in that case.
 */
export function useMedicalDrives({
  selectedDate,
  typeFilter,
  userId,
}: {
  selectedDate?: string;
  typeFilter: DriveType | 'all';
  userId: string | null;
}) {
  const [drives, setDrives] = useState<MedicalDrive[]>([]);
  const [loadingDrives, setLoadingDrives] = useState(true);
  const [myRegistrations, setMyRegistrations] = useState<DriveRegistrationRow[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [registeredDriveIds, setRegisteredDriveIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  /** Map of YYYY-MM-DD -> up to 3 hex colors (one per distinct drive type that day),
   * used by DriveCalendar to render its colored event dots. */
  const [monthEventMap, setMonthEventMap] = useState<Record<string, string[]>>({});

  const fetchDrives = useCallback(async () => {
    if (!selectedDate) {
      setLoadingDrives(false);
      return;
    }
    setLoadingDrives(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    let query = supabase
      .from('medical_drives')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .eq('drive_date', selectedDate)
      .order('time_start', { ascending: true });

    if (typeFilter !== 'all') {
      query = query.eq('type', typeFilter);
    }

    const { data, error: qErr } = await query;
    if (qErr) {
      setError(qErr.message);
    } else {
      setDrives((data ?? []) as MedicalDrive[]);
    }
    setLoadingDrives(false);
  }, [selectedDate, typeFilter]);

  /** Fetches drive_date + type for every active drive in the given calendar month and
   * builds monthEventMap — mirrors mobile's fetchMonthEventDates. */
  const fetchMonthEventDates = useCallback(async (year: number, month: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const startDate = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;

    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from('medical_drives')
      .select('drive_date, type')
      .eq('is_active', true)
      .is('deleted_at', null)
      .gte('drive_date', startDate)
      .lte('drive_date', endDate);

    const map: Record<string, string[]> = {};
    for (const row of (data ?? []) as { drive_date: string; type: DriveType }[]) {
      const color = driveTypeConfig(row.type).color;
      if (!map[row.drive_date]) map[row.drive_date] = [];
      if (map[row.drive_date].length < 3 && !map[row.drive_date].includes(color)) {
        map[row.drive_date].push(color);
      }
    }
    setMonthEventMap(map);
  }, []);

  const fetchMyRegistrations = useCallback(async () => {
    if (!userId) {
      setMyRegistrations([]);
      setRegisteredDriveIds(new Set());
      return;
    }
    setLoadingRegistrations(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error: qErr } = await supabase
      .from('drive_registrations')
      .select('*, drive:medical_drives(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!qErr) {
      const regs = (data ?? []) as DriveRegistrationRow[];
      setMyRegistrations(regs);
      setRegisteredDriveIds(new Set(regs.map((r) => r.drive_id)));
    }
    setLoadingRegistrations(false);
  }, [userId]);

  useEffect(() => {
    // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
    // react-hooks/set-state-in-effect.
    Promise.resolve().then(() => fetchDrives());
  }, [fetchDrives]);

  useEffect(() => {
    Promise.resolve().then(() => fetchMyRegistrations());
  }, [fetchMyRegistrations]);

  // Realtime: any resident registering decrements stock_remaining on the drive.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(uniqueChannelName('medical-drives'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'medical_drives' }, () => {
        fetchDrives();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDrives]);

  // Realtime: the signed-in resident's own registration list.
  useEffect(() => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(uniqueChannelName(`drive-registrations:${userId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drive_registrations', filter: `user_id=eq.${userId}` }, () => {
        fetchMyRegistrations();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchMyRegistrations]);

  // Atomic registration via the server-side RPC [C-023] — the client never submits a
  // pre-computed priority score; the RPC computes it from age/PWD/comorbidities/prior dose.
  const registerForDrive = useCallback(
    async (params: { driveId: string; age: number; isPwd: boolean; comorbidities: string[]; priorDoseDate?: string | null }): Promise<RegisterForDriveResult> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: qErr } = await supabase.rpc('register_for_drive', {
        p_drive_id: params.driveId,
        p_age: params.age,
        p_is_pwd: params.isPwd,
        p_comorbidities: params.comorbidities,
        p_prior_dose_date: params.priorDoseDate ?? undefined,
      });
      if (qErr) throw new Error(qErr.message);
      await Promise.all([fetchDrives(), fetchMyRegistrations()]);
      return data as unknown as RegisterForDriveResult;
    },
    [fetchDrives, fetchMyRegistrations],
  );

  return {
    drives,
    loadingDrives,
    monthEventMap,
    fetchMonthEventDates,
    myRegistrations,
    loadingRegistrations,
    registeredDriveIds,
    registerForDrive,
    error,
    refetch: fetchDrives,
  };
}

export function driveTypeConfig(type: DriveType) {
  return DRIVE_TYPE_CONFIG[type] ?? DRIVE_TYPE_CONFIG.others;
}
