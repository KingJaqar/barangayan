import type { Tables } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { StaffForm } from './staff-form';
import { StaffRow } from './staff-row';

type OfficialWithProfile = Tables<'barangay_officials'> & { profile: Tables<'profiles'> };

export default async function StaffPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('barangay_id')
    .eq('id', user!.id)
    .single();
  const { data: officials } = await supabase
    .from('barangay_officials')
    .select('*, profile:profiles(*)')
    .is('deleted_at', null)
    .order('official_role', { ascending: true });

  const sorted = (officials ?? [])
    .filter((o): o is OfficialWithProfile => Boolean(o.profile))
    .sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name))
    .sort((a, b) => a.official_role.localeCompare(b.official_role));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Staff & Admin Accounts</h1>
        <p className="text-sm text-zinc-500">
          Invite and manage barangay staff and administrator accounts.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">Total employees</p>
        <p className="text-2xl font-bold text-[#0F6E5B]">{sorted.length}</p>
      </div>

      <div className="mb-8 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          Invite New Account
        </h2>
        <StaffForm barangayId={profile?.barangay_id ?? ''} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
        All Staff & Admins
      </h2>
      <div className="flex flex-col gap-3">
        {sorted.map((o) => (
          <StaffRow key={o.id} official={o} currentUserId={user!.id} />
        ))}
        {sorted.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">
            No staff accounts yet — invite one above.
          </p>
        ) : null}
      </div>
    </div>
  );
}
