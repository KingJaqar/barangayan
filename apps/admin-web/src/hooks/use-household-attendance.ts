'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { householdQrTextSchema, householdAttendanceErrorMessage,
  type HouseholdAttendance, type HouseholdAttendanceReceipt } from '@barangayan/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { attendanceActor, attendanceRequest, readAttendance, readAttendanceReceipt, type AttendanceOperation } from '@/lib/household-attendance';

export function useHouseholdAttendance(actorId: string, barangayId: string, initialProfileId: string | undefined,
  onIdentityLost: () => void, onChanged: () => void) {
  const [household, setHousehold] = useState<HouseholdAttendance | null>(null);
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);
  const [centersError, setCentersError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<AttendanceOperation | null>(null);
  const [receipt, setReceipt] = useState<{ value: HouseholdAttendanceReceipt; operation: AttendanceOperation } | null>(null);
  const lifetime = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const payload = useRef<string | null>(null);
  const pendingRef = useRef<AttendanceOperation | null>(null);

  const load = useCallback(async (raw?: string) => {
    const life = lifetime.current;
    if (!life || life.signal.aborted || locked.current) return;
    const parsed = raw === undefined ? null : householdQrTextSchema.safeParse(raw);
    if (parsed && !parsed.success) {
      payload.current = null; setHousehold(null); setReceipt(null); setStale(true); setRevision(value => value + 1);
      setError('This is not a valid Family QR code. Scan the household’s Family code.'); return;
    }
    const nextPayload = parsed?.success ? JSON.stringify(parsed.data) : payload.current;
    if (raw !== undefined && pendingRef.current) return;
    if (raw !== undefined) { payload.current = nextPayload; setHousehold(null); setReceipt(null); }
    locked.current = true; setBusy(true); setError(null); setStale(true);
    try {
      await attendanceRequest(life.signal, async signal => {
        const db = createSupabaseBrowserClient();
        await attendanceActor(db, actorId, signal);
        const centerRows: { id: string; name: string }[] = [];
        // Reuse the existing complete-options pagination, under the same deadline.
        let centerFailure = false;
        for (let start = 0; ; start += 500) {
          const result = await db.from('evacuation_centers').select('id,name').eq('barangay_id', barangayId)
            .eq('is_active', true).is('deleted_at', null).order('name').order('id').range(start, start + 499).retry(false).abortSignal(signal);
          if (result.error || !result.data) { centerFailure = true; break; }
          centerRows.push(...result.data);
          if (result.data.length < 500) break;
        }
        if (!signal.aborted && !life.signal.aborted) { setCenters(centerRows); setCentersError(centerFailure); }
        if (!nextPayload) return;
        const result = await db.rpc('lookup_household_for_attendance', { p_qr_payload: nextPayload }).retry(false).abortSignal(signal);
        if (result.error) throw new Error(result.error.message);
        const qr = householdQrTextSchema.parse(nextPayload);
        const data = readAttendance(result.data, qr.profileId);
        if (!signal.aborted && !life.signal.aborted) { setHousehold(data); setRevision(value => value + 1); setStale(false); }
      });
    } catch (cause) {
      if (!life.signal.aborted) {
        const message = cause instanceof Error ? cause.message : '';
        if (['authentication_required', 'attendance_forbidden', 'household_unavailable'].includes(message)) { setHousehold(null); setReceipt(null); }
        setError(householdAttendanceErrorMessage({ message }, 'read'));
        if (message === 'authentication_required' || message === 'attendance_forbidden') onIdentityLost();
      }
    } finally { if (!life.signal.aborted) { locked.current = false; setBusy(false); } }
  }, [actorId, barangayId, onIdentityLost]);

  const submit = useCallback(async (operation: AttendanceOperation) => {
    const life = lifetime.current;
    if (!life || life.signal.aborted || locked.current || (pendingRef.current && pendingRef.current !== operation)) return;
    locked.current = true; pendingRef.current = operation; setPending(operation); setBusy(true); setError(null); setStale(true);
    let refresh = false;
    let rejection: string | null = null;
    try {
      const result = await attendanceRequest(life.signal, async signal => {
        const db = createSupabaseBrowserClient();
        await attendanceActor(db, actorId, signal);
        return operation.kind === 'check_in'
          ? await db.rpc('check_in_household_members', { p_profile_id: operation.householdId, p_center_id: operation.centerId,
            p_participants: operation.participants, p_request_id: operation.requestId }).retry(false).abortSignal(signal)
          : await db.rpc('check_out_household_attendance', { p_attendance_ids: operation.attendanceIds,
            p_request_id: operation.requestId }).retry(false).abortSignal(signal);
      });
      if (life.signal.aborted) return;
      if (result.error) {
        // Only explicit transactional rejections release the frozen operation.
        const rejected = ['22023', '42501', 'PT409'].includes(result.error.code);
        if (rejected) { pendingRef.current = null; setPending(null); refresh = true; }
        rejection = householdAttendanceErrorMessage(result.error, 'mutation');
        setError(rejection);
        if (result.error.message === 'authentication_required' || result.error.message === 'attendance_forbidden') { onIdentityLost(); return; }
      } else {
        const confirmed = readAttendanceReceipt(result.data, operation);
        setReceipt({ value: confirmed, operation }); pendingRef.current = null; setPending(null); refresh = true;
        onChanged();
      }
    } catch (cause) {
      if (!life.signal.aborted) {
        if (cause instanceof Error && cause.message === 'authentication_required') onIdentityLost();
        else setError(householdAttendanceErrorMessage(null, 'mutation'));
      }
    } finally {
      if (!life.signal.aborted) {
        locked.current = false; setBusy(false);
        if (refresh) {
          // Receipt remains separate; only this authorized read updates current attendance.
          await load();
          // Rejections stay actionable even when the corrective read succeeds.
          if (!life.signal.aborted && rejection) setError(rejection);
        }
      }
    }
  }, [actorId, load, onChanged, onIdentityLost]);

  useEffect(() => {
    const life = new AbortController(); lifetime.current = life;
    const db = createSupabaseBrowserClient();
    const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session && session.user.id !== actorId)) { life.abort(); onIdentityLost(); }
    });
    const initial = initialProfileId ? JSON.stringify({ type: 'household', version: '1.0', profileId: initialProfileId }) : undefined;
    void Promise.resolve().then(() => { if (!life.signal.aborted) void load(initial); });
    let left = false;
    const hide = () => { if (document.visibilityState === 'hidden') left = true; else if (left) { left = false; void load(); } };
    const blur = () => { left = true; };
    const focus = () => { if (left && document.visibilityState === 'visible') { left = false; void load(); } };
    const pagehide = () => { life.abort(); onIdentityLost(); };
    document.addEventListener('visibilitychange', hide); window.addEventListener('blur', blur);
    window.addEventListener('focus', focus); window.addEventListener('pagehide', pagehide);
    return () => {
      life.abort(); subscription.unsubscribe(); locked.current = false;
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus); window.removeEventListener('pagehide', pagehide);
    };
  }, [actorId, initialProfileId, load, onIdentityLost]);

  return { household, centers, centersError, busy, error, stale, revision, pending, receipt, load, submit };
}
