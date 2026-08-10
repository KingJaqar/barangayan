import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { HouseholdsTable } from './households-table';

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

type Tab = 'all' | 'checked_in' | 'not_checked_in';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'checked_in', label: 'Checked In' },
  { key: 'not_checked_in', label: 'Not Checked In' },
];

const RELATION_OPTIONS = [
  'spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other',
];

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
  const tab: Tab = (['all', 'checked_in', 'not_checked_in'] as Tab[]).includes(tabParam as Tab)
    ? (tabParam as Tab)
    : 'all';

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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Households & Residents</h1>
        <p className="text-sm text-zinc-500">Manage household members and evacuation check-in status.</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Members" value={counts.total} sub="all records" />
        <StatCard label="Checked In" value={counts.checked_in} sub="at center" />
        <StatCard label="Not Checked In" value={counts.not_checked_in} />
        <StatCard label="Spouse" value={counts.spouse} sub="relation" />
        <StatCard label="Child" value={counts.child} sub="relation" />
        <StatCard label="Parent / Other" value={counts.other} sub="relation" />
      </div>

      {/* Pill tabs + filter/search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-full bg-zinc-200 p-1 dark:bg-zinc-800">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/households-residents?tab=${t.key}${filterRelation ? `&relation=${filterRelation}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                tab === t.key ? 'bg-white shadow dark:bg-zinc-700' : 'text-zinc-600 dark:text-zinc-300'
              }`}>
              {t.label}
            </Link>
          ))}
        </div>

        <form action="/households-residents" className="flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <select
            name="relation"
            defaultValue={filterRelation ?? ''}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800">
            <option value="">All relations</option>
            {RELATION_OPTIONS.map((rel) => (
              <option key={rel} value={rel}>
                {rel.charAt(0).toUpperCase() + rel.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, resident, relation…"
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button type="submit" className="rounded-full bg-[#0F6E5B] px-4 py-1.5 text-sm font-semibold text-white">
            Search
          </button>
        </form>
      </div>

      {membersError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Could not load household members.</p>
          <p className="mt-1 text-xs opacity-80">{membersError.message}</p>
        </div>
      ) : (
        <HouseholdsTable rows={rows} barangayId={profile.barangay_id} />
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
