import type { DriveType } from '@barangayan/shared';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type { DriveType };

export interface MedicalDrive {
  id: string;
  barangay_id: string;
  title: string;
  type: DriveType;
  drive_date: string;   // YYYY-MM-DD
  time_start: string;   // HH:MM:SS
  time_end: string;     // HH:MM:SS
  location: string;
  eligible_criteria: string;
  stock_label: string;  // "Remaining Stock" | "Remaining Slots" | …
  stock_unit: string;   // "doses" | "slots" | …
  stock_total: number;
  stock_remaining: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DriveRegistration {
  id: string;
  drive_id: string;
  user_id: string;
  applicant_number: string;
  age: number;
  is_pwd: boolean;
  comorbidities: string[];
  prior_dose_date: string | null;
  priority_score: number;
  status: string; // drive_registration_status
  created_at: string;
  updated_at: string;
  // Joined from medical_drives when fetching "My Registrations"
  drive?: MedicalDrive | null;
}

export interface RegisterForDriveResult {
  registration_id: string;
  applicant_number: string;
  priority_score: number;
  status: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
/**
 * Powers the Health tab's Active Medical Drives and My Registrations panels.
 *
 * @param selectedDate  ISO date string (YYYY-MM-DD) for the calendar's active day.
 * @param typeFilter    Drive-type filter key, or 'all' for no filter.
 */
export function useMedicalDrives({
  selectedDate,
  typeFilter,
}: {
  selectedDate: string;
  typeFilter: DriveType | 'all';
}) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [drives, setDrives] = useState<MedicalDrive[]>([]);
  const [monthEventDates, setMonthEventDates] = useState<string[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<DriveRegistration[]>([]);
  const [registeredDriveIds, setRegisteredDriveIds] = useState<Set<string>>(new Set());

  const [loadingDrives, setLoadingDrives] = useState(false);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch drives for the selected date (and type filter) ──────────────────
  const fetchDrives = useCallback(async () => {
    setLoadingDrives(true);
    setError(null);
    try {
      let q = supabase
        .from('medical_drives')
        .select('*')
        .eq('drive_date', selectedDate)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('time_start');

      if (typeFilter !== 'all') {
        q = q.eq('type', typeFilter);
      }

      const { data, error: err } = await q;
      if (err) throw err;
      setDrives((data ?? []) as MedicalDrive[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load drives';
      setError(msg);
    } finally {
      setLoadingDrives(false);
    }
  }, [selectedDate, typeFilter]);

  // ── Fetch dates in a calendar month that have at least one drive ──────────
  const fetchMonthEventDates = useCallback(async (year: number, month: number) => {
    // month is 1-indexed
    const pad = (n: number) => String(n).padStart(2, '0');
    const startDate = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${pad(month)}-${lastDay}`;

    const { data } = await supabase
      .from('medical_drives')
      .select('drive_date')
      .eq('is_active', true)
      .is('deleted_at', null)
      .gte('drive_date', startDate)
      .lte('drive_date', endDate);

    const unique = [...new Set((data ?? []).map((r: { drive_date: string }) => r.drive_date))];
    setMonthEventDates(unique);
  }, []);

  // ── Fetch the authenticated user's registrations (with drive details) ─────
  const fetchMyRegistrations = useCallback(async () => {
    if (!userId) {
      setMyRegistrations([]);
      setRegisteredDriveIds(new Set());
      return;
    }
    setLoadingRegistrations(true);
    try {
      const { data, error: err } = await supabase
        .from('drive_registrations')
        .select('*, drive:medical_drives(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (err) throw err;
      const regs = (data ?? []) as DriveRegistration[];
      setMyRegistrations(regs);
      setRegisteredDriveIds(new Set(regs.map((r) => r.drive_id)));
    } catch {
      // Non-fatal: guest users land here; the UI gracefully handles no registrations.
    } finally {
      setLoadingRegistrations(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDrives();
  }, [fetchDrives]);

  useEffect(() => {
    fetchMyRegistrations();
  }, [fetchMyRegistrations]);

  // ── Atomic registration via the server-side RPC ───────────────────────────
  const registerForDrive = useCallback(
    async (params: {
      driveId: string;
      age: number;
      isPwd: boolean;
      comorbidities: string[];
      priorDoseDate?: string | null;
    }): Promise<RegisterForDriveResult> => {
      const { data, error: err } = await supabase.rpc('register_for_drive', {
        p_drive_id: params.driveId,
        p_age: params.age,
        p_is_pwd: params.isPwd,
        p_comorbidities: params.comorbidities,
        p_prior_dose_date: params.priorDoseDate ?? null,
      });

      if (err) throw new Error(err.message);

      // Refresh both drives (stock_remaining changed) and registrations list
      await Promise.all([fetchDrives(), fetchMyRegistrations()]);
      return data as unknown as RegisterForDriveResult;
    },
    [fetchDrives, fetchMyRegistrations],
  );

  return {
    // Active drives panel
    drives,
    loadingDrives,
    // Calendar event dots
    monthEventDates,
    fetchMonthEventDates,
    // My Registrations panel
    myRegistrations,
    loadingRegistrations,
    registeredDriveIds,
    // Actions
    registerForDrive,
    error,
    refetch: fetchDrives,
  };
}
