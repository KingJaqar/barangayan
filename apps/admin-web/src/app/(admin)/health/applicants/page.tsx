import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ApplicantsTable } from './applicants-table';
import { TABS, type Tab } from './types';

export type ApplicantRow = {
  id: string;
  drive_id: string;
  user_id: string;
  applicant_number: string;
  age: number;
  is_pwd: boolean;
  comorbidities: string[];
  prior_dose_date: string | null;
  priority_score: number;
  status: 'pending' | 'confirmed' | 'attended' | 'cancelled';
  created_at: string;
  updated_at: string;
  medical_drives: { id: string; title: string; type: string; drive_date: string; location: string } | null;
  profiles: { full_name: string } | null;
};

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

export default async function MedicalApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; q?: string }>;
}) {
  const { tab: tabParam, type: filterType, q } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'all';

  const supabase = await createSupabaseServerClient();

  const { data: registrations, error: regError } = await supabase
    .from('drive_registrations')
    .select(`*, medical_drives ( id, title, type, drive_date, location )`)
    .order('created_at', { ascending: false });

  const userIds = [...new Set((registrations ?? []).map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] as { id: string; full_name: string }[] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const allRows = (registrations ?? []).map((r) => ({
    ...r,
    profiles: profileMap.get(r.user_id) ?? null,
  })) as unknown as ApplicantRow[];

  const counts = {
    total: allRows.length,
    pending: allRows.filter((r) => r.status === 'pending').length,
    confirmed: allRows.filter((r) => r.status === 'confirmed').length,
    attended: allRows.filter((r) => r.status === 'attended').length,
    cancelled: allRows.filter((r) => r.status === 'cancelled').length,
    pwd: allRows.filter((r) => r.is_pwd).length,
  };

  let rows = tab === 'all' ? allRows : allRows.filter((r) => r.status === tab);

  if (filterType) {
    rows = rows.filter((r) => r.medical_drives?.type === filterType);
  }

  if (q && q.trim().length > 0) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.applicant_number.toLowerCase().includes(needle) ||
        (r.medical_drives?.title ?? '').toLowerCase().includes(needle) ||
        (r.comorbidities ?? []).join(', ').toLowerCase().includes(needle),
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Section 1: header + description */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Medical Applicants</h1>
        <p className="text-sm text-zinc-500">Review and manage resident registrations for medical drives.</p>
      </div>

      {/* Section 2: analytics summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={counts.total} sub="all registrations" />
        <StatCard label="Pending" value={counts.pending} />
        <StatCard label="Confirmed" value={counts.confirmed} />
        <StatCard label="Attended" value={counts.attended} />
        <StatCard label="Cancelled" value={counts.cancelled} />
        <StatCard label="PWD" value={counts.pwd} sub="applicants" />
      </div>

      {regError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Could not load applicants.</p>
          <p className="mt-1 text-xs opacity-80">{regError.message}</p>
        </div>
      ) : (
        // Sections 3–5 (sort/filter/search, segmented tabs, add button) live in
        // ApplicantsTable so all row controls share one client-side layout, followed
        // by Section 6, the table (resizable columns).
        <ApplicantsTable rows={rows} tab={tab} type={filterType ?? ''} q={q ?? ''} />
      )}

      <p className="mt-3 text-xs text-zinc-400">
        {rows.length} registration{rows.length !== 1 ? 's' : ''} shown
        {tab !== 'all' ? ` · "${tab}"` : ''}
        {filterType ? ` · category filtered` : ''}
        {q ? ` · search "${q}"` : ''}.
      </p>
    </div>
  );
}
