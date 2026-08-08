import Link from 'next/link';
import { DRIVE_TYPE_CONFIG, DRIVE_TYPES, type Tables } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { DriveTable } from './drive-table';

export type DriveRow = Tables<'medical_drives'> & { registration_count: number };

type Tab = 'upcoming' | 'today' | 'past' | 'inactive' | 'all';

// Same segmented-workflow architecture as the Incident Reports screen
// (apps/web/src/app/(admin)/incident-reports/page.tsx): a pill tab bar over a computed
// bucket, plus an "All" catch-all. Medical drives don't have a `status` column like
// incidents — the workflow here is date-driven (Upcoming/Today/Past) plus the
// `is_active` toggle (Inactive), so the tabs are derived rather than a literal column.
const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Today' },
  { key: 'past', label: 'Past' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'all', label: 'All' },
];

function todayISO(): string {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function matchesTab(drive: DriveRow, tab: Tab, today: string): boolean {
  if (tab === 'all') return true;
  if (tab === 'inactive') return !drive.is_active;
  if (!drive.is_active) return false;
  if (tab === 'today') return drive.drive_date === today;
  if (tab === 'upcoming') return drive.drive_date >= today;
  return drive.drive_date < today; // past
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-black/10 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; q?: string }>;
}) {
  const { tab: tabParam, type: filterType, q } = await searchParams;
  const tab: Tab = (['upcoming', 'today', 'past', 'inactive', 'all'] as Tab[]).includes(tabParam as Tab)
    ? (tabParam as Tab)
    : 'upcoming';
  const today = todayISO();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

  // Fetch every drive in the admin's barangay (RLS scopes by barangay_id via the
  // 0036 "admins read all medical drives" policy — includes inactive/soft-deleted rows
  // so the table can surface and manage them, unlike the public read policy).
  let query = supabase.from('medical_drives').select('*').is('deleted_at', null).order('drive_date', { ascending: true });

  if (filterType) {
    query = query.eq('type', filterType);
  }

  const { data: drives, error: drivesError } = await query;

  // Registration counts per drive — a single query, reduced client-side, mirroring how
  // Incident Reports computes its stats bar in one pass rather than N+1 queries.
  const { data: registrations } = await supabase.from('drive_registrations').select('drive_id');
  const regCounts = ((registrations ?? []) as { drive_id: string }[]).reduce(
    (acc, r) => {
      acc[r.drive_id] = (acc[r.drive_id] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const allRows: DriveRow[] = ((drives ?? []) as Tables<'medical_drives'>[]).map((d) => ({
    ...d,
    registration_count: regCounts[d.id] ?? 0,
  }));

  // Summary counts always cover every bucket, independent of the active tab.
  const counts = {
    total: allRows.length,
    upcoming: allRows.filter((d) => matchesTab(d, 'upcoming', today)).length,
    today: allRows.filter((d) => matchesTab(d, 'today', today)).length,
    past: allRows.filter((d) => matchesTab(d, 'past', today)).length,
    inactive: allRows.filter((d) => matchesTab(d, 'inactive', today)).length,
    registrations: (registrations ?? []).length,
  };

  let rows = allRows.filter((r) => matchesTab(r, tab, today));

  // Free-text search over title, location, eligibility criteria, and category label —
  // filtered client-side after fetch, mirroring Incident Reports' search pattern (which
  // also matches its category name so typing e.g. "dental" finds the Dental Care drives
  // even when that word doesn't appear in the title/location/criteria text itself).
  if (q && q.trim().length > 0) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.location.toLowerCase().includes(needle) ||
        r.eligible_criteria.toLowerCase().includes(needle) ||
        (DRIVE_TYPE_CONFIG[r.type as keyof typeof DRIVE_TYPE_CONFIG]?.label ?? '').toLowerCase().includes(needle),
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Health</h1>
        <p className="text-sm text-zinc-500">Manage vaccination, medical, and wellness drives for the barangay.</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={counts.total} sub="across all drives" />
        <StatCard label="Upcoming" value={counts.upcoming} />
        <StatCard label="Today" value={counts.today} />
        <StatCard label="Past" value={counts.past} />
        <StatCard label="Inactive" value={counts.inactive} />
        <StatCard label="Registrations" value={counts.registrations} sub="all drives" />
      </div>

      {/* Segmented workflow tabs + type filter + search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-full bg-zinc-200 p-1 dark:bg-zinc-800">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/health?tab=${t.key}${filterType ? `&type=${filterType}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                tab === t.key ? 'bg-white shadow dark:bg-zinc-700' : 'text-zinc-600 dark:text-zinc-300'
              }`}>
              {t.label}
            </Link>
          ))}
        </div>

        <form action="/health" className="flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <select
            name="type"
            defaultValue={filterType ?? ''}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800">
            <option value="">All categories</option>
            {DRIVE_TYPES.map((type) => (
              <option key={type} value={type}>
                {DRIVE_TYPE_CONFIG[type].label}
              </option>
            ))}
          </select>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search title, location, eligibility…"
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button type="submit" className="rounded-full bg-[#0F6E5B] px-4 py-1.5 text-sm font-semibold text-white">
            Search
          </button>
        </form>
      </div>

      {/* Surface query failures rather than rendering a misleading empty table. */}
      {drivesError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Could not load medical drives.</p>
          <p className="mt-1 text-xs opacity-80">{drivesError.message}</p>
        </div>
      ) : (
        /* Table (client component — full CRUD: inline-editable cells, detail modal,
           add form, activate/remove actions). */
        <DriveTable rows={rows} barangayId={profile?.barangay_id ?? ''} />
      )}

      <p className="mt-3 text-xs text-zinc-400">
        {rows.length} drive{rows.length !== 1 ? 's' : ''} shown
        {tab !== 'all' ? ` · "${tab}"` : ''}
        {filterType ? ` · category filtered` : ''}
        {q ? ` · search "${q}"` : ''}. Click any row for full details, or click a cell to edit it in place.
      </p>
    </div>
  );
}
