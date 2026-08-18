import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { StatusPill } from '@/components/admin/status-pill';
import { formatCentavosAsPHP, formatDateTime } from '@barangayan/shared';

import { CancelRequestButton } from './cancel-request-button';

type StatusHistoryEntry = { status: string; at: string; note?: string };

export default async function RequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: request } = await supabase
    .from('service_requests')
    .select('*, document_types(name, fee_centavos, description)')
    .eq('id', requestId)
    .single();

  if (!request) {
    notFound();
  }

  const history = (request.status_history as unknown as StatusHistoryEntry[]) ?? [];
  const canCancel = !['ready_for_pickup', 'completed', 'cancelled'].includes(request.status) && request.payment_status !== 'paid';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{request.document_types?.name ?? 'Document Request'}</h1>
          <p className="text-sm text-zinc-500">{request.reference_number}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill status={request.status} />
          <StatusPill status={request.payment_status} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-black/10 bg-white p-5 text-sm dark:border-white/10 dark:bg-zinc-900">
        <div>
          <p className="text-zinc-400">Fee</p>
          <p className="font-semibold">{formatCentavosAsPHP(request.document_types?.fee_centavos ?? 0)}</p>
        </div>
        <div>
          <p className="text-zinc-400">Submitted</p>
          <p className="font-semibold">{formatDateTime(request.created_at)}</p>
        </div>
        {request.requester_notes && (
          <div className="col-span-2">
            <p className="text-zinc-400">Your Notes</p>
            <p className="font-medium">{request.requester_notes}</p>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-3 font-semibold">Status Timeline</h2>
        <ol className="flex flex-col gap-3">
          {history.map((entry, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
              <div>
                <p className="font-medium capitalize">{entry.status.replace('_', ' ')}</p>
                <p className="text-xs text-zinc-400">{formatDateTime(entry.at)}</p>
                {entry.note && <p className="text-xs text-zinc-500">{entry.note}</p>}
              </div>
            </li>
          ))}
          {history.length === 0 && <p className="text-sm text-zinc-500">No status updates yet.</p>}
        </ol>
      </div>

      {canCancel && <CancelRequestButton requestId={request.id} />}
    </div>
  );
}
