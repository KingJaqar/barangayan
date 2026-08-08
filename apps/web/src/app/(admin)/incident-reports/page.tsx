import Link from 'next/link';
import type { Tables } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { IncidentTable } from './incident-table';

export type IncidentRow = Tables<'incidents'> & {
  incident_categories: Pick<Tables<'incident_categories'>, 'name' | 'color' | 'icon'> | null;
  profiles: Pick<Tables<'profiles'>, 'full_name' | 'mobile_number' | 'home_address'> | null;
};

type Tab = 'open' | 'in_progress' | 'resolved' | 'withdrawn' | 'unresolved' | 'all';

// Same segmented-workflow architecture as the Requests screen (apps/web/src/app/(admin)/requests/page.tsx):
// a pill tab bar over a single status column, plus an "All" catch-all. Five stages per the
// Incident Reports spec — Open, In Progress, Resolved, Withdrawn (resident-cancelled),
// Unresolved (admin-cancelled) — mirroring the five values incidents.status now allows (0026).
const TABS: { key: Tab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'withdrawn', label: 'Withdrawn' },
  { key: 'unresolved', label: 'Unresolved' },
  { key: 'all', label: 'All' },
];

function matchesTab(incident: IncidentRow, tab: Tab): boolean {
  if (tab === 'all') return true;
  return incident.status === tab;
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

export default async function IncidentReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; category?: string; q?: string }>;
}) {
  const { tab: tabParam, category: filterCategory, q } = await searchParams;
  const tab: Tab = (['open', 'in_progress', 'resolved', 'withdrawn', 'unresolved', 'all'] as Tab[]).includes(
    tabParam as Tab,
  )
    ? (tabParam as Tab)
    : 'open';

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

  // Fetch all incidents for the admin's barangay (RLS scopes by barangay_id), with
  // reporter contact fields so the detail modal can show a "Call" link.
  //
  // `profiles` MUST be disambiguated with !incidents_reporter_id_fkey. The
  // incident_confirmations junction table (migration 0025) creates a second,
  // many-to-many path between incidents and profiles, so a bare `profiles(...)`
  // embed fails with PGRST201 "more than one relationship was found" and returns
  // zero rows.
  let query = supabase
    .from('incidents')
    .select(
      '*, incident_categories(name, color, icon), profiles!incidents_reporter_id_fkey(full_name, mobile_number, home_address)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (filterCategory) {
    query = query.eq('category_id', filterCategory);
  }

  const { data: incidents, error: incidentsError } = await query;

  // Summary counts always cover every status, independent of the active tab.
  const { data: allIncidents } = await supabase.from('incidents').select('status').is('deleted_at', null);

  const counts = ((allIncidents ?? []) as { status: string }[]).reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const totalCount = (allIncidents ?? []).length;

  // Categories for the filter dropdown and the Category edit column — scoped to the
  // admin's own barangay by RLS.
  const { data: categories } = await supabase
    .from('incident_categories')
    .select('id, name, color')
    .order('name');

  // Residents for the Reporter edit column and the Add Incident form.
  const { data: residents } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'resident')
    .is('deleted_at', null)
    .order('full_name');

  let rows = ((incidents ?? []) as IncidentRow[]).filter((r) => matchesTab(r, tab));

  // Free-text search over title, description, category name, and reporter name —
  // filtered client-side after fetch, mirroring the same pattern as the Requests page.
  if (q && q.trim().length > 0) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        (r.description ?? '').toLowerCase().includes(needle) ||
        (r.incident_categories?.name ?? '').toLowerCase().includes(needle) ||
        (r.profiles?.full_name ?? '').toLowerCase().includes(needle),
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Incident Reports</h1>
        <p className="text-sm text-zinc-500">Review, triage, and resolve community-submitted incident reports.</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={totalCount} sub="across all statuses" />
        <StatCard label="Open" value={counts['open'] ?? 0} />
        <StatCard label="In Progress" value={counts['in_progress'] ?? 0} />
        <StatCard label="Resolved" value={counts['resolved'] ?? 0} />
        <StatCard label="Withdrawn" value={counts['withdrawn'] ?? 0} />
        <StatCard label="Unresolved" value={counts['unresolved'] ?? 0} />
      </div>

      {/* Segmented workflow tabs + category filter + search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-full bg-zinc-200 p-1 dark:bg-zinc-800">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/incident-reports?tab=${t.key}${filterCategory ? `&category=${filterCategory}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                tab === t.key ? 'bg-white shadow dark:bg-zinc-700' : 'text-zinc-600 dark:text-zinc-300'
              }`}>
              {t.label}
            </Link>
          ))}
        </div>

        <form action="/incident-reports" className="flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <select
            name="category"
            defaultValue={filterCategory ?? ''}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800">
            <option value="">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search title, description, reporter…"
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="submit"
            className="rounded-full bg-[#0F6E5B] px-4 py-1.5 text-sm font-semibold text-white">
            Search
          </button>
        </form>
      </div>

      {/* Surface query failures rather than rendering a misleading empty table —
          a broken embed previously showed "No incident reports found" silently. */}
      {incidentsError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Could not load incident reports.</p>
          <p className="mt-1 text-xs opacity-80">{incidentsError.message}</p>
        </div>
      ) : (
        /* Table (client component — full CRUD: inline-editable cells, detail modal,
           status workflow buttons, add form). */
        <IncidentTable
          rows={rows}
          categories={categories ?? []}
          residents={residents ?? []}
          barangayId={profile?.barangay_id ?? ''}
        />
      )}

      <p className="mt-3 text-xs text-zinc-400">
        {rows.length} incident{rows.length !== 1 ? 's' : ''} shown
        {tab !== 'all' ? ` · status "${tab.replace('_', ' ')}"` : ''}
        {filterCategory ? ` · category filtered` : ''}
        {q ? ` · search "${q}"` : ''}. Click any row for full details, or click a cell to edit it in place.
      </p>
    </div>
  );
}
