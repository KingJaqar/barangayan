'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { idVerificationState, type Tables } from '@barangayan/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { abortable, createIdClient } from './valid-id/transport';

type IdProfile = Pick<Tables<'profiles'>, 'id' | 'role' | 'deleted_at' | 'id_verification_status' | 'current_id_submission_id' | 'approved_id_submission_id' | 'id_repair_required'>;
type Status = { owner: string | null; profile: IdProfile | null; loading: boolean; error: string | null; access: boolean; reason: string | null };
const initial: Status = { owner: null, profile: null, loading: true, error: null, access: false, reason: null };
const Context = createContext<(Status & { refresh: () => Promise<void>; isOwner: (id: string) => boolean }) | null>(null);

/** One Settings owner for auth, focus, Realtime and coalesced ID-status reads. */
export function SettingsIdStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(initial);
  const owner = useRef<string | null>(null);
  const generation = useRef(0);
  const active = useRef<AbortController | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const queued = useRef(false);
  const refresh = useCallback(function refreshStatus(): Promise<void> {
    if (inFlight.current) { queued.current = true; return inFlight.current; }
    const id = owner.current;
    if (!id) return Promise.resolve();
    const ticket = generation.current;
    const controller = new AbortController();
    active.current = controller;
    const timer = setTimeout(() => controller.abort(), 10000);
    setStatus(previous => ({ ...previous, profile: null, loading: true, error: null, reason: null }));
    const work = (async () => {
      try {
        const client = createIdClient(controller.signal);
        const { data: { user }, error: authError } = await abortable(client.auth.getUser(), controller.signal);
        if (authError || !user || user.is_anonymous || user.id !== id) throw new Error('auth');
        const { data, error } = await abortable(client.from('profiles')
          .select('id, role, deleted_at, id_verification_status, current_id_submission_id, approved_id_submission_id, id_repair_required')
          .eq('id', id).single(), controller.signal);
        if (error || !data) throw new Error('read');
        let reason: string | null = null;
        if (data.current_id_submission_id && idVerificationState(data) === 'failed') {
          const result = await abortable(client.from('id_submissions').select('rejection_reason').eq('id', data.current_id_submission_id).eq('resident_id', id).maybeSingle(), controller.signal);
          if (result.error) throw new Error('read');
          reason = result.data?.rejection_reason ?? null;
        }
        if (generation.current !== ticket || owner.current !== id) return;
        const access = (data.role === 'resident' || data.role === 'admin') && data.deleted_at === null;
        setStatus({ owner: id, profile: access ? data : null, access, loading: false, error: access ? null : 'Sign in with an active resident account to submit an ID.', reason });
      } catch (cause) {
        if (generation.current !== ticket || owner.current !== id) return;
        setStatus({ owner: id, profile: null, access: false, loading: false, reason: null,
          error: cause instanceof Error && cause.message === 'auth' ? 'Sign in again to access your ID verification.' : 'Verification status is temporarily unavailable. Please try again.' });
      } finally {
        clearTimeout(timer);
        if (active.current === controller) active.current = null;
      }
    })();
    const settled = work.finally(() => {
      if (inFlight.current !== settled) return;
      inFlight.current = null;
      if (queued.current && generation.current === ticket) { queued.current = false; void refreshStatus(); }
    });
    inFlight.current = settled;
    return settled;
  }, []);

  useEffect(() => {
    let mounted = true;
    const requestGeneration = generation;
    const client = createSupabaseBrowserClient();
    let channel: ReturnType<typeof client.channel> | null = null;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id ?? null;
      if (!mounted || next === owner.current) {
        if (mounted && !next) setStatus({ ...initial, loading: false });
        return;
      }
      ++requestGeneration.current;
      active.current?.abort();
      inFlight.current = null;
      queued.current = false;
      if (channel) void client.removeChannel(channel);
      channel = null;
      owner.current = next;
      setStatus({ ...initial, owner: next, loading: !!next });
      if (!next) return;
      channel = client.channel(`settings-id:${next}`).on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${next}`,
      }, () => void refresh()).subscribe();
      // Never call Auth inside its own callback lock.
      void Promise.resolve().then(() => { if (mounted) void refresh(); });
    });
    const focused = () => { void refresh(); };
    window.addEventListener('focus', focused);
    return () => {
      mounted = false;
      ++requestGeneration.current;
      owner.current = null;
      active.current?.abort();
      inFlight.current = null;
      queued.current = false;
      subscription.unsubscribe();
      if (channel) void client.removeChannel(channel);
      window.removeEventListener('focus', focused);
    };
  }, [refresh]);
  const isOwner = useCallback((id: string) => owner.current === id, []);
  return <Context.Provider value={{ ...status, refresh, isOwner }}>{children}</Context.Provider>;
}

export function useSettingsIdStatus() {
  const status = useContext(Context);
  if (!status) throw new Error('Settings ID status requires the Settings provider.');
  return status;
}
