import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';

/**
 * RFC-4122 v4 UUID — see the matching comment in settings/profile.tsx.
 * profiles.household_members (jsonb) is mirrored by a DB trigger into the
 * canonical household_members table, whose `id` column is a real `uuid`;
 * a non-UUID client id makes that trigger's `::uuid` cast fail with
 * "invalid input syntax for type uuid".
 */
function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type ProfileHouseholdMember = {
  id: string;
  name: string;
  relation: string;
  role?: string;
};

type UseProfileHouseholdMembersResult = {
  members: ProfileHouseholdMember[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addMember: (member: { name: string; relation: string; role?: string }) => Promise<ProfileHouseholdMember | null>;
  updateMember: (id: string, updates: Partial<ProfileHouseholdMember>) => Promise<ProfileHouseholdMember | null>;
  removeMember: (id: string) => Promise<boolean>;
};

export function useProfileHouseholdMembers(): UseProfileHouseholdMembersResult {
  const { session } = useAuth();
  const { profile } = useProfile();
  const [members, setMembers] = useState<ProfileHouseholdMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profileId = profile?.id ?? session?.user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!profileId) {
        setMembers([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);

      const { data, error: qErr } = await supabase
        .from('profiles')
        .select('household_members')
        .eq('id', profileId)
        .single();

      if (qErr) {
        setError(qErr.message);
        setMembers([]);
      } else if (!cancelled) {
        const raw = (data as any)?.household_members;
        const normalized: ProfileHouseholdMember[] = Array.isArray(raw)
          ? raw.map((m: any) => ({
              id: String(m.id ?? m.name ?? Math.random()),
              name: String(m.name ?? 'Unknown'),
              relation: String(m.relation ?? ''),
              role: m.role ? String(m.role) : undefined,
            }))
          : [];
        setMembers(normalized);
      }
      if (!cancelled) setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [profileId]);

  const persistMembers = async (next: ProfileHouseholdMember[]): Promise<boolean> => {
    if (!profileId) return false;
    const payload = next.map((m) => ({
      id: m.id,
      name: m.name,
      relation: m.relation,
      ...(m.role ? { role: m.role } : {}),
    }));
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ household_members: payload } as any)
      .eq('id', profileId);

    if (upErr) {
      setError(upErr.message);
      return false;
    }
    setMembers(next);
    return true;
  };

  const addMember = async (input: { name: string; relation: string; role?: string }): Promise<ProfileHouseholdMember | null> => {
    if (!profileId) return null;
    const newMember: ProfileHouseholdMember = {
      id: genId(),
      name: input.name.trim(),
      relation: input.relation.trim(),
      ...(input.role?.trim() ? { role: input.role.trim() } : {}),
    };
    const next = [...members, newMember];
    const ok = await persistMembers(next);
    return ok ? newMember : null;
  };

  const updateMember = async (id: string, updates: Partial<ProfileHouseholdMember>): Promise<ProfileHouseholdMember | null> => {
    if (!profileId) return null;
    const next = members.map((m) => (m.id === id ? { ...m, ...updates } : m));
    const updated = next.find((m) => m.id === id);
    const ok = await persistMembers(next);
    return ok ? updated ?? null : null;
  };

  const removeMember = async (id: string): Promise<boolean> => {
    if (!profileId) return false;
    const next = members.filter((m) => m.id !== id);
    return persistMembers(next);
  };

  return {
    members,
    isLoading,
    error,
    refetch: async () => {
      // Refetch is handled by the effect re-running when profileId changes.
      return Promise.resolve();
    },
    addMember,
    updateMember,
    removeMember,
  };
}
