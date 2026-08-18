import Link from 'next/link';
import { Plus } from 'lucide-react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { StatusPill } from '@/components/admin/status-pill';
import { formatDateTime, getSlaFlag } from '@barangayan/shared';

const OPEN_STATUSES = ['submitted', 'in_progress', 'out_for_delivery'];

export default async function ResidentRequestsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: requests } = await supabase
    .from('service_requests')
    .select('id, reference_number, status, payment_status, created_at, document_types(name, fee_centavos, processing_target_hours)')
    .eq('resident_id', user!.id)
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Requests</h1>
          <p className="text-sm text-zinc-500">Every document request you&apos;ve submitted, and its current status.</p>
        </div>
        <Link
          href="/resident/requests/new"
          className="flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
          <Plus size={16} /> New Request
        </Link>
      </div>

      {requests && requests.length > 0 ? (
        <div className="flex flex-col gap-3">
          {requests.map((r) => {
            const flag = OPEN_STATUSES.includes(r.status)
              ? getSlaFlag(r.created_at, r.document_types?.processing_target_hours ?? 24)
              : 'on_track';
            return (
              <Link
                key={r.id}
                href={`/resident/requests/${r.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-[var(--accent)]/40 dark:border-white/10 dark:bg-zinc-900">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.document_types?.name ?? 'Document Request'}</p>
                  <p className="text-xs text-zinc-400">{r.reference_number} · Submitted {formatDateTime(r.created_at)}</p>
                  {flag !== 'on_track' && (
                    <p className={`mt-0.5 text-xs font-medium ${flag === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {flag === 'overdue' ? 'Taking longer than usual' : 'Nearing expected completion time'}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill status={r.payment_status} />
                  <StatusPill status={r.status} />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">You haven&apos;t submitted any requests yet.</p>
          <Link href="/resident/requests/new" className="mt-3 inline-block text-sm font-semibold text-[var(--accent)] hover:underline">
            Request your first document
          </Link>
        </div>
      )}
    </div>
  );
}
