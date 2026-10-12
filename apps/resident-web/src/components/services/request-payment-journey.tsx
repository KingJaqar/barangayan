'use client';
import { formatCentavosAsPHP, requestFee, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { Skeleton } from '@/components/ui/loading';
import { useScopedRead } from '@/hooks/use-scoped-read';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { PaymentMethodStep } from './document-request-modal/payment-method-step';
import { PickupStep } from './document-request-modal/pickup-step';
import { QrphStep } from './document-request-modal/qrph-step';
import { SuccessStep } from './document-request-modal/success-step';

type Request = Tables<'service_requests'> & {
  document_types: { name: string; fee_centavos: number } | null;
  payments: { status: string; document_fee_centavos: number | null; amount_centavos: number }[];
};

/** Mirrors the destination step's blocks so nothing shifts when the assessment arrives. */
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
  onDone,
}: {
  requestId: string;
  initialStep?: 'method' | 'pickup' | 'qrph';
  onDone?: () => void;
}) {
  const router = useRouter();
  const [client] = useState(createSupabaseBrowserClient);
  const [step, setStep] = useState<'method' | 'pickup' | 'qrph' | 'success'>(initialStep);
  // True once the QR step has been on screen for a request that was NOT yet paid. Only
  // then may a background refresh that observes `paid` leave that step in charge of the
  // paid transition; opening the QR route for an already-paid request shows the paid
  // summary and never mounts the step (no payment attempt is created).
  const [qrEngaged, setQrEngaged] = useState(false);

  // Read state is scoped to this request: a refresh keeps the last valid assessment on
  // screen (a failed refresh shows a warning instead of replacing it), and an obsolete
  // response can never replace a newer one.
  const read = useScopedRead<Request>(requestId, () =>
    client
      .from('service_requests')
      .select('*, document_types(name, fee_centavos), payments(status, document_fee_centavos, amount_centavos)')
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
        <InlineReadError
          message="We couldn't load the fee assessment. Reconnect and try again."
          retrying={read.isRefreshing}
          onRetry={refetch}
        />
      );
    return (
      <div aria-busy>
        <JourneySkeleton />
        <LoadingStatus active label="Loading request and fee assessment…" />
      </div>
    );
  }
  const staleWarning = read.error ? (
    <InlineReadError
      tone="warning"
      className="mb-4"
      message="We couldn't refresh the assessment. What you see may be out of date."
      retrying={read.isRefreshing}
      onRetry={refetch}
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
  if (amount === null)
    return (
      <section className="space-y-4 rounded-xl border p-5">
        {staleWarning}
        <h2 className="text-xl font-semibold">Request submitted</h2>
        <p>Ref #{request.reference_number}</p>
        <p role="status">Awaiting fee assessment</p>
        <p>
          Staff will review your requirements and confirm the amount or fee exemption. Payment becomes
          available after assessment.
        </p>
        <button
          className="min-h-12 underline disabled:opacity-60"
          type="button"
          disabled={read.isRefreshing}
          aria-busy={read.isRefreshing || undefined}
          onClick={refetch}
        >
          {read.isRefreshing ? 'Refreshing…' : 'Refresh assessment'}
        </button>
        {track}
      </section>
    );
  // A paid request normally shows this summary. While the QR PH step (or its receipt) is
  // on screen, that step owns the paid transition — it announces it once, keeps its own
  // 900 ms beat, and then shows the confirmed receipt — so a background refresh that
  // observes `paid` first must not swap it out from under the resident.
  const paidHandledByStep = request.payment_status === 'paid' && ((step === 'qrph' && qrEngaged) || step === 'success');
  if (
    amount === 0 ||
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
        <p>Confirmed amount: {formatCentavosAsPHP(amount)}</p>
        {request.fee_basis ? <p>{request.fee_basis}</p> : null}
        {track}
      </section>
    );
  const name = request.document_types?.name ?? 'Document Request';
  const body =
    step === 'pickup' ? (
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
    ) : step === 'qrph' ? (
      <QrphStep
        requestId={requestId}
        referenceNumber={request.reference_number}
        documentName={name}
        documentFeeCentavos={amount}
        onPaid={() => setStep('success')}
        onCancelled={() => setStep('method')}
        onBack={() => setStep('method')}
      />
    ) : step === 'success' ? (
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
    ) : (
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
  return (
    <>
      {staleWarning}
      {body}
    </>
  );
}
