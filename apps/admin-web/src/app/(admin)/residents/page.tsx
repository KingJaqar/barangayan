import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ResidentDirectory } from './resident-directory';
import { TABS, type Tab } from './types';

/**
 * Admin Resident Directory page — refactored to match the Medical Applicants
 * page pattern: stats bar, pill tabs (All / Verified / Unverified), search +
 * filter controls, CRUD data table, and a resident detail modal.
 *
 * New profile columns (migration 0039):
 *   email, household_members (jsonb), id_photo_urls (text[]), id_type (text)
 */

export type ResidentRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
  mobile_number: string | null;
  home_address: string | null;
  birth_date: string | null;
  email_verification_status: string;
  household_members: Array<{ id: string; name: string; relation: string; role: string }>;
  id_photo_urls: string[];
  id_type: string | null;
  id_verification_status: 'pending' | 'verified' | null;
  created_at: string;
  /** Point-in-polygon geofencing result at signup (migration 0075). NULL = check
   *  couldn't run (no boundary/permission denied); FALSE = device location was
   *  outside the barangay boundary — soft flag only, never blocked registration. */
  location_verified: boolean | null;
};

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-black/10 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; verification?: string }>;
}) {
  const { tab: tabParam, q, verification } = await searchParams;

  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'all';

  const supabase = await createSupabaseServerClient();

  const { data: residents, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, avatar_url, email, mobile_number, home_address, birth_date, ' +
        'email_verification_status, household_members, id_photo_urls, id_type, ' +
        'id_verification_status, created_at, location_verified',
    )
    .eq('role', 'resident')
    .is('deleted_at', null)
    .order('full_name');

  const allRows = (residents ?? []) as unknown as ResidentRow[];

  // ── Stats — always over the full unfiltered set, so the numbers stay put
  // regardless of the active tab/filter/search. ─────────────────────────────
  const counts = {
    total: allRows.length,
    verified: allRows.filter((r) => r.email_verification_status === 'verified').length,
    unverified: allRows.filter((r) => r.email_verification_status !== 'verified').length,
    withId: allRows.filter((r) => r.id_photo_urls?.length > 0).length,
    withoutId: allRows.filter((r) => !r.id_photo_urls?.length).length,
    idPending: allRows.filter((r) => r.id_verification_status === 'pending').length,
    idVerified: allRows.filter((r) => r.id_verification_status === 'verified').length,
    householdMembers: allRows.reduce((sum, r) => sum + (r.household_members?.length ?? 0), 0),
  };

  // ── Tab filter ─────────────────────────────────────────────────────────────
  let rows = allRows;
  if (tab === 'verified') rows = rows.filter((r) => r.email_verification_status === 'verified');
  if (tab === 'unverified') rows = rows.filter((r) => r.email_verification_status !== 'verified');

  // ── ID-status dropdown filter ──────────────────────────────────────────────
  if (verification === 'with_id') rows = rows.filter((r) => r.id_photo_urls?.length > 0);
  if (verification === 'without_id') rows = rows.filter((r) => !r.id_photo_urls?.length);

  // ── Search ─────────────────────────────────────────────────────────────────
  if (q && q.trim().length > 0) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(needle) ||
        (r.email ?? '').toLowerCase().includes(needle) ||
        (r.mobile_number ?? '').toLowerCase().includes(needle) ||
        (r.home_address ?? '').toLowerCase().includes(needle) ||
        (r.id_type ?? '').toLowerCase().includes(needle),
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Section 1: header + description */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Resident Directory</h1>
        <p className="text-sm text-zinc-500">Registered residents in your barangay — CRUD, ID verification, and household info.</p>
      </div>

      {/* Section 2: analytics summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="Total" value={counts.total} sub="residents" />
        <StatCard label="Email Verified" value={counts.verified} sub="confirmed" />
        <StatCard label="Unverified" value={counts.unverified} sub="email" />
        <StatCard label="With ID" value={counts.withId} sub="uploaded" />
        <StatCard label="Without ID" value={counts.withoutId} />
        <StatCard label="ID Pending" value={counts.idPending} sub="needs review" />
        <StatCard label="ID Verified" value={counts.idVerified} sub="admin confirmed" />
        <StatCard label="Household" value={counts.householdMembers} sub="total members" />
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Could not load residents.</p>
          <p className="mt-1 text-xs opacity-80">{error.message}</p>
        </div>
      ) : (
        // Sections 3–5 (sort/filter/search, segmented tabs, add button) live in
        // ResidentDirectory so all row controls share one client-side layout,
        // followed by Section 6, the table.
        <ResidentDirectory residents={rows} tab={tab} q={q ?? ''} verification={verification ?? ''} />
      )}

      {/* Footer count */}
      <p className="mt-3 text-xs text-zinc-400">
        {rows.length} resident{rows.length !== 1 ? 's' : ''} shown
        {tab !== 'all' ? ` · "${tab}"` : ''}
        {verification ? ` · ${verification.replace('_', ' ')}` : ''}
        {q ? ` · search "${q}"` : ''}.
      </p>
    </div>
  );
}
