import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ResidentDirectory } from './resident-directory';

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
};

type Tab = 'all' | 'verified' | 'unverified';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all',        label: 'All'        },
  { key: 'verified',   label: 'Verified'   },
  { key: 'unverified', label: 'Unverified' },
];

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

  const tab: Tab = (['all', 'verified', 'unverified'] as Tab[]).includes(tabParam as Tab)
    ? (tabParam as Tab)
    : 'all';

  const supabase = await createSupabaseServerClient();

  const { data: residents, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, avatar_url, email, mobile_number, home_address, birth_date, ' +
      'email_verification_status, household_members, id_photo_urls, id_type, ' +
      'id_verification_status, created_at',
    )
    .eq('role', 'resident')
    .is('deleted_at', null)
    .order('full_name');

  const allRows = (residents ?? []) as unknown as ResidentRow[];

  // ── Stats ──────────────────────────────────────────────────────────────────
  const counts = {
    total:           allRows.length,
    verified:        allRows.filter((r) => r.email_verification_status === 'verified').length,
    unverified:      allRows.filter((r) => r.email_verification_status !== 'verified').length,
    withId:          allRows.filter((r) => r.id_photo_urls?.length > 0).length,
    withoutId:       allRows.filter((r) => !r.id_photo_urls?.length).length,
    idPending:       allRows.filter((r) => r.id_verification_status === 'pending').length,
    idVerified:      allRows.filter((r) => r.id_verification_status === 'verified').length,
    householdMembers: allRows.reduce((sum, r) => sum + (r.household_members?.length ?? 0), 0),
  };

  // ── Tab filter ─────────────────────────────────────────────────────────────
  let rows = allRows;
  if (tab === 'verified')   rows = rows.filter((r) => r.email_verification_status === 'verified');
  if (tab === 'unverified') rows = rows.filter((r) => r.email_verification_status !== 'verified');

  // ── Verification filter ────────────────────────────────────────────────────
  if (verification === 'with_id')    rows = rows.filter((r) =>  r.id_photo_urls?.length > 0);
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Resident Directory</h1>
        <p className="text-sm text-zinc-500">Registered residents in your barangay — CRUD, ID verification, and household info.</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="Total"            value={counts.total}            sub="residents"      />
        <StatCard label="Email Verified"   value={counts.verified}         sub="confirmed"      />
        <StatCard label="Unverified"       value={counts.unverified}       sub="email"          />
        <StatCard label="With ID"          value={counts.withId}           sub="uploaded"       />
        <StatCard label="Without ID"       value={counts.withoutId}                             />
        <StatCard label="ID Pending"       value={counts.idPending}        sub="needs review"   />
        <StatCard label="ID Verified"      value={counts.idVerified}       sub="admin confirmed"/>
        <StatCard label="Household"        value={counts.householdMembers} sub="total members"  />
      </div>

      {/* Tabs + controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Pill tabs */}
        <div className="flex flex-wrap gap-1 rounded-full bg-zinc-200 p-1 dark:bg-zinc-800">
          {TABS.map((t) => (
            <a
              key={t.key}
              href={`/residents?tab=${t.key}${verification ? `&verification=${verification}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-white shadow dark:bg-zinc-700'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white'
              }`}>
              {t.label}
            </a>
          ))}
        </div>

        {/* Filter + search form */}
        <form action="/residents" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tab" value={tab} />

          <select
            name="verification"
            defaultValue={verification ?? ''}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800">
            <option value="">All ID status</option>
            <option value="with_id">With uploaded ID</option>
            <option value="without_id">Without uploaded ID</option>
          </select>

          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, email, mobile, ID type…"
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800 sm:min-w-[260px]"
          />

          <button
            type="submit"
            className="rounded-full bg-[#0F6E5B] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#0d5e4e]">
            Search
          </button>
        </form>
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Could not load residents.</p>
          <p className="mt-1 text-xs opacity-80">{error.message}</p>
        </div>
      ) : (
        <ResidentDirectory residents={rows} initialQuery={q ?? ''} />
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
