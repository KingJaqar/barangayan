'use client';

/**
 * Step 3 — ported from payment/[requestId]/payment-method-form.tsx. No Back control:
 * unlike request-form-step, the service_requests row already exists by the time this
 * step is reached, so there's nothing to safely "undo" into — only forward transitions
 * (into pickup-step or qrph-step) once set_service_request_payment_method succeeds.
 */

import { formatCentavosAsPHP, type PaymentMethod } from '@barangayan/shared';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { PAYMENT_METHOD_OPTIONS, PAYMENT_SETTLEMENT_READY } from '@/constants/payment';
import { beginAttempt, notify } from '@/lib/notify';
import { paymentMethodFailure } from '@/lib/service-feedback';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function PaymentMethodStep({
  requestId,
  referenceNumber,
  documentName,
  feeCentavos,
  feeDescription,
  pickupOnly = false,
  onMethodChosen,
}: {
  requestId: string;
  referenceNumber: string;
  documentName: string;
  feeCentavos: number | null;
  feeDescription?: string;
  pickupOnly?: boolean;
  onMethodChosen: (method: PaymentMethod) => void;
}) {
  const [selected, setSelected] = useState<PaymentMethod>('pickup');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, [requestId]);

  const totalDue = feeCentavos;
  const isQrphBlocked = selected === 'qrph' && (pickupOnly || !PAYMENT_SETTLEMENT_READY);
  // PayMongo rejects QR PH sources with amount < 100 centavos — drop it from the options
  // rather than let the resident hit a confusing error on the next screen.
  const availableOptions = PAYMENT_METHOD_OPTIONS.filter((opt) => opt.key !== 'qrph' || (!pickupOnly && totalDue !== null && totalDue >= 100));

  async function handleContinue() {
    // Synchronous guard — a second activation before React re-renders must not send a
    // second write.
    if (isQrphBlocked || busy.current) return;
    busy.current = true;
    const attempt = beginAttempt('payment-method');
    const chosen = selected;
    setSubmitting(true);
    setError(null);
    try {
      // A plain .update() here would be silently swallowed by RLS — service_requests has
      // no resident UPDATE policy (status transitions are admin-only). This RPC lets a
      // resident set *only* payment_method on rows they own, without opening a broad
      // UPDATE policy on the whole table — confirmed by reading migration 0082, which
      // scopes the update with `where id = p_request_id and resident_id = auth.uid()`.
      const supabase = createSupabaseBrowserClient();
      const { error: rpcError, status } = await supabase.rpc('set_service_request_payment_method', {
        p_request_id: requestId,
        p_method: chosen,
      });
      if (rpcError) {
        const failure = paymentMethodFailure(rpcError, status);
        if (active.current) setError(failure.message);
        notify[failure.uncertain ? 'warning' : 'error'](failure.title, { id: attempt });
        return;
      }
      // Both choices immediately start the next operation. Pickup recording / QR
      // readiness owns the combined success; don't queue an intermediate save toast.
      if (active.current) onMethodChosen(chosen);
      else notify.success(`Payment method saved: ${chosen === 'pickup' ? 'Pay at Pickup' : 'QR PH'}.`, { id: attempt });
    } catch {
      const failure = paymentMethodFailure({ message: '' }, 0);
      if (active.current) setError(failure.message);
      notify.warning(failure.title, { id: attempt });
    } finally {
      busy.current = false;
      if (active.current) setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold">Payment Method</p>
        <h2 className="text-xl font-bold">{documentName}</h2>
        <p className="text-sm text-muted-foreground">Ref #{referenceNumber}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Document Fee</span>
          <span>{feeCentavos === 0 ? 'Free' : feeCentavos === null ? feeDescription : formatCentavosAsPHP(feeCentavos)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="font-semibold">Total Amount Due</span>
          <span className="font-semibold text-primary">{totalDue === 0 ? 'Free' : totalDue === null ? feeDescription : formatCentavosAsPHP(totalDue)}</span>
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Choose Payment Method</p>

      <div className="flex flex-col gap-3">
        {availableOptions.map((option) => {
          const isSelected = selected === option.key;
          const isGated = option.key === 'qrph' && !PAYMENT_SETTLEMENT_READY;
          const Icon = option.icon;
          return (
            <button
              key={option.key}
              type="button"
              disabled={submitting}
              aria-pressed={isSelected}
              onClick={() => setSelected(option.key)}
              className={`flex items-center gap-3 rounded-2xl border-2 bg-card p-4 text-left transition-colors ${
                isSelected ? 'border-primary' : 'border-transparent hover:border-border'
              }`}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Icon size={20} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{option.label}</span>
                  {isGated ? (
                    <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-status-warning">
                      Setup in Progress
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">{option.subtitle}</p>
              </div>
              <div className={`h-4 w-4 shrink-0 rounded-full border-2 ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
            </button>
          );
        })}
      </div>

      {isQrphBlocked ? (
        <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          QR PH is being finalized by your barangay and isn&apos;t accepting live payments yet. Choose Pay at Pickup to continue, or check back
          soon.
        </div>
      ) : null}

      {totalDue !== null && totalDue < 100 ? (
        <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          This request has no payable amount — QR PH is only available above ₱1.00.
        </div>
      ) : null}

      {/* Persistent guidance; the matching toast carries the announcement. */}
      {error ? <p data-slot="payment-method-error" className="text-sm text-status-error">{error}</p> : null}

      <Button size="lg" loading={submitting} loadingLabel="Saving your choice…" disabled={isQrphBlocked} onClick={handleContinue}>
        Continue
      </Button>
    </div>
  );
}
