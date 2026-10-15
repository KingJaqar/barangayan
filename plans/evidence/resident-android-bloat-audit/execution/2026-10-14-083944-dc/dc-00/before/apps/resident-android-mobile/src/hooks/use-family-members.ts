import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@barangayan/shared';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';

export type HouseholdMember = Tables<'household_members'>;

type UseFamilyMembersResult = {
  members: HouseholdMember[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addMember: (member: { name: string; relation: string; role?: string; avatar_url?: string | null }) => Promise<HouseholdMember | null>;
  updateMember: (id: string, updates: Partial<HouseholdMember>) => Promise<HouseholdMember | null>;
  removeMember: (id: string) => Promise<boolean>;
  checkInMember: (id: string, centerId: string, centerName: string) => Promise<HouseholdMember | null>;
  checkOutMember: (id: string) => Promise<HouseholdMember | null>;
};

export function useFamilyMembers(): UseFamilyMembersResult {
  const { session } = useAuth();
  const { profile } = useProfile();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profileId = profile?.id ?? session?.user?.id ?? null;

  async function fetchMembers() {
    if (!profileId) {
      setMembers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from('household_members')
      .select('*')
      .eq('profile_id', profileId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (qErr) {
      setError(qErr.message);
      setMembers([]);
    } else {
      setMembers((data ?? []) as HouseholdMember[]);
    }
    setIsLoading(false);
  }

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
        .from('household_members')
        .select('*')
        .eq('profile_id', profileId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (qErr) {
        setError(qErr.message);
        setMembers([]);
      } else if (!cancelled) {
        setMembers((data ?? []) as HouseholdMember[]);
      }
      if (!cancelled) setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [profileId]);

  const addMember = useCallback(
    async (input: { name: string; relation: string; role?: string; avatar_url?: string | null }): Promise<HouseholdMember | null> => {
      if (!profileId) return null;
      setIsLoading(true);
      setError(null);
      const { data, error: qErr } = await supabase
        .from('household_members')
        .insert({
          profile_id: profileId,
          name: input.name.trim(),
          relation: input.relation.trim(),
          role: input.role?.trim() || 'member',
          avatar_url: input.avatar_url ?? null,
        })
        .select('*')
        .single();

      if (qErr) {
        setError(qErr.message);
        setIsLoading(false);
        return null;
      }

      setMembers((prev) => [...prev, data as HouseholdMember]);
      setIsLoading(false);
      return data as HouseholdMember;
    },
    [profileId],
  );

  const updateMember = useCallback(
    async (id: string, updates: Partial<HouseholdMember>): Promise<HouseholdMember | null> => {
      setIsLoading(true);
      setError(null);
      const { data, error: qErr } = await supabase
        .from('household_members')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (qErr) {
        setError(qErr.message);
        setIsLoading(false);
        return null;
      }

      setMembers((prev) => prev.map((m) => (m.id === id ? (data as HouseholdMember) : m)));
      setIsLoading(false);
      return data as HouseholdMember;
    },
    [],
  );

  const removeMember = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    const { error: qErr } = await supabase
      .from('household_members')
      .delete()
      .eq('id', id);

    if (qErr) {
      setError(qErr.message);
      setIsLoading(false);
      return false;
    }

    setMembers((prev) => prev.filter((m) => m.id !== id));
    setIsLoading(false);
    return true;
  }, []);

  const checkInMember = useCallback(
    async (id: string, centerId: string, centerName: string): Promise<HouseholdMember | null> => {
      return updateMember(id, {
        is_checked_in: true,
        checked_in_at: new Date().toISOString(),
        checked_in_center_id: centerId,
        checked_in_center_name: centerName,
      });
    },
    [updateMember],
  );

  const checkOutMember = useCallback(
    async (id: string): Promise<HouseholdMember | null> => {
      return updateMember(id, {
        is_checked_in: false,
        checked_in_at: null,
        checked_in_center_id: null,
        checked_in_center_name: null,
      });
    },
    [updateMember],
  );

  return {
    members,
    isLoading,
    error,
    refetch: fetchMembers,
    addMember,
    updateMember,
    removeMember,
    checkInMember,
    checkOutMember,
  };
}
