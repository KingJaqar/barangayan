import { DRIVE_TYPE_CONFIG, type DriveType } from '@barangayan/shared';
import { useFocusEffect } from 'expo-router';
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

  // Unique per hook instance — see use-my-incidents.ts's instanceId comment for why.
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));
  const [barangayId, setBarangayId] = useState<string | null>(null);

  const [drives, setDrives] = useState<MedicalDrive[]>([]);

  /**
   * Map of YYYY-MM-DD → array of up to 3 hex color strings, one per distinct
   * drive type scheduled that day.  Used by DriveCalendar to render colored dots.
   */
  const [monthEventMap, setMonthEventMap] = useState<Record<string, string[]>>({});

  /** All active drives for an entire calendar month (used by month-view filter). */
  const [monthDrives, setMonthDrives] = useState<MedicalDrive[]>([]);
  const [loadingMonthDrives, setLoadingMonthDrives] = useState(false);

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
  /**
   * Fetches drive_date + type for every active drive in the given month and
   * builds monthEventMap: date → up-to-3 unique hex colors (one per drive type).
   * The calendar renders colored dots from this map.
   */
  const fetchMonthEventDates = useCallback(async (year: number, month: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const startDate = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;

    const { data } = await supabase
      .from('medical_drives')
      .select('drive_date, type')
      .eq('is_active', true)
      .is('deleted_at', null)
      .gte('drive_date', startDate)
      .lte('drive_date', endDate);

    const map: Record<string, string[]> = {};
    for (const row of (data ?? []) as { drive_date: string; type: string }[]) {
      const cfg = DRIVE_TYPE_CONFIG[row.type as DriveType];
      const color = cfg?.color ?? '#6B7280';
      if (!map[row.drive_date]) map[row.drive_date] = [];
      // Store up to 3 distinct colors per date so the calendar can render dots
      if (map[row.drive_date].length < 3 && !map[row.drive_date].includes(color)) {
        map[row.drive_date].push(color);
      }
    }
    setMonthEventMap(map);
  }, []);

  // ── Fetch ALL drives for an entire calendar month (month-view filter) ─────
  /**
   * Fetches every active drive in the given month ordered chronologically.
   * Respects the current typeFilter.  Call this when the user activates the
   * "All Medical Drives for [Month]" filter button.
   */
  const fetchMonthDrives = useCallback(async (year: number, month: number) => {
    setLoadingMonthDrives(true);
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const startDate = `${year}-${pad(month)}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;

      let q = supabase
        .from('medical_drives')
        .select('*')
        .eq('is_active', true)
        .is('deleted_at', null)
        .gte('drive_date', startDate)
        .lte('drive_date', endDate)
        .order('drive_date')
        .order('time_start');

      if (typeFilter !== 'all') {
        q = q.eq('type', typeFilter);
      }

      const { data, error: err } = await q;
      if (err) throw err;
      setMonthDrives((data ?? []) as MedicalDrive[]);
    } catch {
      // Non-fatal: month view gracefully handles empty state
    } finally {
      setLoadingMonthDrives(false);
    }
  }, [typeFilter]);

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

  // ── Resolve the resident's barangay for the drive-updates channel filter ──
  useEffect(() => {
    if (!userId) {
      setBarangayId(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('barangay_id')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setBarangayId((data as { barangay_id: string } | null)?.barangay_id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Realtime: any resident registering decrements stock_remaining on the drive ──
  useEffect(() => {
    if (!barangayId) return;
    let cancelled = false;
    const channel = supabase
      .channel(`medical-drives:${barangayId}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'medical_drives', filter: `barangay_id=eq.${barangayId}` },
        () => {
          if (!cancelled) fetchDrives();
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [barangayId, instanceId, fetchDrives]);

  // ── Realtime: the signed-in resident's own registration list ──────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const channel = supabase
      .channel(`drive-registrations:${userId}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drive_registrations', filter: `user_id=eq.${userId}` },
        () => {
          if (!cancelled) fetchMyRegistrations();
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, instanceId, fetchMyRegistrations]);

  // Initial fetch + refetch on every screen focus — covers offline/reconnect gaps that
  // the realtime subscriptions above might miss. Fires on first focus too, so it
  // replaces the old mount-time useEffect pair.
  useFocusEffect(
    useCallback(() => {
      fetchDrives();
      fetchMyRegistrations();
    }, [fetchDrives, fetchMyRegistrations]),
  );

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
    // Active drives panel (date-filtered)
    drives,
    loadingDrives,
    // Calendar event color dots
    monthEventMap,
    fetchMonthEventDates,
    // Month-view panel (all drives in a month)
    monthDrives,
    loadingMonthDrives,
    fetchMonthDrives,
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
