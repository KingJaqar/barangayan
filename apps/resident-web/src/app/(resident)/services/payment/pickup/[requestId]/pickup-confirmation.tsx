'use client';

import { formatCentavosAsPHP } from '@barangayan/shared';
import { Banknote } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Ported from mobile's PickupConfirmationScreen. Pay at Pickup is only ever marked
 * 'paid' by an admin at pickup (the admin Requests board's "Mark Payment Collected"
 * action) — this screen just confirms the choice and records amount_centavos on a
 * pending payments row so the admin Transactions ledger has something to reconcile
 * against at pickup.
 */
export function PickupConfirmation({
  requestId,
  barangayId,
  referenceNumber,
  documentName,
  feeCentavos,
}: {
  requestId: string;
  barangayId: string;
  referenceNumber: string;
  documentName: string;
  feeCentavos: number;
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
        <h1 className="text-2xl font-bold">{documentName}</h1>
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

      <Button asChild size="lg">
        <Link href="/services/requests">View My Requests</Link>
      </Button>
    </div>
  );
}
