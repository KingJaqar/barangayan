import Link from 'next/link';
import { Plus } from 'lucide-react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { StatusPill } from '@/components/admin/status-pill';
import { formatDateTime } from '@barangayan/shared';

export default async function ResidentReportsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reports } = await supabase
    .from('incidents')
    .select('id, title, status, created_at, confirmation_count, incident_categories(name, color)')
    .eq('reporter_id', user!.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Reports</h1>
          <p className="text-sm text-zinc-500">Incidents and hazards you've reported to the barangay.</p>
        </div>
        <Link
          href="/resident/reports/new"
          className="flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
          <Plus size={16} /> Report Incident
        </Link>
      </div>

      {reports && reports.length > 0 ? (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{r.title}</p>
                  {r.incident_categories && (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: (r.incident_categories.color ?? '#6B7280') + '20', color: r.incident_categories.color ?? '#6B7280' }}>
                      {r.incident_categories.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  {formatDateTime(r.created_at)} · {r.confirmation_count} confirmation{r.confirmation_count !== 1 ? 's' : ''}
                </p>
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">You haven't reported any incidents yet.</p>
          <Link href="/resident/reports/new" className="mt-3 inline-block text-sm font-semibold text-[var(--accent)] hover:underline">
            Report your first incident
          </Link>
        </div>
      )}
    </div>
  );
}
