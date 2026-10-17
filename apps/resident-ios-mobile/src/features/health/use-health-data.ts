import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { subscribeToChanges } from '../../data/realtime';
import type { DriveItem, RegistrationSummary } from '../../data/resident-api';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { useLatest } from '../../lib/use-latest';
import { useResident } from '../../lib/runtime';
import { monthBounds, type MonthRef } from './drive-model';

/** Reloads when the screen regains focus (A29-043) but not on first mount, which already loads. Realtime covers the rest. */
export function useRefreshOnFocus(refresh: () => unknown) {
  const latest = useLatest(refresh);
  const seen = useRef(false);
  useFocusEffect(useCallback(() => {
    if (seen.current) void latest.current();
    seen.current = true;
  }, [latest]));
}

/**
 * Every active drive of the barangay in one calendar month, for the dots and the day and month lists. It reloads when the app
 * returns to the foreground (`useResource`) and when any of the barangay's drives change (stock, schedule, deactivation).
 */
export function useDriveMonth(month: MonthRef) {
  const api = useApi();
  const { client, config } = useResident();
  const { from, to } = monthBounds(month);
  const resource = useResource<DriveItem[]>(`drive-month:${from}`, (signal) => api.drivesBetween(from, to, signal));
  const { refresh } = resource;
  useRefreshOnFocus(refresh);
  useEffect(
    () => subscribeToChanges(client, 'drive-month', [{ table: 'medical_drives', filter: `barangay_id=eq.${config.barangayId}` }], () => void refresh()),
    [client, config.barangayId, refresh],
  );
  return resource;
}

/**
 * The signed-in resident's own registrations in brief (status counts and "already registered" marks), refreshed when
 * staff change one. A guest has none and nothing is requested.
 */
export function useRegistrationSummary() {
  const api = useApi();
  const { client, session } = useResident();
  const userId = session?.user.id ?? null;
  const resource = useResource<RegistrationSummary[]>(`registration-summary:${userId ?? 'guest'}`, async (signal) => (userId ? api.registrationSummary(signal) : []));
  const { refresh } = resource;
  useRefreshOnFocus(refresh);
  useEffect(() => {
    if (!userId) return undefined;
    return subscribeToChanges(client, 'registration-summary', [{ table: 'drive_registrations', filter: `user_id=eq.${userId}` }], () => void refresh());
  }, [client, userId, refresh]);
  return resource;
}

/** One active drive of this barangay by route id (null when it is not listed), reloaded when drives change so stock and availability stay current. */
export function useDrive(id: unknown) {
  const api = useApi();
  const { client, config } = useResident();
  const resource = useResource<DriveItem | null>(`drive:${String(id)}`, (signal) => api.drive(id, signal));
  const { refresh } = resource;
  useRefreshOnFocus(refresh);
  useEffect(
    () => subscribeToChanges(client, 'drive-detail', [{ table: 'medical_drives', filter: `barangay_id=eq.${config.barangayId}` }], () => void refresh()),
    [client, config.barangayId, refresh],
  );
  return resource;
}
