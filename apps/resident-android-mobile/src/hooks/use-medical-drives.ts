import { DRIVE_TYPE_CONFIG, RESIDENT_DRIVE_REGISTRATION_COLUMNS, residentDriveRegistrationResultSchema, type ResidentDriveRegistrationResult, type DriveType } from '@barangayan/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AppState } from 'react-native';
import { useProfileData } from '@/hooks/use-profile';
import { useRefreshResource } from '@/hooks/use-refresh-resource';
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
  status: string; // drive_registration_status
  created_at: string;
  updated_at: string;
  // Joined from medical_drives when fetching "My Registrations"
  drive?: MedicalDrive | null;
}

export type RegisterForDriveResult = ResidentDriveRegistrationResult;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useMedicalDrives({ selectedDate, typeFilter, calendarMonth, monthViewActive }: {
  selectedDate: string;
  typeFilter: DriveType | 'all';
  calendarMonth: { year: number; month: number };
  monthViewActive: boolean;
}) {
  const { session } = useAuth();
  const { profile } = useProfileData();
  const userId = session?.user.id ?? null;
  const barangayId = profile?.id === userId ? profile?.barangay_id ?? null : null;
  const owner = JSON.stringify([userId, barangayId]);
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));
  const { year, month } = calendarMonth;
  const pad = (value: number) => String(value).padStart(2, '0');
  const startDate = `${year}-${pad(month)}-01`;
  const endDate = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;

  const loadDrives = useCallback(async (signal: AbortSignal) => {
    let query = supabase.from('medical_drives').select('*').eq('drive_date', selectedDate)
      .eq('is_active', true).is('deleted_at', null).order('time_start').abortSignal(signal);
    if (typeFilter !== 'all') query = query.eq('type', typeFilter);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as MedicalDrive[];
  }, [selectedDate, typeFilter]);
  const daily = useRefreshResource(JSON.stringify([owner, selectedDate, typeFilter]), loadDrives,
    'Could not load medical drives. Please try again.');

  const loadMonth = useCallback(async (signal: AbortSignal) => {
    let query = supabase.from('medical_drives').select('*').eq('is_active', true)
      .is('deleted_at', null).gte('drive_date', startDate).lte('drive_date', endDate)
      .order('drive_date').order('time_start').abortSignal(signal);
    if (typeFilter !== 'all') query = query.eq('type', typeFilter);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as MedicalDrive[];
  }, [startDate, endDate, typeFilter]);
  const monthly = useRefreshResource(JSON.stringify([owner, startDate, typeFilter]), loadMonth,
    'Could not load this month’s medical drives. Please try again.');

  const loadEvents = useCallback(async (signal: AbortSignal) => {
    const { data, error } = await supabase.from('medical_drives').select('drive_date, type')
      .eq('is_active', true).is('deleted_at', null).gte('drive_date', startDate)
      .lte('drive_date', endDate).abortSignal(signal);
    if (error) throw error;
    const map: Record<string, string[]> = {};
    for (const row of (data ?? []) as { drive_date: string; type: string }[]) {
      const color = DRIVE_TYPE_CONFIG[row.type as DriveType]?.color;
      if (!color) continue;
      const colors = map[row.drive_date] ?? (map[row.drive_date] = []);
      if (colors.length < 3 && !colors.includes(color)) colors.push(color);
    }
    return map;
  }, [startDate, endDate]);
  const events = useRefreshResource(JSON.stringify([owner, startDate]), loadEvents,
    'Could not refresh calendar dates. Please try again.');

  const loadRegistrations = useCallback(async (signal: AbortSignal) => {
    if (!userId) return [];
    const { data, error } = await supabase.from('drive_registrations')
      .select(`${RESIDENT_DRIVE_REGISTRATION_COLUMNS}, drive:medical_drives(*)`)
      .eq('user_id', userId).order('created_at', { ascending: false }).abortSignal(signal);
    if (error) throw error;
    return (data ?? []) as DriveRegistration[];
  }, [userId]);
  const registrations = useRefreshResource(owner, loadRegistrations,
    'Could not load your registrations. Please try again.');
  const { refresh: refreshDrives, invalidate: invalidateDrives } = daily;
  const { refresh: refreshMonth, invalidate: invalidateMonth } = monthly;
  const { refresh: refreshEvents, invalidate: invalidateEvents } = events;
  const { refresh: refreshRegistrations, invalidate: invalidateRegistrations } = registrations;

  const refreshFeeds = useCallback(() => {
    void refreshDrives();
    void refreshEvents();
    if (monthViewActive) void refreshMonth();
    if (userId) void refreshRegistrations();
  }, [refreshDrives, refreshEvents, refreshMonth, refreshRegistrations, monthViewActive, userId]);
  const invalidateFeeds = useCallback(() => {
    void invalidateDrives();
    void invalidateEvents();
    if (monthViewActive) void invalidateMonth();
  }, [invalidateDrives, invalidateEvents, invalidateMonth, monthViewActive]);

  useFocusEffect(useCallback(() => { void refreshDrives(); }, [refreshDrives]));
  useFocusEffect(useCallback(() => { void refreshEvents(); }, [refreshEvents]));
  useFocusEffect(useCallback(() => { if (monthViewActive) void refreshMonth(); }, [refreshMonth, monthViewActive]));
  useFocusEffect(useCallback(() => { if (userId) void refreshRegistrations(); }, [refreshRegistrations, userId]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') { invalidateFeeds(); if (userId) void invalidateRegistrations(); }
    });
    return () => listener.remove();
  }, [invalidateFeeds, invalidateRegistrations, userId]);
  useEffect(() => {
    if (!barangayId) return;
    let active = true;
    let subscribed = false;
    const channel = supabase.channel(`medical-drives:${barangayId}:${instanceId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'medical_drives', filter: `barangay_id=eq.${barangayId}`,
      }, () => { if (active) invalidateFeeds(); })
      .subscribe(status => {
        if (!active || status !== 'SUBSCRIBED') return;
        if (subscribed) invalidateFeeds(); else refreshFeeds();
        subscribed = true;
      });
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [barangayId, instanceId, invalidateFeeds, refreshFeeds]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let subscribed = false;
    const channel = supabase.channel(`drive-registrations:${userId}:${instanceId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'drive_registrations', filter: `user_id=eq.${userId}`,
      }, () => { if (active) void invalidateRegistrations(); })
      .subscribe(status => {
        if (!active || status !== 'SUBSCRIBED') return;
        if (subscribed) void invalidateRegistrations(); else void refreshRegistrations();
        subscribed = true;
      });
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [userId, instanceId, invalidateRegistrations, refreshRegistrations]);

  const registerForDrive = useCallback(async (params: {
    driveId: string; age: number; isPwd: boolean; comorbidities: string[]; priorDoseDate?: string | null;
  }): Promise<RegisterForDriveResult> => {
    const { data, error } = await supabase.rpc('register_for_drive', {
      p_drive_id: params.driveId, p_age: params.age, p_is_pwd: params.isPwd,
      p_comorbidities: params.comorbidities, p_prior_dose_date: params.priorDoseDate ?? undefined,
    });
    if (error) throw new Error(error.message);
    await Promise.all([invalidateDrives(), invalidateRegistrations(), invalidateEvents(),
      ...(monthViewActive ? [invalidateMonth()] : [])]);
    return residentDriveRegistrationResultSchema.parse(data);
  }, [invalidateDrives, invalidateRegistrations, invalidateEvents, invalidateMonth, monthViewActive]);
  const myRegistrations = useMemo(() => registrations.data ?? [], [registrations.data]);
  const registeredDriveIds = useMemo(() => new Set(myRegistrations.map(row => row.drive_id)), [myRegistrations]);
  return {
    drives: daily.data ?? [], hasLoadedDrives: daily.hasLoaded, loadingDrives: daily.loading, refreshingDrives: daily.refreshing,
    monthEventMap: events.data ?? {}, calendarError: events.error,
    refetchCalendar: refreshEvents,
    monthDrives: monthly.data ?? [], hasLoadedMonthDrives: monthly.hasLoaded, loadingMonthDrives: monthly.loading, refreshingMonthDrives: monthly.refreshing,
    fetchMonthDrives: refreshMonth,
    myRegistrations, hasLoadedRegistrations: registrations.hasLoaded, loadingRegistrations: registrations.loading, refreshingRegistrations: registrations.refreshing,
    registeredDriveIds, registerForDrive, error: daily.error, monthError: monthly.error,
    registrationsError: registrations.error, refetch: refreshDrives, refetchRegistrations: refreshRegistrations,
  };
}
