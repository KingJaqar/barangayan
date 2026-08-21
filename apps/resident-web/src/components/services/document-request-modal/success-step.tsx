'use client';

/**
 * Step 5 (QR PH branch only) — ported from payment/success/page.tsx. "Return to Home"
 * doesn't make sense from inside a modal already sitting on /services/documents, so
 * it's replaced with a "Done" button that just closes the modal — the resident lands
 * back on the (now restored to its normal multi-column) documents grid.
 */

import { formatCentavosAsPHP, formatDateTime } from '@barangayan/shared';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type { SuccessPayload } from './types';

export function SuccessStep({
  requestId,
  referenceNumber,
  payload,
  onClose,
}: {
  requestId: string;
  referenceNumber: string;
  payload: SuccessPayload;
  onClose: () => void;
}) {
  const paidAt = new Date().toISOString();

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="mt-2 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary">
        <CheckCircle2 size={44} strokeWidth={1.75} />
      </div>

      <h2 className="text-2xl font-bold">Payment Successful</h2>
      <p className="text-2xl font-bold text-primary">{formatCentavosAsPHP(payload.amountCentavos)}</p>

      <div className="w-full rounded-2xl border border-border bg-card text-left">
        <p className="border-b border-border p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transaction Details</p>
        <DetailRow label="Ref Number" value={referenceNumber} />
        <DetailRow label="Date/Time" value={formatDateTime(paidAt)} />
        <DetailRow label="Method" value={payload.method} />
        <DetailRow label="Document Fee" value={formatCentavosAsPHP(payload.documentFeeCentavos)} />
        {payload.sourceId ? <DetailRow label="Transaction Ref" value={payload.sourceId} /> : null}
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
