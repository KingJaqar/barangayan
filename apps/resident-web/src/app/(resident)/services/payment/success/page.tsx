import { formatCentavosAsPHP, formatDateTime } from '@barangayan/shared';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
  const { user } = await requireUser();
  const { requestId } = await searchParams;
  const client = await createSupabaseServerClient();
  const { data: payment, error } = await client.from('payments')
    .select('*, service_requests!inner(reference_number, resident_id)').eq('service_request_id', requestId ?? '')
    .eq('service_requests.resident_id', user.id).eq('status', 'paid').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !payment) return <div role="alert"><p>No confirmed payment receipt is available for this request.</p><Link href={requestId ? `/services/payment/${requestId}` : '/services/requests'}>Return to request payment</Link></div>;
  const amountCentavos = payment.amount_centavos;
  const paidAt = payment.paid_at ?? payment.created_at;
  const refNumber = payment.service_requests?.reference_number;
  const documentFee = payment.document_fee_centavos;
  const method = payment.method === 'pickup' ? 'Pay at Pickup' : 'QR PH';
  const sourceId = payment.paymongo_payment_id ?? payment.paymongo_source_id;

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
        {documentFee != null ? <DetailRow label="Document Fee" value={formatCentavosAsPHP(documentFee)} /> : null}
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
