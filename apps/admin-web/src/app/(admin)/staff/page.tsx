import type { Tables } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { StaffTable } from './staff-table';
import { TABS, type Tab } from './types';

export type OfficialWithProfile = Tables<'barangay_officials'> & { profile: Tables<'profiles'> };

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-black/10 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ tab?: string; role?: string; q?: string }> }) {
  const { tab: tabParam, role: filterRole, q } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'all';

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();
  const { data: officials } = await supabase
    .from('barangay_officials')
    .select('*, profile:profiles(*)')
    .is('deleted_at', null)
    .order('official_role', { ascending: true });

  const allRows = (officials ?? [])
    .filter((o): o is OfficialWithProfile => Boolean(o.profile))
    .sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name))
    .sort((a, b) => a.official_role.localeCompare(b.official_role));

  // Summary counts always cover every bucket, independent of the active tab.
  const counts = {
    total: allRows.length,
    admin: allRows.filter((o) => o.official_role === 'admin').length,
    staff: allRows.filter((o) => o.official_role !== 'admin').length,
  };

  let rows = allRows;
  if (tab === 'admin') rows = rows.filter((o) => o.official_role === 'admin');
  if (tab === 'staff') rows = rows.filter((o) => o.official_role !== 'admin');

  if (filterRole) {
    rows = rows.filter((o) => o.official_role === filterRole);
  }

  if (q && q.trim().length > 0) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter(
      (o) =>
        o.profile.full_name.toLowerCase().includes(needle) ||
        (o.profile.email ?? '').toLowerCase().includes(needle) ||
        (o.profile.mobile_number ?? '').toLowerCase().includes(needle) ||
        (o.profile.home_address ?? '').toLowerCase().includes(needle) ||
        o.official_role.toLowerCase().includes(needle),
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Section 1: header + description */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Staff & Admin Accounts</h1>
        <p className="text-sm text-zinc-500">Invite and manage barangay staff and administrator accounts.</p>
      </div>

      {/* Section 2: analytics summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Total Employees" value={counts.total} />
        <StatCard label="Admins" value={counts.admin} />
        <StatCard label="Staff" value={counts.staff} sub="non-admin roles" />
      </div>

      {/* Sections 3–5 (sort/filter/search, segmented tabs, add button) live in
          StaffTable so all row controls share one client-side layout, followed by
          Section 6, the table (resizable columns). */}
      <StaffTable
        rows={rows}
        currentUserId={user!.id}
        barangayId={profile?.barangay_id ?? ''}
        tab={tab}
        role={filterRole ?? ''}
        q={q ?? ''}
      />

      <p className="mt-3 text-xs text-zinc-400">
        {rows.length} account{rows.length !== 1 ? 's' : ''} shown
        {tab !== 'all' ? ` · "${tab}"` : ''}
        {filterRole ? ` · role filtered` : ''}
        {q ? ` · search "${q}"` : ''}.
      </p>
    </div>
  );
}
