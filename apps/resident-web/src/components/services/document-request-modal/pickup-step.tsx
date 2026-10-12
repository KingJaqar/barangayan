'use client';

/**
 * Step 4a (Pay at Pickup branch) — ported from payment/pickup/[requestId]/
 * pickup-confirmation.tsx. Terminal screen for this branch, same as the standalone
 * route it's ported from: there's nothing left to do but close the modal or jump to the
 * full Requests list. `onDone` closes the modal rather than navigating home — the
 * resident is still on /services/documents and can pick another document straight away.
 *
 * The pickup record is written once when this step opens. `start_pickup_payment` is
 * idempotent on the server (it reuses the request's pending/paid pickup payment and only
 * inserts when none exists — migration 0098 `pickup_payment`), so a remount, Strict Mode
 * replay, or a deliberate retry after a lost response never creates a second record.
 * This screen still guards the on-mount call to once per mounted request, reports the
 * outcome inline (it is its own confirmation view, so no toast), and keeps the Retry
 * control read-safe.
 */

import { formatCentavosAsPHP } from '@barangayan/shared';
import { Banknote } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { pickupPaymentFailure } from '@/lib/service-feedback';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type PickupState = { status: 'saving' } | { status: 'saved' } | { status: 'failed'; message: string; uncertain: boolean };

export function PickupStep({
  requestId,
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
  const [state, setState] = useState<PickupState>({ status: 'saving' });
  const inFlight = useRef(false);
  const startedFor = useRef<string | null>(null);
  const active = useRef(true);

  const save = useCallback(async () => {
    // Repeated activation (or a Strict Mode replay) while a write is in flight is ignored.
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ status: 'saving' });
    try {
      const client = createSupabaseBrowserClient();
      const { error, status } = await client.rpc('start_pickup_payment', { p_request_id: requestId });
      if (!active.current) return;
      if (error) {
        const failure = pickupPaymentFailure(error, status);
        setState({ status: 'failed', message: failure.message, uncertain: failure.uncertain });
      } else {
        setState({ status: 'saved' });
      }
    } catch {
      if (!active.current) return;
      const failure = pickupPaymentFailure({ message: '' }, 0);
      setState({ status: 'failed', message: failure.message, uncertain: true });
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
        <p className="text-3xl font-bold">{feeCentavos === 0 ? 'Free' : formatCentavosAsPHP(feeCentavos)}</p>
        <p className="text-sm text-muted-foreground">
          {feeCentavos === 0
            ? 'This document has no processing fee.'
            : `Pay ${formatCentavosAsPHP(feeCentavos)} in cash when you pick up this document at the Barangay Hall.`}
        </p>
      </div>

      <div aria-busy={saving || undefined} className="min-h-6">
        {state.status === 'failed' ? (
          <div role="alert" className="flex flex-col items-start gap-2 text-sm">
            <p>{state.message}</p>
            <Button type="button" variant="outline" size="sm" loading={saving} loadingLabel="Recording…" onClick={() => void save()}>
              Retry recording pickup payment
            </Button>
          </div>
        ) : state.status === 'saved' ? (
          <p role="status" className="text-sm font-medium">
            Pickup payment recorded.
          </p>
        ) : null}
        <LoadingStatus active={saving} label="Recording your pickup payment…" />
      </div>
      <Button size="lg" disabled={state.status !== 'saved'} onClick={onDone}>
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
