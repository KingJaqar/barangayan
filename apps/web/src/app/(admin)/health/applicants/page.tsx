import Link from 'next/link';
import { DRIVE_TYPE_CONFIG, DRIVE_TYPES } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ApplicantsTable } from './applicants-table';

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

type Tab = 'all' | 'pending' | 'confirmed' | 'attended' | 'cancelled';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'attended', label: 'Attended' },
  { key: 'cancelled', label: 'Cancelled' },
];

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
  searchParams: Promise<{ tab?: string; status?: string; type?: string; q?: string }>;
}) {
  const { tab: tabParam, status: filterStatus, type: filterType, q } = await searchParams;
  const tab: Tab = (['all', 'pending', 'confirmed', 'attended', 'cancelled'] as Tab[]).includes(tabParam as Tab)
    ? (tabParam as Tab)
    : 'all';

  const supabase = await createSupabaseServerClient();

  const { data: registrations, error: regError } = await supabase
    .from('drive_registrations')
    .select(`*, medical_drives ( id, title, type, drive_date, location )`)
    .order('created_at', { ascending: false });

  const userIds = [...new Set((registrations ?? []).map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
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

  if (filterStatus) {
    rows = rows.filter((r) => r.status === filterStatus);
  }

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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Medical Applicants</h1>
        <p className="text-sm text-zinc-500">Review and manage resident registrations for medical drives.</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={counts.total} sub="all registrations" />
        <StatCard label="Pending" value={counts.pending} />
        <StatCard label="Confirmed" value={counts.confirmed} />
        <StatCard label="Attended" value={counts.attended} />
        <StatCard label="Cancelled" value={counts.cancelled} />
        <StatCard label="PWD" value={counts.pwd} sub="applicants" />
      </div>

      {/* Pill tabs + filter/search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-full bg-zinc-200 p-1 dark:bg-zinc-800">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/health/applicants?tab=${t.key}${filterType ? `&type=${filterType}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                tab === t.key ? 'bg-white shadow dark:bg-zinc-700' : 'text-zinc-600 dark:text-zinc-300'
              }`}>
              {t.label}
            </Link>
          ))}
        </div>

        <form action="/health/applicants" className="flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <select
            name="status"
            defaultValue={filterStatus ?? ''}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="attended">Attended</option>
            <option value="cancelled">Cancelled</option>
          </select>
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
            placeholder="Search applicant #, drive, comorbidities…"
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button type="submit" className="rounded-full bg-[#0F6E5B] px-4 py-1.5 text-sm font-semibold text-white">
            Search
          </button>
        </form>
      </div>

      {regError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Could not load applicants.</p>
          <p className="mt-1 text-xs opacity-80">{regError.message}</p>
        </div>
      ) : (
        <ApplicantsTable rows={rows} />
      )}

      <p className="mt-3 text-xs text-zinc-400">
        {rows.length} registration{rows.length !== 1 ? 's' : ''} shown
        {tab !== 'all' ? ` · "${tab}"` : ''}
        {filterStatus ? ` · status filtered` : ''}
        {filterType ? ` · category filtered` : ''}
        {q ? ` · search "${q}"` : ''}.
      </p>
    </div>
  );
}
