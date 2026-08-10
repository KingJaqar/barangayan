'use client';

import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { HouseholdMemberFormValues } from '@barangayan/shared';

export type HouseholdMember = {
  id: string;
  profile_id: string;
  name: string;
  relation: string;
  role: string;
  avatar_url: string | null;
  is_checked_in: boolean;
  checked_in_at: string | null;
  checked_in_center_id: string | null;
  checked_in_center_name: string | null;
  sort_order: number;
};

export type HouseholdResident = {
  id: string;
  full_name: string;
  email: string | null;
  mobile_number: string | null;
  home_address: string | null;
  created_at: string;
  household_members: Array<{ id: string; name: string; relation: string; role: string }>;
};

export type HouseholdsData = {
  residents: HouseholdResident[];
  members: HouseholdMember[];
};

export function useHouseholds(barangayId: string | null) {
  const toast = useToast();
  const [data, setData] = useState<HouseholdsData>({ residents: [], members: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHouseholds = useCallback(async () => {
    if (!barangayId) return;
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();

    const { data: residents, error: residentsError } = await supabase
      .from('profiles')
      .select(
        'id, full_name, email, mobile_number, home_address, household_members, created_at',
      )
      .eq('role', 'resident')
      .eq('barangay_id', barangayId)
      .is('deleted_at', null)
      .order('full_name');

    if (residentsError) {
      setError(residentsError.message);
      setLoading(false);
      return;
    }

    const residentIds = (residents ?? []).map((r) => r.id);

    let members: HouseholdMember[] = [];
    if (residentIds.length > 0) {
      const { data: hm, error: hmError } = await supabase
        .from('household_members')
        .select('*')
        .in('profile_id', residentIds)
        .order('sort_order');

      if (hmError) {
        setError(hmError.message);
        setLoading(false);
        return;
      }
      members = (hm ?? []) as HouseholdMember[];
    }

    setData({
      residents: (residents ?? []) as HouseholdResident[],
      members,
    });
    setLoading(false);
  }, [barangayId]);

  useEffect(() => {
    // Data-fetching on mount is a legitimate pattern; eslint-disable is scoped to this call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHouseholds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barangayId]);

  async function addMember(profileId: string, values: HouseholdMemberFormValues) {
    const supabase = createSupabaseBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('admin_add_household_member', {
      p_profile_id: profileId,
      p_name: values.name,
      p_relation: values.relation,
      p_role: values.role,
    });

    if (error) {
      toast.showError(`Failed to add member: ${error.message}`);
      throw error;
    }

    toast.showSuccess('Household member added.');
    await fetchHouseholds();
  }

  async function updateMember(
    profileId: string,
    memberId: string,
    values: { name: string; relation: string; role: string },
  ) {
    const supabase = createSupabaseBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('admin_update_household_member', {
      p_profile_id: profileId,
      p_member_id: memberId,
      p_name: values.name,
      p_relation: values.relation,
      p_role: values.role,
    });

    if (error) {
      toast.showError(`Failed to update member: ${error.message}`);
      throw error;
    }

    toast.showSuccess('Household member updated.');
    await fetchHouseholds();
  }

  async function removeMember(profileId: string, memberId: string) {
    const supabase = createSupabaseBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('admin_remove_household_member', {
      p_profile_id: profileId,
      p_member_id: memberId,
    });

    if (error) {
      toast.showError(`Failed to remove member: ${error.message}`);
      throw error;
    }

    toast.showSuccess('Household member removed.');
    await fetchHouseholds();
  }

  return {
    data,
    loading,
    error,
    refetch: fetchHouseholds,
    addMember,
    updateMember,
    removeMember,
  };
}
