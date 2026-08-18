import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCentavosAsPHP, formatDateTime, type Tables } from '@barangayan/shared';

import { PaymentRefundAction } from '@/components/admin/payment-refund-action';
import { RequestStatusActions } from '@/components/admin/request-status-actions';
import { StatusPill } from '@/components/admin/status-pill';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'requirements' | 'fee_centavos'> | null;
  profiles: Pick<Tables<'profiles'>, 'full_name' | 'mobile_number' | 'home_address'> | null;
};

interface StatusHistoryEntry {
  status: string;
  at: string;
  note: string | null;
}

const STEP_LABEL: Record<string, string> = {
  submitted: 'Request Submitted',
  in_progress: 'Processing',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// Full resident info + timeline, styled to match the mobile Request Tracking screen's
// own timeline so an admin and a resident looking at the same request agree on its
// history — same status_history shape, same STEP_LABEL wording.
export default async function RequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('service_requests')
    .select('*, document_types(name, requirements, fee_centavos), profiles(full_name, mobile_number, home_address)')
    .eq('id', requestId)
    .is('deleted_at', null)
    .single();

  if (!data) notFound();

  const request = data as unknown as ServiceRequest;
  const history = (request.status_history as unknown as StatusHistoryEntry[]) ?? [];

  // Refund action needs the actual payments row (id, refund_status) — a request only
  // ever has one, since create-payment-source/the COD screen are idempotent about it.
  const { data: payment } = await supabase
    .from('payments')
    .select(
      'id, method, status, amount_centavos, document_fee_centavos, refund_status, refund_transfer_link',
    )
    .eq('service_request_id', requestId)
    .is('deleted_at', null)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/requests" className="mb-4 inline-block text-sm text-[var(--accent)] hover:underline">
        ← Back to Requests
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{request.document_types?.name ?? 'Document Request'}</h1>
          <p className="text-sm text-zinc-500">Ref #{request.reference_number}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill status={request.status} />
          <StatusPill status={request.payment_status} />
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <RequestStatusActions
          requestId={request.id}
          status={request.status}
          paymentStatus={request.payment_status}
          paymentMethod={request.payment_method}
          variant="full"
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Resident</h2>
          <p className="text-sm font-medium">{request.profiles?.full_name ?? '—'}</p>
          <p className="text-sm text-zinc-500">{request.profiles?.home_address ?? 'No address on file'}</p>
          <p className="text-sm text-zinc-500">{request.profiles?.mobile_number ?? 'No mobile number on file'}</p>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Payment</h2>
          <p className="text-sm">
            Method: <span className="font-medium">{request.payment_method === 'qrph' ? 'QR PH' : request.payment_method === 'pickup' ? 'Pay at Pickup' : '—'}</span>
          </p>
          <p className="text-sm">
            Document Fee:{' '}
            <span className="font-medium">
              {payment?.document_fee_centavos != null
                ? formatCentavosAsPHP(payment.document_fee_centavos)
                : request.document_types?.fee_centavos
                  ? formatCentavosAsPHP(request.document_types.fee_centavos)
                  : 'Free'}
            </span>
          </p>
          {payment ? (
            <p className="text-sm">
              Total: <span className="font-medium">{formatCentavosAsPHP(payment.amount_centavos)}</span>
            </p>
          ) : null}
          {payment ? (
            <div className="mt-3">
              <PaymentRefundAction
                paymentId={payment.id}
                method={payment.method}
                status={payment.status}
                refundStatus={payment.refund_status}
                refundTransferLink={payment.refund_transfer_link}
              />
            </div>
          ) : null}
        </div>
      </div>

      {request.document_types?.requirements?.length ? (
        <div className="mb-6 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Requirements</h2>
          <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">
            {request.document_types.requirements.map((req) => (
              <li key={req}>{req}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {request.requester_notes ? (
        <div className="mb-6 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Purpose</h2>
          <p className="text-sm">{request.requester_notes}</p>
        </div>
      ) : null}

      <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Status History</h2>
        <div className="flex flex-col gap-3">
          {history.map((entry, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
              <div>
                <p className="text-sm font-medium">{STEP_LABEL[entry.status] ?? entry.status}</p>
                <p className="text-xs text-zinc-500">{formatDateTime(entry.at)}</p>
                {entry.note ? <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">{entry.note}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
