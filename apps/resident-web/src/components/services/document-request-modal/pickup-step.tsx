'use client';

/**
 * Step 4a (Pay at Pickup branch) — ported from payment/pickup/[requestId]/
 * pickup-confirmation.tsx. Terminal screen for this branch, same as the standalone
 * route it's ported from: there's nothing left to do but close the modal or jump to the
 * full Requests list. `onDone` closes the modal rather than navigating home — the
 * resident is still on /services/documents and can pick another document straight away.
 */

import { formatCentavosAsPHP } from '@barangayan/shared';
import { Banknote } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function PickupStep({
  requestId,
  barangayId,
  referenceNumber,
  documentName,
  feeCentavos,
  onDone,
}: {
  requestId: string;
  barangayId: string;
  referenceNumber: string;
  documentName: string;
  feeCentavos: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function ensurePaymentRow() {
      // Idempotent-ish: only create a payments row if one doesn't already exist for this
      // request (e.g. the resident backs out and returns to this screen).
      const { data: existing } = await supabase.from('payments').select('id').eq('service_request_id', requestId).maybeSingle();

      if (!existing) {
        await supabase.from('payments').insert({
          service_request_id: requestId,
          barangay_id: barangayId,
          method: 'pickup',
          amount_centavos: feeCentavos,
          document_fee_centavos: feeCentavos,
          status: 'pending',
        });
      }
    }

    ensurePaymentRow();
  }, [requestId, barangayId, feeCentavos]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">{documentName}</h2>
        <p className="text-sm text-muted-foreground">Ref #{referenceNumber}</p>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Banknote size={32} strokeWidth={1.75} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount Due</p>
        <p className="text-3xl font-bold">{feeCentavos === 0 ? 'Free' : formatCentavosAsPHP(feeCentavos)}</p>
        <p className="text-sm text-muted-foreground">
          {feeCentavos === 0
            ? 'This document has no processing fee.'
            : `Pay ${formatCentavosAsPHP(feeCentavos)} in cash when you pick up this document at the Barangay Hall.`}
        </p>
      </div>

      <Button size="lg" onClick={onDone}>
        Done
      </Button>
      {/* ?open= lands on the Requests list with this request's tracking drawer already
          open, rather than just the bare list — same in-context pattern success-step
          uses instead of a bare navigation. */}
      <Button asChild size="lg" variant="outline">
        <Link href={`/services/requests?open=${requestId}`}>View My Request</Link>
      </Button>
    </div>
  );
}
