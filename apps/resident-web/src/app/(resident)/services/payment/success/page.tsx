import { formatCentavosAsPHP, formatDateTime } from '@barangayan/shared';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth/require-user';

/**
 * Ported from mobile's PaymentSuccessScreen — only reached from the QR PH flow once
 * usePaymongoSource observes status === 'paid'. Pay at Pickup never lands here — it has
 * its own confirmation screen (payment/pickup/[requestId]) since there's nothing to
 * "receive" until pickup.
 */
export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string; refNumber?: string; amount?: string; documentFee?: string; method?: string; sourceId?: string }>;
}) {
  await requireUser();
  const { requestId, refNumber, amount, documentFee, method, sourceId } = await searchParams;
  const amountCentavos = Number(amount ?? 0);
  const paidAt = new Date().toISOString();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
      <div className="mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary">
        <CheckCircle2 size={44} strokeWidth={1.75} />
      </div>

      <h1 className="text-2xl font-bold">Payment Successful</h1>
      <p className="text-2xl font-bold text-primary">{formatCentavosAsPHP(amountCentavos)}</p>

      <div className="w-full rounded-2xl border border-border bg-card text-left">
        <p className="border-b border-border p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transaction Details</p>
        <DetailRow label="Ref Number" value={refNumber ?? '—'} />
        <DetailRow label="Date/Time" value={formatDateTime(paidAt)} />
        <DetailRow label="Method" value={method ?? 'QR PH'} />
        {documentFee ? <DetailRow label="Document Fee" value={formatCentavosAsPHP(Number(documentFee))} /> : null}
        {sourceId ? <DetailRow label="Transaction Ref" value={sourceId} /> : null}
      </div>

      <div className="flex w-full flex-col gap-2">
        <Button asChild size="lg">
          <Link href={requestId ? `/services/requests/${requestId}` : '/services/requests'}>Track My Request →</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/home">Return to Home</Link>
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
