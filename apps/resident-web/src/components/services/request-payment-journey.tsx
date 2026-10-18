'use client';
import { formatCentavosAsPHP, requestFee, type Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';

import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { Skeleton } from '@/components/ui/loading';
import { useScopedRead } from '@/hooks/use-scoped-read';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { PaymentMethodStep } from './document-request-modal/payment-method-step';
import { PickupStep } from './document-request-modal/pickup-step';
import { QrphStep } from './document-request-modal/qrph-step';
import { RequestPageCount } from './request-page-count';
import { SuccessStep } from './document-request-modal/success-step';

type Request = Tables<'service_requests'> & {
  document_types: { name: string; fee_centavos: number; service_kind: string | null } | null;
  payments: { status: string; document_fee_centavos: number | null; amount_centavos: number }[];
};

/** Mirrors the destination step's blocks so nothing shifts when the payment details arrive. */
function JourneySkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-2/3 rounded" />
        <Skeleton className="h-4 w-28 rounded" />
      </div>
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-12 rounded-full" />
    </div>
  );
}

export function RequestPaymentJourney({
  requestId,
  initialStep = 'method',
  onStepChange,
}: {
  requestId: string;
  initialStep?: 'method' | 'pickup' | 'qrph';
  /** Lets the document sheet start each payment screen at its heading. */
  onStepChange?: () => void;
}) {
  const [client] = useState(createSupabaseBrowserClient);
  const [step, setStep] = useState<'method' | 'pickup' | 'qrph' | 'success'>(initialStep);
  // True once the QR step has been on screen for a request that was NOT yet paid. Only
  // then may a background refresh that observes `paid` leave that step in charge of the
  // paid transition; opening the QR route for an already-paid request shows the paid
  // summary and never mounts the step (no payment attempt is created).
  const [qrEngaged, setQrEngaged] = useState(false);
  const [confirmedPaymentId, setConfirmedPaymentId] = useState<string | null>(null);
  useEffect(() => { onStepChange?.(); }, [step, onStepChange]);

  // Read state is scoped to this request: a refresh keeps the last valid payment details on
  // screen (a failed refresh shows a warning instead of replacing it), and an obsolete
  // response can never replace a newer one.
  const read = useScopedRead<Request>(requestId, () =>
    client
      .from('service_requests')
      .select('*, document_types(name, fee_centavos, service_kind), payments(status, document_fee_centavos, amount_centavos)')
      .eq('id', requestId)
      .single() as unknown as PromiseLike<{ data: Request | null; error: { message: string } | null }>,
  );
  const { refetch } = read;

  // Intentional 10 s poll and focus refresh (unchanged): both are quiet background reads.
  useEffect(() => {
    const update = () => refetch();
    const timer = window.setInterval(update, 10000);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, [refetch]);

  const request = read.data;
  const requestPaid = request?.payment_status === 'paid';
  useEffect(() => {
    if (step !== 'qrph' || !request || requestPaid) return;
    // Microtask-wrapped state write (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => setQrEngaged(true));
  }, [step, request, requestPaid]);
  if (!request) {
    if (read.error)
      return (
        <InlineReadError announce={!read.errorAnnounced}
          message="We couldn't load the payment details. Reconnect and try again."
          retrying={read.isRefreshing}
          onRetry={() => refetch('payment details')}
        />
      );
    return (
      <div aria-busy>
        <JourneySkeleton />
        <LoadingStatus active label="Loading request and payment details…" />
      </div>
    );
  }
  const staleWarning = read.error ? (
    <InlineReadError announce={!read.errorAnnounced}
      tone="warning"
      className="mb-4"
      message="We couldn't refresh the payment details. What you see may be out of date."
      retrying={read.isRefreshing}
      onRetry={() => refetch('payment details')}
    />
  ) : null;
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
  const pickupOnly = request.document_types?.service_kind === 'business' || request.fee_assessment_state === 'pickup_due';
  if (request.fee_assessment_state === 'page_count_required' && !['cancelled', 'completed'].includes(request.status))
    return <RequestPageCount requestId={requestId} onSaved={refetch} />;
  const feeDescription = pickupOnly ? 'See Attached Tax Code (depends on the kind of transaction)' : undefined;
  // A paid request normally shows this summary. While the QR PH step (or its receipt) is
  // on screen, that step owns the paid transition and waits for OK before showing the
  // confirmed receipt, so a background refresh that
  // observes `paid` first must not swap it out from under the resident.
  const paidHandledByStep = request.payment_status === 'paid' && ((step === 'qrph' && qrEngaged) || step === 'success');
  if (
    (!pickupOnly && amount === 0) ||
    request.fee_assessment_state === 'waived' ||
    (request.payment_status === 'paid' && !paidHandledByStep) ||
    ['cancelled', 'completed'].includes(request.status)
  )
    return (
      <section className="space-y-3 rounded-xl border p-5">
        {staleWarning}
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
        <p>Confirmed amount: {amount === null ? feeDescription : formatCentavosAsPHP(amount)}</p>
        {track}
      </section>
    );
  const name = request.document_types?.name ?? 'Document Request';
  const body =
    step === 'pickup' ? (
      <PickupStep
        requestId={requestId}
        referenceNumber={request.reference_number}
        documentName={name}
        feeCentavos={amount}
        feeDescription={feeDescription}
      />
    ) : step === 'qrph' && !pickupOnly ? (
      <QrphStep
        requestId={requestId}
        referenceNumber={request.reference_number}
        documentName={name}
        documentFeeCentavos={amount!}
        onPaid={(paymentId) => { setConfirmedPaymentId(paymentId); setStep('success'); }}
        onCancelled={() => setStep('method')}
        onBack={() => setStep('method')}
      />
    ) : step === 'success' ? (
      <SuccessStep
        requestId={requestId}
        referenceNumber={request.reference_number}
        announcePaymentId={confirmedPaymentId}
      />
    ) : (
      <>
        <PaymentMethodStep
          requestId={requestId}
          referenceNumber={request.reference_number}
          documentName={name}
          feeCentavos={amount}
          feeDescription={feeDescription}
          pickupOnly={pickupOnly}
          onMethodChosen={(method) => setStep(method)}
        />
        {request.billable_pages ? <p className="mt-4 text-sm">{request.billable_pages} pages × ₱10.00 per page</p> : null}
        {track}
      </>
    );
  return (
    <>
      {staleWarning}
      {body}
    </>
  );
}
