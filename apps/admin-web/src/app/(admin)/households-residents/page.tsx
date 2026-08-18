import { createSupabaseServerClient } from '@/lib/supabase/server';

import { HouseholdsTable } from './households-table';
import { TABS, type Tab } from './types';

export type HouseholdMemberRow = {
  id: string;
  profile_id: string;
  name: string;
  relation: string;
  role: string;
  is_checked_in: boolean;
  checked_in_at: string | null;
  checked_in_center_name: string | null;
  created_at: string;
  profiles: { full_name: string; email: string | null; mobile_number: string | null; home_address: string | null } | null;
};

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-black/10 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

export default async function HouseholdsResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; relation?: string; q?: string }>;
}) {
  const { tab: tabParam, relation: filterRelation, q } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'all';

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl">
        <p className="text-sm text-red-600">Not signed in.</p>
      </div>
    );
  }

  const { data: profile } = await supabase.from('profiles').select('barangay_id, role').eq('id', user.id).single();

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="mx-auto max-w-6xl">
        <p className="text-sm text-red-600">Admin access required.</p>
      </div>
    );
  }

  const { data: members, error: membersError } = await supabase
    .from('household_members')
    .select('*, profiles:profile_id ( id, full_name, email, mobile_number, home_address )')
    .order('created_at', { ascending: false });

  const allRows = (members ?? []) as unknown as HouseholdMemberRow[];

  const counts = {
    total: allRows.length,
    checked_in: allRows.filter((r) => r.is_checked_in).length,
    not_checked_in: allRows.filter((r) => !r.is_checked_in).length,
    spouse: allRows.filter((r) => r.relation === 'spouse').length,
    child: allRows.filter((r) => r.relation === 'child').length,
    parent: allRows.filter((r) => r.relation === 'parent').length,
    other: allRows.filter((r) => !['spouse', 'child', 'parent'].includes(r.relation)).length,
  };

  let rows = allRows;
  if (tab === 'checked_in') rows = rows.filter((r) => r.is_checked_in);
  if (tab === 'not_checked_in') rows = rows.filter((r) => !r.is_checked_in);

  if (filterRelation) {
    rows = rows.filter((r) => r.relation === filterRelation);
  }

  if (q && q.trim().length > 0) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        (r.profiles?.full_name ?? '').toLowerCase().includes(needle) ||
        r.relation.toLowerCase().includes(needle) ||
        r.role.toLowerCase().includes(needle),
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Section 1: header + description */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Households & Residents</h1>
        <p className="text-sm text-zinc-500">Manage household members and evacuation check-in status.</p>
      </div>

      {/* Section 2: analytics summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Members" value={counts.total} sub="all records" />
        <StatCard label="Checked In" value={counts.checked_in} sub="at center" />
        <StatCard label="Not Checked In" value={counts.not_checked_in} />
        <StatCard label="Spouse" value={counts.spouse} sub="relation" />
        <StatCard label="Child" value={counts.child} sub="relation" />
        <StatCard label="Parent / Other" value={counts.other} sub="relation" />
      </div>

      {membersError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Could not load household members.</p>
          <p className="mt-1 text-xs opacity-80">{membersError.message}</p>
        </div>
      ) : (
        // Sections 3–5 (sort/filter/search, segmented tabs, add button) live in
        // HouseholdsTable so all row controls share one client-side layout, followed
        // by Section 6, the table (resizable columns).
        <HouseholdsTable rows={rows} barangayId={profile.barangay_id} tab={tab} relation={filterRelation ?? ''} q={q ?? ''} />
      )}

      <p className="mt-3 text-xs text-zinc-400">
        {rows.length} member{rows.length !== 1 ? 's' : ''} shown
        {tab !== 'all' ? ` · "${tab}"` : ''}
        {filterRelation ? ` · ${filterRelation}` : ''}
        {q ? ` · search "${q}"` : ''}.
      </p>
    </div>
  );
}
