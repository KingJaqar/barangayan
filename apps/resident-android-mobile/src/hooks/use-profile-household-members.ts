import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { AppState } from 'react-native';
import type { Json } from '@barangayan/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { HouseholdError, householdRequest, readHouseholdMembers, saveHouseholdMembers, type ProfileHouseholdMember } from '@/lib/household';

function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function useProfileHouseholdMembers() {
  const { session } = useAuth();
  const { profile, refetch: refreshProfile } = useProfile();
  const owner = session?.user.id ?? null;
  const focused = useIsFocused();
  const [state, setState] = useState<{ owner: string; members: ProfileHouseholdMember[]; snapshot: Json } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const generation = useRef(0);
  const read = useRef<AbortController | null>(null);
  const write = useRef<AbortController | null>(null);
  const activeOwner = useRef(owner);
  activeOwner.current = owner;
  const householdIdentity = JSON.stringify(profile?.id === owner ? profile.household_members : null);

  const load = useCallback(async () => {
    if (write.current) return;
    read.current?.abort();
    const ticket = ++generation.current;
    if (!owner) { setState(null); setIsLoading(false); setError(null); return; }
    const controller = new AbortController();
    read.current = controller;
    setIsLoading(true); setError(null);
    try {
      const { data, error: failure } = await householdRequest(signal => supabase.from('profiles').select('household_members').eq('id', owner).abortSignal(signal).single(), controller.signal);
      if (ticket !== generation.current || activeOwner.current !== owner) return;
      if (failure || !data) throw new HouseholdError('Unable to load family members. Reconnect and try again.');
      const members = readHouseholdMembers(data.household_members);
      setState({ owner, members, snapshot: data.household_members ?? [] });
      setSaveError(null); setNeedsReload(false);
    } catch (failure) {
      if (ticket === generation.current && activeOwner.current === owner) setError(failure instanceof HouseholdError ? failure.message : 'Unable to load family members. Reconnect and try again.');
    } finally {
      if (ticket === generation.current) { read.current = null; setIsLoading(false); }
    }
  }, [owner]);

  const cancelRead = useCallback(() => { generation.current++; read.current?.abort(); read.current = null; }, []);
  useEffect(() => {
    if (focused) void load();
    return cancelRead;
  }, [load, focused, householdIdentity, cancelRead]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', next => { if (next === 'active' && focused) void load(); });
    return () => listener.remove();
  }, [load, focused]);
  useEffect(() => () => { write.current?.abort(); write.current = null; }, [owner]);

  const visible = state?.owner === owner ? state : null;
  async function persistMembers(next: ProfileHouseholdMember[]) {
    if (!owner || activeOwner.current !== owner || !visible || isLoading || error || needsReload || write.current) return false;
    const controller = new AbortController();
    write.current = controller;
    setSaveError(null);
    try {
      const result = await saveHouseholdMembers(next, visible.snapshot, controller.signal);
      if (activeOwner.current !== owner || controller.signal.aborted) return false;
      setState({ owner, ...result });
      refreshProfile();
      return true;
    } catch (failure) {
      if (activeOwner.current === owner && !controller.signal.aborted) {
        setSaveError(failure instanceof HouseholdError ? failure.message : 'Could not save your family changes. Reload before trying again.');
        setNeedsReload(true);
      }
      return false;
    } finally { if (write.current === controller) write.current = null; }
  }
  const members = visible?.members ?? [];
  async function addMember(input: { name: string; relation: string; role?: string }) {
    const member = { ...input, id: genId() };
    return await persistMembers([...members, member]) ? member : null;
  }
  async function updateMember(id: string, updates: Partial<ProfileHouseholdMember>) {
    if (!members.some(member => member.id === id)) return null;
    const next = members.map(member => member.id === id ? { ...member, ...updates, id } : member);
    return await persistMembers(next) ? next.find(member => member.id === id) ?? null : null;
  }
  async function removeMember(id: string) {
    if (!members.some(member => member.id === id)) return false;
    return persistMembers(members.filter(member => member.id !== id));
  }
  return { members, isLoading: !!owner && (isLoading || !visible && !error), error: owner ? error : null,
    saveError: owner ? saveError : null, needsReload, refetch: load, addMember, updateMember, removeMember };
}
