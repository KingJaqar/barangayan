'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { attendanceRequest, type HouseholdAttendance, type Json } from '@barangayan/shared';
import { useScopedRead } from '@/hooks/use-scoped-read';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { readHouseholdRoster, readHouseholdAttendance, residentHouseholdProfile, type HouseholdMember } from '@/lib/household';

export type { HouseholdMember } from '@/lib/household';
export type HouseholdWriteFailure = 'rejected' | 'unconfirmed' | 'busy' | 'conflict' | 'active' | 'invalid' | 'session';
type Snapshot = { raw: Json; members: HouseholdMember[]; attendance: HouseholdAttendance | null; attendanceError: boolean };

/** Both roster editors share validated reads, raw CAS snapshots and session cleanup.
 * Attendance is a separate authority, optionally loaded in one bounded set request. */
export function useFamilyMembers(profileId: string | null, includeAttendance = false) {
  const [privateHidden, setPrivateHidden] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [writeMessage, setWriteMessage] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const lifetime = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const pendingRead = useRef<Promise<Snapshot> | null>(null);
  const latest = useRef<Snapshot | null>(null);
  const failure = useRef<HouseholdWriteFailure | null>(null);
  const pendingAdd = useRef<HouseholdMember | null>(null);
  const draftBase = useRef<Snapshot | null>(null);
  const rebaseDraft = useRef(false);

  useEffect(() => {
    const life = new AbortController(); lifetime.current = life;
    latest.current = null; pendingRead.current = null; pendingAdd.current = null; draftBase.current = null;
    writing.current = false;
    const clear = () => {
      life.abort(); lifetime.current?.abort(); latest.current = null; pendingAdd.current = null;
      draftBase.current = null; setPrivateHidden(true);
    };
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session && session.user.id !== profileId)) clear();
    });
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      // A restored page starts empty and revalidates before revealing private data.
      lifetime.current = new AbortController(); pendingRead.current = null;
      setPrivateHidden(false); setEpoch(value => value + 1);
    };
    window.addEventListener('pagehide', clear); window.addEventListener('pageshow', restore);
    void Promise.resolve().then(() => {
      if (!life.signal.aborted) { setPrivateHidden(false); setEpoch(value => value + 1); }
    });
    return () => {
      life.abort(); lifetime.current?.abort(); subscription.unsubscribe(); latest.current = null;
      setPrivateHidden(true);
      window.removeEventListener('pagehide', clear); window.removeEventListener('pageshow', restore);
    };
  }, [profileId]);

  const load = useCallback(async (): Promise<Snapshot> => {
    const life = lifetime.current;
    if (!profileId || !life || life.signal.aborted) throw new Error('Sign in again to load your household.');
    if (pendingRead.current) return pendingRead.current;
    const task = attendanceRequest(life.signal, async signal => {
      const profile = await residentHouseholdProfile(profileId, signal);
      const roster = readHouseholdRoster(profile.household_members);
      let attendance = latest.current?.attendance ?? null;
      let attendanceError = false;
      if (includeAttendance) {
        try {
          const result = await createSupabaseBrowserClient().rpc('get_my_household_attendance').retry(false).abortSignal(signal);
          if (result.error) throw new Error('Attendance unavailable.');
          attendance = readHouseholdAttendance(result.data, profileId);
        } catch { attendanceError = true; }
      }
      if (signal.aborted || life.signal.aborted) throw new Error('Request ended.');
      const snapshot = { ...roster, attendance, attendanceError };
      latest.current = snapshot; setReconciling(false);
      if (rebaseDraft.current) { draftBase.current = snapshot; rebaseDraft.current = false; }
      return snapshot;
    });
    pendingRead.current = task;
    try { return await task; }
    catch (cause) {
      if (!life.signal.aborted && cause instanceof Error && cause.message === 'resident_identity_required') {
        life.abort(); latest.current = null; pendingAdd.current = null; setPrivateHidden(true);
      }
      throw new Error('Could not load your household. Check your connection and account, then try again.');
    } finally { if (pendingRead.current === task) pendingRead.current = null; }
  }, [profileId, includeAttendance]);

  const read = useScopedRead<Snapshot>(`${profileId ?? ''}:${epoch}:${privateHidden}`, () =>
    load().then(data => ({ data, error: null })));
  const { refetch: refreshRead, setData } = read;
  const refetch = useCallback((contentName?: string) => {
    if (!writing.current && !privateHidden) refreshRead(contentName);
  }, [privateHidden, refreshRead]);

  useEffect(() => {
    let left = false;
    const blur = () => { left = true; };
    const focus = () => {
      if (left && document.visibilityState === 'visible') { left = false; refetch(); }
    };
    const visibility = () => { if (document.visibilityState === 'hidden') left = true; else focus(); };
    window.addEventListener('blur', blur); window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [refetch]);

  const data = !privateHidden ? read.data : null;
  const canEdit = !!data && !read.error && !read.isRefreshing && !reconciling;
  const persist = useCallback(async (next: HouseholdMember[]): Promise<Snapshot | null> => {
    failure.current = null;
    const life = lifetime.current;
    if (writing.current) { failure.current = 'busy'; return null; }
    if (!profileId || !life || life.signal.aborted || privateHidden) { failure.current = 'session'; return null; }
    if (!canEdit || !data) { failure.current = 'invalid'; return null; }
    try { readHouseholdRoster(next); } catch { failure.current = 'invalid'; return null; }
    const expectedSnapshot = (draftBase.current ?? data).raw;
    writing.current = true; setWriteMessage(null);
    let reconcile = false;
    try {
      const result = await attendanceRequest(life.signal, async signal => {
        await residentHouseholdProfile(profileId, signal);
        return createSupabaseBrowserClient().rpc('save_resident_household_if_unchanged', {
          p_members: next, p_expected: expectedSnapshot,
        }).retry(false).abortSignal(signal);
      });
      if (life.signal.aborted) { failure.current = 'session'; return null; }
      if (result.error) {
        const message = result.error.message;
        failure.current = message === 'resident_household_changed' || message === 'household_roster_changed' ? 'conflict'
          : message === 'attendance_lifecycle_conflict' ? 'active'
          : ['22023', '42501', 'PT409'].includes(result.error.code) ? 'rejected' : 'unconfirmed';
        reconcile = failure.current === 'conflict' || failure.current === 'unconfirmed';
        rebaseDraft.current = reconcile;
        setWriteMessage(failure.current === 'conflict'
          ? 'The family list changed. Your draft is kept. Review the refreshed list before choosing Save again.'
          : failure.current === 'active' ? 'Ask staff to check this person out before removing them.'
          : failure.current === 'unconfirmed' ? 'The change may have saved. Check the refreshed list before trying again.'
          : 'Could not save the family list. Check the details and try again.');
        return null;
      }
      if (result.data === null) throw new Error('Unconfirmed roster response.');
      const roster = readHouseholdRoster(result.data);
      const expected = readHouseholdRoster(next).members;
      if (roster.members.length !== expected.length || expected.some(member => !roster.members.some(saved => saved.id === member.id
        && saved.name === member.name && saved.relation === member.relation && saved.role === member.role)))
        throw new Error('Unconfirmed roster response.');
      const snapshot = { ...data, ...roster };
      latest.current = snapshot; draftBase.current = null; setData(snapshot); return snapshot;
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'resident_identity_required') {
        life.abort(); latest.current = null; pendingAdd.current = null; setPrivateHidden(true);
      }
      failure.current = life.signal.aborted ? 'session' : 'unconfirmed';
      if (!life.signal.aborted) {
        reconcile = true;
        rebaseDraft.current = true;
        setWriteMessage(cause instanceof Error && cause.message === 'resident_identity_required'
          ? 'Your account is unavailable. Sign in again.' : 'The change may have saved. Check the refreshed list before trying again.');
      }
      return null;
    } finally {
      writing.current = false;
      if (!life.signal.aborted && reconcile) { setReconciling(true); refreshRead(); }
    }
  }, [canEdit, data, privateHidden, profileId, setData, refreshRead]);

  const members = data?.members ?? [];
  const addMember = async (input: { name: string; relation: string; role?: string }): Promise<HouseholdMember | null> => {
    if (writing.current) { failure.current = 'busy'; return null; }
    const fields = { name: input.name.trim(), relation: input.relation.trim(), role: input.role?.trim() || undefined };
    const old = pendingAdd.current;
    const member = old && old.name === fields.name && old.relation === fields.relation && old.role === fields.role
      ? old : { id: crypto.randomUUID(), ...fields };
    pendingAdd.current = member;
    const existing = members.find(value => value.id === member.id);
    if (existing && canEdit) { pendingAdd.current = null; return existing; }
    const saved = await persist([...members, member]);
    if (saved) pendingAdd.current = null;
    return saved?.members.find(value => value.id === member.id) ?? null;
  };
  const updateMember = async (id: string, updates: Partial<Omit<HouseholdMember, 'id'>>) => {
    if (!members.some(member => member.id === id)) { failure.current = 'conflict'; return null; }
    const saved = await persist(members.map(member => member.id === id ? { ...member, ...updates } : member));
    return saved?.members.find(member => member.id === id) ?? null;
  };
  const removeMember = async (id: string) => {
    if (!members.some(member => member.id === id)) { failure.current = 'conflict'; return false; }
    return (await persist(members.filter(member => member.id !== id))) !== null;
  };
  return { members, attendance: data?.attendance ?? null, attendanceError: data?.attendanceError ?? false,
    isLoading: read.isLoading, isInitialLoading: !privateHidden && read.isInitialLoading,
    isRefreshing: read.isRefreshing, isReady: !!data, error: read.error, errorAnnounced: read.errorAnnounced,
    privateHidden, canEdit, writeMessage, sessionVersion: epoch,
    beginEdit: () => { draftBase.current = data; setWriteMessage(null); }, refetch, addMember, updateMember, removeMember,
    lastWriteFailure: () => failure.current };
}
