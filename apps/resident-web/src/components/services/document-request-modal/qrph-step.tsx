'use client';

/**
 * Step 4b (QR PH branch) — ported from payment/qrph/[requestId]/qrph-payment.tsx.
 * usePaymongoSource is reused as-is (it's already navigation-free — polling and
 * Realtime are keyed off `requestId`/the payment row, not the route). The only changes
 * from the original: the paid confirmation's OK button calls `onPaid` instead of router.replace to
 * /services/payment/success, "Go Back" on error calls `onBack` instead of router.back(),
 * and a cancelled payment returns to payment-method-step (`onCancelled`) instead of
 * navigating to the request-tracking route — the resident can just pick a different
 * method without leaving the modal.
 *
 * Notification ownership (RW-LT-06): this screen owns every terminal notification for
 * the attempt. Confirmed payment opens a dialog until OK; an expired status is announced
 * once per payment attempt. Cancellation success is announced
 * only when the server confirmed it; a cancel that lost the race to payment follows the
 * paid outcome. Failures also stay on the page, because payment guidance must outlive a
 * toast. A countdown reaching zero is only a display condition.
 */

import { formatCentavosAsPHP } from '@barangayan/shared';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { PaymentConfirmedDialog } from '../payment-confirmed-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading';
import { useCountdown } from '@/hooks/use-countdown';
import { usePaymongoSource } from '@/hooks/use-paymongo-source';
import { beginAttempt, eventId, notify } from '@/lib/notify';

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

export function QrphStep({
  requestId,
  referenceNumber,
  documentName,
  documentFeeCentavos,
  onPaid,
  onCancelled,
  onBack,
}: {
  requestId: string;
  referenceNumber: string;
  documentName: string;
  documentFeeCentavos: number;
  onPaid: (paymentId: string) => void;
  onCancelled: () => void;
  onBack: () => void;
}) {
  const { source, status, errorMessage, cancelPayment, cancelling, statusCheckFailed, setupResult } = usePaymongoSource(requestId);
  const remaining = useCountdown(source?.expiresAt ?? null);
  const totalDue = source?.amountCentavos ?? documentFeeCentavos;
  const paymentId = source?.paymentId ?? null;
  // Synchronous guard: a second activation before React re-renders must not start a
  // second cancel request.
  const cancelBusy = useRef(false);
  useEffect(() => {
    if (!setupResult) return;
    if (status === 'pending' && source) notify.success('Payment QR code is ready.', { id: setupResult.id });
    else if (status === 'error') notify[setupResult.uncertain ? 'warning' : 'error'](setupResult.uncertain ? "We couldn't confirm the payment setup. Check your request before starting another payment." : "Couldn't prepare the payment QR code. Please try again.", { id: setupResult.id });
  }, [setupResult, status, source]);

  // Confirmed expiry (server status, not the countdown): one warning per attempt. The
  // inline guidance below stays on the page after the toast is gone.
  useEffect(() => {
    if (status !== 'expired' || !paymentId) return;
    notify.warning('This QR code has expired.', {
      description: 'If you already paid, don’t pay again — open My Request to check.',
      id: eventId('payment', paymentId, 'expired'),
    });
  }, [status, paymentId]);

  async function handleCancelPayment() {
    if (cancelBusy.current) return;
    cancelBusy.current = true;
    const attempt = beginAttempt('qrph-cancel');
    try {
      const result = await cancelPayment();
      if (result.outcome === 'cancelled') {
        notify.success('QR PH payment cancelled.', {
          description: 'You can choose a payment method again.',
          id: attempt,
        });
        onCancelled();
      } else if (result.outcome === 'unconfirmed') {
        notify.warning("We couldn't confirm the cancellation.", {
          description: 'Your QR code may still be valid. We’re still checking its status.',
          id: attempt,
        });
      } else if (result.outcome === 'rejected') {
        notify.error('Could not cancel the payment.', { description: 'Your QR code is still active.', id: attempt });
      }
      // 'paid': the confirmed paid transition above owns the announcement — no
      // cancellation message. 'ignored': nothing happened.
    } finally {
      cancelBusy.current = false;
    }
  }

  const expiryPassed = status === 'pending' && remaining !== null && remaining <= 0;

  return (
    <div className="flex flex-col gap-4">
      <PaymentConfirmedDialog open={status === 'paid'} onConfirm={() => { if (paymentId) onPaid(paymentId); }} />
      <div>
        <h2 className="text-xl font-bold">{documentName}</h2>
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
          // Same 256 px frame as the finished QR so nothing shifts when it arrives; steady
          // (non-pulsing) because a payment code is not a decorative placeholder.
          <Skeleton pulse={false} className="aspect-square w-64 max-w-full rounded-lg" />
        ) : status === 'error' ? (
          <>
            <p className="text-sm text-status-error">
              {errorMessage === 'Request is not ready for payment'
                ? 'This request can no longer be paid (it may have been cancelled or completed).'
                : (errorMessage ?? 'Could not start a QR PH payment. Please try again.')}
            </p>
            <Button variant="outline" onClick={onBack}>
              Go Back
            </Button>
          </>
        ) : status === 'expired' ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-status-error">This QR code has expired. Go back and try again.</p>
            <p className="text-xs text-muted-foreground">If you already paid, don&apos;t pay again — check your request first.</p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/services/requests/${requestId}`}>View My Request</Link>
            </Button>
          </div>
        ) : status === 'cancelled' ? (
          <p className="text-sm text-muted-foreground">Payment cancelled. Go back and try again if you&apos;d like to pay.</p>
        ) : status === 'paid' ? (
          <p className="text-sm font-semibold text-primary">Payment received</p>
        ) : source ? (
          // PayMongo's image_url is either a data: URI or an arbitrary PayMongo-hosted
          // https URL, neither of which next/image's remotePatterns (Supabase Storage
          // only) is configured for.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={toRenderableImageUri(source.qrImageUrl)} alt="PayMongo QR PH code" className="aspect-square w-64 max-w-full rounded-lg bg-white object-contain p-2" />
        ) : null}
      </div>
      {/* Announced once, outside the fixed-size frame so the frame never changes height. */}
      <LoadingStatus active={status === 'loading' || (!source && status !== 'error')} label="Generating your QR code…" className="text-center" />

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
              <p className="text-sm text-muted-foreground">Do not close this panel while paying. It will automatically update once payment is received.</p>
            </div>
          </div>

          {/* Persistent payment guidance. The matching toast is announced; these stay. */}
          {errorMessage ? (
            <p data-slot="payment-guidance" className="rounded-xl border border-status-warning/40 bg-status-warning/10 p-3 text-sm">
              {errorMessage}
            </p>
          ) : null}
          {statusCheckFailed ? (
            <p role="status" data-slot="payment-status-check" className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
              We&apos;re having trouble checking your payment status. If you already paid, don&apos;t pay again — this page will update
              when the connection returns.
            </p>
          ) : null}
          {expiryPassed ? (
            <p data-slot="payment-expiry-passed" className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
              This code&apos;s expiry time has passed. We&apos;re still confirming its status — if you already paid, keep this page open.
            </p>
          ) : null}

          <ConfirmDialog
            trigger={
              <Button variant="destructive" loading={cancelling} loadingLabel="Cancelling…">
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
