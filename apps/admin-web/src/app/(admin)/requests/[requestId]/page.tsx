import { AgencySlaStatus } from '@/components/admin/agency-sla-status';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCentavosAsPHP, formatDateTime, requestFee, type Tables } from '@barangayan/shared';

import { PaymentRefundAction } from '@/components/admin/payment-refund-action';
import { RequestStatusActions } from '@/components/admin/request-status-actions';
import { RequestReviewPanel } from '@/components/admin/request-review-panel';
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
    .select('*, document_types(name, requirements, fee_centavos), profiles!service_requests_resident_id_fkey(full_name, mobile_number, home_address)')
    .eq('id', requestId)
    .is('deleted_at', null)
    .single();

  if (!data) notFound();

  const request = data as unknown as ServiceRequest;
  const history = (request.status_history as unknown as StatusHistoryEntry[]) ?? [];
  const [{ data: evidence }, { data: attachments }] = await Promise.all([
    request.approved_id_submission_id ? supabase.from('id_submissions').select('*').eq('id', request.approved_id_submission_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('request_attachments').select('*').eq('request_id', request.id),
  ]);
  const evidenceImages = evidence ? await Promise.all([evidence.front_path, evidence.back_path].map(async path => {
    const { data: signed, error } = await supabase.storage.from('id-documents').createSignedUrl(path, 600);
    return { url: signed?.signedUrl, error: error?.message };
  })) : [];
  const files = await Promise.all((attachments ?? []).map(async file => {
    const { data: signed, error } = await supabase.storage.from('request-attachments').createSignedUrl(file.object_path, 600);
    return { ...file, url: signed?.signedUrl, error: error?.message };
  }));

  // Refund action needs the actual payments row (id, refund_status) — a request only
  // ever has one, since create-payment-source/the COD screen are idempotent about it.
  const { data: payment } = await supabase
    .from('payments')
    .select(
      'id, method, status, amount_centavos, document_fee_centavos, refund_status, refund_transfer_link',
    )
    .eq('service_request_id', requestId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: paymentCount } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('service_request_id', requestId);
  const fee = requestFee(request, request.document_types?.fee_centavos ?? 0, payment?.document_fee_centavos ?? payment?.amount_centavos);

  return (
    <div className="mx-auto max-w-3xl">
      <AgencySlaStatus requestId={request.id} />
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
        {request.contract_version === 2 ? <RequestReviewPanel key={`${request.updated_at}:${paymentCount}`} request={request} paymentStarted={(paymentCount ?? 0) > 0} /> : <RequestStatusActions
          requestId={request.id}
          referenceNumber={request.reference_number}
          status={request.status}
          paymentStatus={request.payment_status}
          paymentMethod={request.payment_method}
          variant="full"
        />}
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
              {fee === null ? 'Awaiting fee assessment' : fee === 0 ? 'No payment required' : formatCentavosAsPHP(fee)}
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
                referenceNumber={request.reference_number}
                method={payment.method}
                status={payment.status}
                refundStatus={payment.refund_status}
                refundTransferLink={payment.refund_transfer_link}
              />
            </div>
          ) : null}
        </div>
      </div>

      {request.contract_version === 2 ? <div className="mb-6 space-y-4 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="font-semibold">Submitted purpose and supporting information</h2>
        <p>{request.purpose_label}{request.purpose_explanation ? ` — ${request.purpose_explanation}` : ''}</p>
        <dl className="space-y-2 text-sm">{Object.entries(request.supporting_details as Record<string, unknown>).map(([key, value]) => <div key={key}><dt className="font-medium">{({ businessName: 'Business name', establishmentAddress: 'Establishment address', isRenter: 'Transient/renter', recordReference: 'Record description/reference', copies: 'Requested copies', personalAppearanceAcknowledged: 'Personal appearance acknowledged' } as Record<string, string>)[key] ?? key}</dt><dd>{typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)}</dd></div>)}</dl>
        <h3 className="font-semibold">Supporting attachments</h3>
        {files.length ? files.map(file => <p key={file.id} className="text-sm">{file.url ? <a className="text-[var(--accent)] underline" href={file.url} target="_blank" rel="noreferrer">Open {file.requirement_code.toUpperCase()} evidence ({file.mime_type}, {Math.ceil(file.size_bytes / 1024)} KB)</a> : <span role="alert">Evidence unavailable: {file.error}. Reload to retry.</span>}</p>) : <p className="text-sm text-zinc-500">No supporting files supplied. Review eligibility and required in-person documents.</p>}
        <h3 className="font-semibold">ID evidence approved at submission</h3>
        {evidence ? <><p className="text-sm">{evidence.id_type} · Version {evidence.version} · Current evidence decision: {evidence.decision}</p><p className="text-xs text-zinc-500">This request retains the evidence approved at submission, even if a later replacement or revocation blocks new requests.</p><div className="grid grid-cols-2 gap-3">{evidenceImages.map((file, i) => file.url ? <a key={i} href={file.url} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">View approved ID {i === 0 ? 'front' : 'back'}</a> : <p key={i} role="alert">ID preview unavailable. Reload to retry.</p>)}</div></> : <p role="alert">Referenced ID evidence is unavailable. Resolve before acceptance.</p>}
      </div> : null}

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
          <h2 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">{request.contract_version === 2 ? 'Requester notes' : 'Purpose'}</h2>
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
