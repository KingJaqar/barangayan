'use client';

import { useCallback, useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export type HouseholdMember = {
  id: string;
  name: string;
  relation: string;
  role?: string;
};

type UseFamilyMembersResult = {
  members: HouseholdMember[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addMember: (member: { name: string; relation: string; role?: string }) => Promise<HouseholdMember | null>;
  updateMember: (id: string, updates: Partial<Omit<HouseholdMember, 'id'>>) => Promise<HouseholdMember | null>;
  removeMember: (id: string) => Promise<boolean>;
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
 */
export function useFamilyMembers(profileId: string | null): UseFamilyMembersResult {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!profileId) {
      setMembers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: qErr } = await supabase.from('profiles').select('household_members').eq('id', profileId).single();

    if (qErr) {
      setError(qErr.message);
      setMembers([]);
    } else {
      const raw = data?.household_members;
      const normalized: HouseholdMember[] = Array.isArray(raw)
        ? (raw as Record<string, unknown>[]).map((m) => ({
            id: String(m.id ?? genId()),
            name: String(m.name ?? 'Unknown'),
            relation: String(m.relation ?? ''),
            role: m.role ? String(m.role) : undefined,
          }))
        : [];
      setMembers(normalized);
    }
    setIsLoading(false);
  }, [profileId]);

  useEffect(() => {
    // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
    // react-hooks/set-state-in-effect.
    Promise.resolve().then(() => fetchMembers());
  }, [fetchMembers]);

  const persistMembers = useCallback(
    async (next: HouseholdMember[]): Promise<boolean> => {
      if (!profileId) return false;
      const supabase = createSupabaseBrowserClient();
      const payload = next.map((m) => ({ id: m.id, name: m.name, relation: m.relation, ...(m.role ? { role: m.role } : {}) }));
      const { error: upErr } = await supabase.from('profiles').update({ household_members: payload }).eq('id', profileId);

      if (upErr) {
        setError(upErr.message);
        return false;
      }
      setMembers(next);
      return true;
    },
    [profileId],
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

  return { members, isLoading, error, refetch: fetchMembers, addMember, updateMember, removeMember };
}
