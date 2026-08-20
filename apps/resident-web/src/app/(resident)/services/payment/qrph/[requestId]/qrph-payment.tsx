'use client';

import { formatCentavosAsPHP } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { useCountdown } from '@/hooks/use-countdown';
import { usePaymongoSource } from '@/hooks/use-paymongo-source';

const PAYMENT_STEPS = [
  'Open your GCash, Maya, or bank’s app',
  'Tap "Scan QR" or "Pay via QR PH"',
  'Scan the code above',
  'Confirm the amount and complete payment',
  'Return here — we’ll detect it automatically',
];

/** PayMongo returns next_action.code.image_url as a base64 PNG, sometimes already a data
 * URI and sometimes bare base64 depending on the account — normalise before rendering.
 * A real http(s) URL is passed through untouched. */
function toRenderableImageUri(imageUrl: string): string {
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('http')) return imageUrl;
  return `data:image/png;base64,${imageUrl}`;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Ported from mobile's QrPhPaymentScreen — usePaymongoSource drives everything here;
 * this component is purely presentational branches over its `status`.
 */
export function QrphPayment({
  requestId,
  referenceNumber,
  documentName,
  documentFeeCentavos,
}: {
  requestId: string;
  referenceNumber: string;
  documentName: string;
  documentFeeCentavos: number;
}) {
  const router = useRouter();
  const { source, status, errorMessage, cancelPayment, cancelling } = usePaymongoSource(requestId);
  const remaining = useCountdown(source?.expiresAt ?? null);
  const totalDue = source?.amountCentavos ?? documentFeeCentavos;

  // Shows a toast + redirects to the success screen the moment settlement is observed —
  // no separate "confirm" step is needed on web the way mobile's modal provides one,
  // since there's no backgrounded bank/e-wallet app to return from.
  useEffect(() => {
    if (status !== 'paid') return;
    const timer = setTimeout(() => {
      router.replace(
        `/services/payment/success?requestId=${requestId}&refNumber=${encodeURIComponent(referenceNumber)}&amount=${totalDue}&documentFee=${source?.documentFeeCentavos ?? documentFeeCentavos}&method=${encodeURIComponent('QR PH')}&sourceId=${encodeURIComponent(source?.paymentIntentId ?? '')}`,
      );
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleCancelPayment() {
    const result = await cancelPayment();
    if (result.ok) router.push(`/services/requests/${requestId}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{documentName}</h1>
        <p className="text-sm text-muted-foreground">Ref #{referenceNumber}</p>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Document Fee</p>
        <p className="text-sm">{formatCentavosAsPHP(source?.documentFeeCentavos ?? documentFeeCentavos)}</p>
        <p className="mt-2 text-3xl font-bold text-primary">{totalDue === 0 ? 'Free' : formatCentavosAsPHP(totalDue)}</p>
        {source ? (
          <>
            {remaining !== null && remaining > 0 ? (
              <p className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">Expires in {formatCountdown(remaining)}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">Transaction ref: {source.paymentIntentId}</p>
          </>
        ) : null}
      </div>

      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
        {status === 'loading' || (!source && status !== 'error') ? (
          <>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Generating your QR code…</p>
          </>
        ) : status === 'error' ? (
          <>
            <p className="text-sm text-status-error">
              {errorMessage === 'Request is not ready for payment'
                ? 'This request can no longer be paid (it may have been cancelled or completed).'
                : (errorMessage ?? 'Could not start a QR PH payment. Please try again.')}
            </p>
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
          </>
        ) : status === 'expired' ? (
          <p className="text-sm text-status-error">This QR code has expired. Go back and try again.</p>
        ) : status === 'cancelled' ? (
          <p className="text-sm text-muted-foreground">Payment cancelled. Go back and try again if you&apos;d like to pay.</p>
        ) : status === 'paid' ? (
          <p className="text-sm font-semibold text-primary">Payment received — redirecting…</p>
        ) : source ? (
          // PayMongo's image_url is either a data: URI or an arbitrary PayMongo-hosted
          // https URL, neither of which next/image's remotePatterns (Supabase Storage
          // only) is configured for.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={toRenderableImageUri(source.qrImageUrl)} alt="PayMongo QR PH code" className="h-64 w-64 rounded-lg bg-white object-contain p-2" />
        ) : null}
      </div>

      {status === 'pending' || status === 'paid' ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">How to Pay</p>
          <ol className="flex flex-col gap-2">
            {PAYMENT_STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {status === 'pending' ? (
        <>
          <div className="flex items-center gap-3 rounded-2xl bg-primary/10 p-4">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-primary" />
            <div>
              <p className="text-sm font-semibold text-primary">Waiting for payment...</p>
              <p className="text-sm text-muted-foreground">Do not close this screen while paying. It will automatically update once payment is received.</p>
            </div>
          </div>

          <ConfirmDialog
            trigger={
              <Button variant="destructive" loading={cancelling}>
                Cancel Payment
              </Button>
            }
            title="Cancel Payment?"
            description="This will void the current QR code. You can start a new payment at any time."
            confirmLabel="Yes, Cancel"
            onConfirm={handleCancelPayment}
          />
        </>
      ) : null}
    </div>
  );
}
