'use client';

/**
 * Step 5 (QR PH branch only) — ported from payment/success/page.tsx. "Return to Home"
 * doesn't make sense from inside a modal already sitting on /services/documents, so
 * it's replaced with a "Done" button that just closes the modal — the resident lands
 * back on the (now restored to its normal multi-column) documents grid.
 */

import { formatCentavosAsPHP, formatDateTime, type Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function SuccessStep({
  requestId,
  referenceNumber,
  onClose,
}: {
  requestId: string;
  referenceNumber: string;
  onClose: () => void;
}) {
  const [payment, setPayment] = useState<Tables<'payments'> | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    createSupabaseBrowserClient()
      .from('payments')
      .select('*')
      .eq('service_request_id', requestId)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (active) {
          setPayment(data);
          setError(!!queryError || !data);
        }
      });
    return () => {
      active = false;
    };
  }, [requestId, retry]);
  if (!payment)
    return (
      <div role={error ? 'alert' : 'status'}>
        <p>
          {error
            ? 'Could not confirm the recorded payment receipt. Reconnect and retry.'
            : 'Loading confirmed receipt…'}
        </p>
        {error ? <Button onClick={() => setRetry((value) => value + 1)}>Retry receipt</Button> : null}
      </div>
    );
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
        {/* ?open= lands on the Requests list with this request's tracking drawer already
            open, rather than the standalone /services/requests/[requestId] page — same
            in-context pattern this whole modal follows instead of a bare navigation. */}
        <Button asChild size="lg">
          <Link href={`/services/requests?open=${requestId}`}>Track My Request →</Link>
        </Button>
        <Button size="lg" variant="secondary" onClick={onClose}>
          Done
        </Button>
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
