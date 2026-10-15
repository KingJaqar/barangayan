'use client';

/** Confirmed QR PH receipt for the request associated with this payment. */

import { formatCentavosAsPHP, formatDateTime, type Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { DownloadReceiptButton } from '../download-receipt-button';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading';

/**
 * Settled receipt read for this request: `missing` means the read succeeded but there is
 * no confirmed paid record yet (the receipt is only ever built from a paid row the
 * resident owns); `error` is a returned or thrown failure. Retry repeats this read only —
 * it never starts or repeats a payment.
 */
type Receipt = { status: 'ready'; payment: Tables<'payments'> } | { status: 'missing' } | { status: 'error' };

export function SuccessStep({
  requestId,
  referenceNumber,
}: {
  requestId: string;
  referenceNumber: string;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    // Microtask-wrapped state reset (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      if (active) setReceipt(null);
    });
    createSupabaseBrowserClient()
      .from('payments')
      .select('*')
      .eq('service_request_id', requestId)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(
        ({ data, error: queryError }) => {
          if (!active) return;
          if (queryError) setReceipt({ status: 'error' });
          else if (!data) setReceipt({ status: 'missing' });
          else setReceipt({ status: 'ready', payment: data });
        },
        () => {
          if (active) setReceipt({ status: 'error' });
        },
      );
    return () => {
      active = false;
    };
  }, [requestId, retry]);
  if (receipt?.status !== 'ready')
    return (
      <div className="flex flex-col gap-4" aria-busy={receipt === null || undefined}>
        {receipt === null ? (
          <div aria-hidden className="flex flex-col items-center gap-3">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-7 w-48 rounded" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : (
          <div role="alert" data-slot="receipt-guidance" className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm">
            <p>
              {receipt.status === 'error'
                ? "We couldn't load your payment receipt. Check your connection, then try again."
                : "Your payment receipt isn't confirmed yet."}
            </p>
            <p className="text-muted-foreground">
              If you already paid, don&apos;t pay again — your request keeps the confirmed payment record.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => setRetry((value) => value + 1)}>
                Retry receipt
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/services/requests?open=${requestId}`}>View My Request</Link>
              </Button>
            </div>
          </div>
        )}
        <LoadingStatus active={receipt === null} label="Loading your payment receipt…" />
      </div>
    );
  const { payment } = receipt;
  const paidAt = payment.paid_at ?? payment.created_at;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="mt-2 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary">
        <CheckCircle2 size={44} strokeWidth={1.75} />
      </div>

      <h2 className="text-2xl font-bold">Payment Successful</h2>
      <p className="text-2xl font-bold text-primary">{formatCentavosAsPHP(payment.amount_centavos)}</p>

      <div className="w-full rounded-2xl border border-border bg-card text-left">
        <p className="border-b border-border p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Transaction Details
        </p>
        <DetailRow label="Ref Number" value={referenceNumber} />
        <DetailRow label="Date/Time" value={formatDateTime(paidAt)} />
        <DetailRow label="Method" value={payment.method === 'pickup' ? 'Pay at Pickup' : 'QR PH'} />
        <DetailRow
          label="Document Fee"
          value={formatCentavosAsPHP(payment.document_fee_centavos ?? payment.amount_centavos)}
        />
        {payment.paymongo_payment_id ? (
          <DetailRow label="Transaction Ref" value={payment.paymongo_payment_id} />
        ) : null}
      </div>

      <div className="flex w-full flex-col gap-2">
        <Button asChild size="lg">
          <Link href={`/services/requests/${requestId}`}>Track My Request</Link>
        </Button>
        <DownloadReceiptButton payment={payment} referenceNumber={referenceNumber} />
        <Button asChild size="lg" variant="secondary"><Link href="/home">Return to Home</Link></Button>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border p-4 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
