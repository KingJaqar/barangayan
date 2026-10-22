import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { householdAttendanceErrorMessage, householdAttendanceSchema, type HouseholdAttendance } from '@barangayan/shared';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { householdRequest } from '@/lib/household';

export function useHouseholdAttendance() {
  const { session } = useAuth();
  const owner = session?.user.id ?? null;
  const focused = useIsFocused();
  const [attendance, setAttendance] = useState<HouseholdAttendance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const activeOwner = useRef(owner);
  activeOwner.current = owner;
  const refetch = useCallback(async () => {
    const ticket = ++generation.current;
    pending.current?.abort();
    if (!owner) { setAttendance(null); setLoading(false); setError(null); return; }
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError(null);
    try {
      const { data, error: failure } = await householdRequest(signal => supabase.rpc('get_my_household_attendance').abortSignal(signal), controller.signal);
      if (ticket !== generation.current || activeOwner.current !== owner) return;
      if (failure) { setError(householdAttendanceErrorMessage(failure, 'read')); return; }
      const parsed = householdAttendanceSchema.safeParse(data);
      if (!parsed.success || parsed.data.household_profile_id !== owner) throw new Error('Invalid attendance response');
      setAttendance(parsed.data);
    } catch {
      if (ticket === generation.current && activeOwner.current === owner) setError('Could not load attendance. Reconnect and try again.');
    } finally { if (ticket === generation.current) { pending.current = null; setLoading(false); } }
  }, [owner]);
  const cancelRead = useCallback(() => { generation.current++; pending.current?.abort(); pending.current = null; }, []);
  useEffect(() => {
    if (focused) void refetch();
    return cancelRead;
  }, [refetch, focused, cancelRead]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', next => { if (next === 'active' && focused) void refetch(); });
    return () => listener.remove();
  }, [refetch, focused]);
  const visible = attendance?.household_profile_id === owner ? attendance : null;
  return { attendance: visible, loading: !!owner && (loading || !visible && !error), error: owner ? error : null, refetch };
}
