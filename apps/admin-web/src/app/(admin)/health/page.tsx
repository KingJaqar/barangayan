import { DRIVE_TYPE_CONFIG, type Tables } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { DriveTable } from './drive-table';
import { TABS, type Tab } from './types';

export type DriveRow = Tables<'medical_drives'> & { registration_count: number };

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

export default async function HealthPage({ searchParams }: { searchParams: Promise<{ tab?: string; type?: string; q?: string }> }) {
  const { tab: tabParam, type: filterType, q } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'upcoming';
  const today = todayISO();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

  // Fetch every drive in the admin's barangay (RLS scopes by barangay_id via the
  // 0036 "admins read all medical drives" policy — includes inactive/soft-deleted rows
  // so the table can surface and manage them, unlike the public read policy).
  const { data: drives, error: drivesError } = await supabase
    .from('medical_drives')
    .select('*')
    .is('deleted_at', null)
    .order('drive_date', { ascending: true });

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

  if (filterType) {
    rows = rows.filter((r) => r.type === filterType);
  }

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
      {/* Section 1: header + description */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Health</h1>
        <p className="text-sm text-zinc-500">Manage vaccination, medical, and wellness drives for the barangay.</p>
      </div>

      {/* Section 2: analytics summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={counts.total} sub="across all drives" />
        <StatCard label="Upcoming" value={counts.upcoming} />
        <StatCard label="Today" value={counts.today} />
        <StatCard label="Past" value={counts.past} />
        <StatCard label="Inactive" value={counts.inactive} />
        <StatCard label="Registrations" value={counts.registrations} sub="all drives" />
      </div>

      {/* Surface query failures rather than rendering a misleading empty table. */}
      {drivesError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Could not load medical drives.</p>
          <p className="mt-1 text-xs opacity-80">{drivesError.message}</p>
        </div>
      ) : (
        // Sections 3–5 (sort/filter/search, segmented tabs, add button) live in
        // DriveTable so all row controls share one client-side layout, followed by
        // Section 6, the table (client component — full CRUD: inline-editable cells,
        // detail modal, add form, activate/remove actions).
        <DriveTable rows={rows} barangayId={profile?.barangay_id ?? ''} tab={tab} type={filterType ?? ''} q={q ?? ''} />
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
