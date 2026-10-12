'use client';

import { useCallback, useMemo, useRef } from 'react';

import { useScopedRead } from '@/hooks/use-scoped-read';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export type HouseholdMember = {
  id: string;
  name: string;
  relation: string;
  role?: string;
};

/**
 * Why the latest write did not succeed (see `lastWriteFailure`):
 * - `rejected`: the service answered with an error, so the roster was not changed.
 * - `unconfirmed`: no answer arrived (connection lost/aborted/thrown), so the write may or
 *   may not have been applied. Callers must say so and never retry automatically.
 * - `busy`: another write from this hook was still in flight; nothing was sent.
 */
export type HouseholdWriteFailure = 'rejected' | 'unconfirmed' | 'busy';

type UseFamilyMembersResult = {
  members: HouseholdMember[];
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isReady: boolean;
  /** The current profile's latest *read* failure (write failures use `lastWriteFailure`). */
  error: string | null;
  refetch: () => void;
  addMember: (member: { name: string; relation: string; role?: string }) => Promise<HouseholdMember | null>;
  updateMember: (id: string, updates: Partial<Omit<HouseholdMember, 'id'>>) => Promise<HouseholdMember | null>;
  removeMember: (id: string) => Promise<boolean>;
  /** Failure kind of the most recent write, or null if it succeeded. Read it right after
   * awaiting a mutation that returned null/false. */
  lastWriteFailure: () => HouseholdWriteFailure | null;
};

/** RFC-4122 v4 UUID — the household_members table's `id` column is a real `uuid`, and
 * the DB trigger that mirrors this jsonb column into that table (0067) casts `::uuid`.
 * A non-UUID client id makes that cast throw and fails the whole profiles UPDATE. */
function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * The single, canonical CRUD path for a resident's household roster — reused by both
 * the Emergency > Family tab (this phase) and, later, Phase 7's profile editor (see the
 * plan's CC-003 and its Phase 2/7 hooks tables).
 *
 * Deliberately writes to `profiles.household_members` (jsonb), NOT the `household_members`
 * table directly, even though the plan's file-tree prose describes this as "the CRUD hook
 * over household_members". Verified from migrations 0052/0067: the sync trigger only runs
 * `profiles.household_members` -> `household_members` (one-way, on `profiles` UPDATE) —
 * there is no reverse trigger. Writing straight to the table (as mobile's now-dead
 * use-family-members.ts hook does) would silently desync the jsonb roster from the table
 * every time a resident edited it here. Mobile's actually-shipped Family tab
 * (family-content.tsx) already avoids this by using use-profile-household-members.ts's
 * jsonb-based approach instead — this hook follows that proven path, so
 * `household_members` (canonical for admin tooling and check-in state, e.g.
 * `is_checked_in` — see use-qr-checkins.ts) stays correctly synced via the existing
 * trigger. A future Phase 5 read-only applicant picker should read this same jsonb
 * column (or this hook) rather than reintroducing a second, divergent source.
 *
 * Feedback plan RW-LT-05: the read is scoped by profile with newest-request-wins and a
 * failed read keeps any loaded roster instead of replacing it with an empty list. The
 * mutation return contracts are unchanged (member | null / boolean, where null/false
 * means the write did not succeed); `lastWriteFailure()` additionally says whether it was
 * rejected or could not be confirmed. Writes are serialised: the roster is rewritten as a
 * whole array, so an overlapping write would silently drop the other one's change.
 */
export function useFamilyMembers(profileId: string | null): UseFamilyMembersResult {
  const read = useScopedRead<HouseholdMember[]>(profileId ?? '', async () => {
    if (!profileId) return { data: [], error: null };
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.from('profiles').select('household_members').eq('id', profileId).single();
    if (error) return { data: null, error };
    const raw = data?.household_members;
    const normalized: HouseholdMember[] = Array.isArray(raw)
      ? (raw as Record<string, unknown>[]).map((m) => ({
          id: String(m.id ?? genId()),
          name: String(m.name ?? 'Unknown'),
          relation: String(m.relation ?? ''),
          role: m.role ? String(m.role) : undefined,
        }))
      : [];
    return { data: normalized, error: null };
  });
  const { data, setData } = read;
  const members = useMemo(() => data ?? [], [data]);

  const writingRef = useRef(false);
  const failureRef = useRef<HouseholdWriteFailure | null>(null);

  const persistMembers = useCallback(
    async (next: HouseholdMember[]): Promise<boolean> => {
      if (!profileId) {
        failureRef.current = 'rejected';
        return false;
      }
      if (writingRef.current) {
        failureRef.current = 'busy';
        return false;
      }
      writingRef.current = true;
      failureRef.current = null;
      try {
        const supabase = createSupabaseBrowserClient();
        const payload = next.map((m) => ({ id: m.id, name: m.name, relation: m.relation, ...(m.role ? { role: m.role } : {}) }));
        const { error, status } = await supabase.from('profiles').update({ household_members: payload }).eq('id', profileId);
        if (error) {
          // Status 0 means no HTTP answer arrived (postgrest-js reports a failed/aborted
          // fetch that way), so the write may have been applied.
          failureRef.current = status === 0 ? 'unconfirmed' : 'rejected';
          return false;
        }
        setData(next);
        return true;
      } catch {
        failureRef.current = 'unconfirmed';
        return false;
      } finally {
        writingRef.current = false;
      }
    },
    [profileId, setData],
  );

  const addMember = useCallback(
    async (input: { name: string; relation: string; role?: string }): Promise<HouseholdMember | null> => {
      if (!profileId) return null;
      const newMember: HouseholdMember = {
        id: genId(),
        name: input.name.trim(),
        relation: input.relation.trim(),
        ...(input.role?.trim() ? { role: input.role.trim() } : {}),
      };
      const ok = await persistMembers([...members, newMember]);
      return ok ? newMember : null;
    },
    [members, persistMembers, profileId],
  );

  const updateMember = useCallback(
    async (id: string, updates: Partial<Omit<HouseholdMember, 'id'>>): Promise<HouseholdMember | null> => {
      const next = members.map((m) => (m.id === id ? { ...m, ...updates } : m));
      const updated = next.find((m) => m.id === id) ?? null;
      const ok = await persistMembers(next);
      return ok ? updated : null;
    },
    [members, persistMembers],
  );

  const removeMember = useCallback(
    async (id: string): Promise<boolean> => {
      return persistMembers(members.filter((m) => m.id !== id));
    },
    [members, persistMembers],
  );

  const lastWriteFailure = useCallback(() => failureRef.current, []);

  return {
    members,
    isLoading: read.isLoading,
    isInitialLoading: read.isInitialLoading,
    isRefreshing: read.isRefreshing,
    isReady: read.isReady,
    error: read.error,
    refetch: read.refetch,
    addMember,
    updateMember,
    removeMember,
    lastWriteFailure,
  };
}
