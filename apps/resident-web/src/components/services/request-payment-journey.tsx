'use client';
import { formatCentavosAsPHP, requestFee, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { PaymentMethodStep } from './document-request-modal/payment-method-step';
import { PickupStep } from './document-request-modal/pickup-step';
import { QrphStep } from './document-request-modal/qrph-step';
import { SuccessStep } from './document-request-modal/success-step';

type Request = Tables<'service_requests'> & {
  document_types: { name: string; fee_centavos: number } | null;
  payments: { status: string; document_fee_centavos: number | null; amount_centavos: number }[];
};
export function RequestPaymentJourney({
  requestId,
  initialStep = 'method',
  onDone,
}: {
  requestId: string;
  initialStep?: 'method' | 'pickup' | 'qrph';
  onDone?: () => void;
}) {
  const router = useRouter();
  const [client] = useState(createSupabaseBrowserClient);
  const [request, setRequest] = useState<Request | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'method' | 'pickup' | 'qrph' | 'success'>(initialStep);
  const refresh = useCallback(async () => {
    const { data, error: queryError } = await client
      .from('service_requests')
      .select(
        '*, document_types(name, fee_centavos), payments(status, document_fee_centavos, amount_centavos)',
      )
      .eq('id', requestId)
      .single();
    setError(queryError ? 'Could not load the fee assessment. Reconnect and retry.' : null);
    setRequest(data);
  }, [client, requestId]);
  useEffect(() => {
    let active = true;
    const update = () => {
      if (active) void refresh();
    };
    update();
    const timer = window.setInterval(update, 10000);
    window.addEventListener('focus', update);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, [refresh]);
  if (error)
    return (
      <div role="alert">
        <p>{error}</p>
        <button type="button" className="min-h-12 underline" onClick={() => void refresh()}>
          Retry loading assessment
        </button>
      </div>
    );
  if (!request) return <p role="status">Loading request and fee assessment…</p>;
  const recorded =
    request.payments.find((payment) => ['paid', 'pending'].includes(payment.status)) ?? request.payments[0];
  const amount = requestFee(
    request,
    request.document_types?.fee_centavos ?? 0,
    recorded?.document_fee_centavos ?? recorded?.amount_centavos,
  );
  const track = (
    <a className="inline-block min-h-12 py-3 underline" href={`/services/requests/${requestId}`}>
      View My Request
    </a>
  );
  if (amount === null)
    return (
      <section className="space-y-4 rounded-xl border p-5">
        <h2 className="text-xl font-semibold">Request submitted</h2>
        <p>Ref #{request.reference_number}</p>
        <p role="status">Awaiting fee assessment</p>
        <p>
          Staff will review your requirements and confirm the amount or fee exemption. Payment becomes
          available after assessment.
        </p>
        <button className="min-h-12 underline" type="button" onClick={() => void refresh()}>
          Refresh assessment
        </button>
        {track}
      </section>
    );
  if (
    amount === 0 ||
    request.fee_assessment_state === 'waived' ||
    request.payment_status === 'paid' ||
    ['cancelled', 'completed'].includes(request.status)
  )
    return (
      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-xl font-semibold">{request.document_types?.name}</h2>
        <p>Ref #{request.reference_number}</p>
        <p>
          {request.payment_status === 'paid'
            ? 'Payment received'
            : request.fee_assessment_state === 'waived'
              ? 'Fee waived — no payment required'
              : amount === 0
                ? 'No payment required'
                : `Request ${request.status}`}
        </p>
        <p>Confirmed amount: {formatCentavosAsPHP(amount)}</p>
        {request.fee_basis ? <p>{request.fee_basis}</p> : null}
        {track}
      </section>
    );
  const name = request.document_types?.name ?? 'Document Request';
  if (step === 'pickup')
    return (
      <PickupStep
        requestId={requestId}
        barangayId={request.barangay_id}
        referenceNumber={request.reference_number}
        documentName={name}
        feeCentavos={amount}
        onDone={
          onDone ??
          (() => {
            router.push(`/services/requests/${requestId}`);
          })
        }
      />
    );
  if (step === 'qrph')
    return (
      <QrphStep
        requestId={requestId}
        referenceNumber={request.reference_number}
        documentName={name}
        documentFeeCentavos={amount}
        onPaid={() => setStep('success')}
        onCancelled={() => setStep('method')}
        onBack={() => setStep('method')}
      />
    );
  if (step === 'success')
    return (
      <SuccessStep
        requestId={requestId}
        referenceNumber={request.reference_number}
        onClose={
          onDone ??
          (() => {
            router.push(`/services/requests/${requestId}`);
          })
        }
      />
    );
  return (
    <>
      <PaymentMethodStep
        requestId={requestId}
        referenceNumber={request.reference_number}
        documentName={name}
        feeCentavos={amount}
        onMethodChosen={(method) => setStep(method)}
      />
      {request.fee_basis ? <p className="mt-4 text-sm">Fee basis: {request.fee_basis}</p> : null}
      {track}
    </>
  );
}
