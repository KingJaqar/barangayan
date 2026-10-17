'use client';

/** Records the pickup choice once, then opens the requests list. */

import { formatCentavosAsPHP } from '@barangayan/shared';
import { Banknote } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { pickupPaymentFailure } from '@/lib/service-feedback';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { beginAttempt, notify } from '@/lib/notify';

type PickupState = { status: 'saving' } | { status: 'saved' } | { status: 'failed'; message: string };

export function PickupStep({
  requestId,
  referenceNumber,
  documentName,
  feeCentavos,
  feeDescription,
}: {
  requestId: string;
  referenceNumber: string;
  documentName: string;
  feeCentavos: number | null;
  feeDescription?: string;
}) {
  const [state, setState] = useState<PickupState>({ status: 'saving' });
  const inFlight = useRef(false);
  const startedFor = useRef<string | null>(null);
  const active = useRef(true);

  const save = useCallback(async () => {
    // Repeated activation (or a Strict Mode replay) while a write is in flight is ignored.
    if (inFlight.current) return;
    inFlight.current = true;
    const attempt = beginAttempt('pickup-payment');
    setState({ status: 'saving' });
    try {
      const client = createSupabaseBrowserClient();
      const { data, error, status } = await client.rpc('start_pickup_payment', { p_request_id: requestId });
      if (error || !data) {
        const failure = pickupPaymentFailure(error ?? { message: '' }, !data && !error ? 0 : status);
        notify[failure.uncertain ? 'warning' : 'error'](failure.uncertain ? "We couldn't confirm Pay at Pickup. Check your request before retrying." : "Couldn't record Pay at Pickup. Please try again.", { id: attempt });
        if (active.current) setState({ status: 'failed', message: failure.message });
      } else {
        notify.success('Pay at Pickup recorded. Payment is due at collection.', { id: attempt });
        if (active.current) setState({ status: 'saved' });
      }
    } catch {
      const failure = pickupPaymentFailure({ message: '' }, 0);
      notify.warning("We couldn't confirm Pay at Pickup. Check your request before retrying.", { id: attempt });
      if (active.current) setState({ status: 'failed', message: failure.message });
    } finally {
      inFlight.current = false;
    }
  }, [requestId]);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    if (startedFor.current === requestId) return;
    startedFor.current = requestId;
    void Promise.resolve().then(save);
  }, [requestId, save]);

  const saving = state.status === 'saving';

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
        <p className="text-3xl font-bold">{feeCentavos === null ? feeDescription : feeCentavos === 0 ? 'Free' : formatCentavosAsPHP(feeCentavos)}</p>
        <p className="text-sm text-muted-foreground">
          {feeCentavos === null ? 'Pay the applicable tax-code fee when you pick up this document at the Barangay Hall.' : feeCentavos === 0
            ? 'This document has no processing fee.'
            : `Pay ${formatCentavosAsPHP(feeCentavos ?? 0)} in cash when you pick up this document at the Barangay Hall.`}
        </p>
      </div>

      <div aria-busy={saving || undefined} className="min-h-6">
        {state.status === 'failed' ? (
          <div className="flex flex-col items-start gap-2 text-sm">
            <p>{state.message}</p>
            <Button type="button" variant="outline" size="sm" loading={saving} loadingLabel="Recording…" onClick={() => void save()}>
              Retry recording pickup payment
            </Button>
          </div>
        ) : state.status === 'saved' ? (
          <p className="text-sm font-medium">
            Pickup payment recorded.
          </p>
        ) : null}
        <LoadingStatus active={saving} label="Recording your pickup payment…" />
      </div>
      <Button asChild size="lg" disabled={state.status !== 'saved'}>
        <Link href="/services/requests">View My Requests</Link>
      </Button>
    </div>
  );
}
