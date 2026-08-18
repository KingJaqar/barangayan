import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type PaymentStatus = 'idle' | 'loading' | 'pending' | 'paid' | 'expired' | 'cancelled' | 'error';

export interface PaymongoSource {
  paymentId: string;
  paymentIntentId: string;
  qrImageUrl: string;
  expiresAt: number;
  documentFeeCentavos: number;
  shippingFeeCentavos: number;
  amountCentavos: number;
}

const POLL_INTERVAL_MS = 5000;

/**
 * Creates a PayMongo QR Ph charge for a service request (via the create-payment-source
 * Edge Function, which holds the secret key — never in this app) and watches for
 * settlement until paid or expired.
 *
 * QR Ph is a PaymentIntent flow, not a Source — see migration 0065 and the Edge
 * Function's own comment. The hook name is kept for continuity with its callers.
 *
 * S0-2: only `requestId` is sent — the Edge Function derives the fee and description
 * itself from document_types + the barangay's shipping fee, so a tampered amount here
 * has no effect on what's actually charged or recorded.
 */
export function usePaymongoSource(requestId: string) {
  const [source, setSource] = useState<PaymongoSource | null>(null);
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Unique per hook instance — see use-my-incidents.ts. Doubly needed here: the resume
  // check in create-payment-source deliberately hands back the SAME paymentId across
  // screen opens, so a `payment-${paymentId}` topic collides whenever two QR screens are
  // alive at once. The effect below also re-runs on `status` changes, and removeChannel()
  // is async, so even a single screen can race its own teardown.
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards the polling callback against a race with cancelPayment(). clearInterval
  // prevents future polls but an already-in-flight async poll callback can still
  // complete after cancel — without this ref it could overwrite 'cancelled' with
  // 'expired' (since check-payment-status maps a voided PayMongo intent to 'expired').
  const cancelledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    supabase.functions
      .invoke('create-payment-source', { body: { requestId } })
      .then(async ({ data, error }) => {
        if (cancelled) return;

        if (error) {
          // The Edge Function returns { error: "<reason>" } with a non-2xx status, which
          // supabase-js surfaces as a FunctionsHttpError whose context is the Response.
          // Read it so the resident sees PayMongo's actual reason instead of a generic
          // failure (e.g. "QR Ph is not activated on this account").
          const context = (error as { context?: Response }).context;
          if (context && typeof context.json === 'function') {
            try {
              const body = await context.json();
              const message = (body as { error?: unknown })?.error;
              if (!cancelled && typeof message === 'string') setErrorMessage(message);
            } catch {
              // Body wasn't JSON — fall through to the generic message.
            }
          }
          if (!cancelled) setStatus('error');
          return;
        }

        if (!data?.paymentId || !data?.qrImageUrl) {
          setErrorMessage('PayMongo did not return a QR code.');
          setStatus('error');
          return;
        }

        setSource({
          paymentId: data.paymentId as string,
          paymentIntentId: data.paymentIntentId as string,
          qrImageUrl: data.qrImageUrl as string,
          // Expiry comes from the Edge Function (30 minutes, PayMongo's dynamic QR Ph
          // window) rather than being guessed client-side.
          expiresAt: (data.expiresAt as number) ?? Date.now() + 30 * 60 * 1000,
          documentFeeCentavos: (data.documentFeeCentavos as number) ?? 0,
          shippingFeeCentavos: (data.shippingFeeCentavos as number) ?? 0,
          amountCentavos: (data.amountCentavos as number) ?? 0,
        });
        setStatus('pending');
      })
      .catch(() => {
        // Network-level failure (e.g. unreachable Edge Function) — the destructured
        // {error} above only covers HTTP-level errors, so a thrown rejection needs its
        // own catch or the UI hangs on "Generating…" forever.
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    if (!source || status !== 'pending') return;

    // Reset the cancel guard when entering the polling state — a fresh payment
    // (e.g. the resident navigated back and reopened the QR screen) starts clean.
    cancelledRef.current = false;

    pollingRef.current = setInterval(async () => {
      // An in-flight poll may complete after cancelPayment() already voided the
      // intent. Without this guard, the poll's 'expired' response would overwrite
      // the 'cancelled' status the user just triggered.
      if (cancelledRef.current) return;

      const { data } = await supabase.functions.invoke('check-payment-status', {
        body: { paymentId: source.paymentId },
      });

      if (cancelledRef.current) return;

      if (data?.status === 'paid') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setStatus('paid');
      } else if (data?.status === 'expired') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setStatus('expired');
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [source, status]);

  // Realtime: the paymongo-webhook function writes `paid` to this exact row the moment
  // PayMongo confirms — this fires in well under a second, versus waiting up to
  // POLL_INTERVAL_MS for the next poll. Polling above stays as a fallback in case a
  // Realtime event is ever missed (e.g. a brief reconnect).
  useEffect(() => {
    if (!source || status !== 'pending') return;

    const channel = supabase
      .channel(`payment-${source.paymentId}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payments', filter: `id=eq.${source.paymentId}` },
        (payload) => {
          if (cancelledRef.current) return;
          const next = (payload.new as { status?: string })?.status;
          if (next === 'paid') setStatus('paid');
          else if (next === 'expired' || next === 'failed') setStatus('expired');
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [source, status, instanceId]);

  /**
   * Cancels the in-flight QR Ph attempt via the cancel-payment Edge Function (which also
   * voids the PaymentIntent on PayMongo's side). No-ops outside 'pending' — nothing to
   * cancel once it's settled, expired, or already cancelled.
   */
  async function cancelPayment(): Promise<{ ok: boolean; error?: string }> {
    if (!source || status !== 'pending' || cancelling) return { ok: false };

    // Set immediately — before the async call — so any in-flight poll or Realtime
    // callback that resolves during the cancel request knows not to override status.
    cancelledRef.current = true;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-payment', {
        body: { paymentId: source.paymentId },
      });

      if (error) {
        let message: string | undefined;
        const context = (error as { context?: Response }).context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            const parsed = (body as { error?: unknown })?.error;
            if (typeof parsed === 'string') message = parsed;
          } catch {
            // Body wasn't JSON — fall through without a specific message.
          }
        }
        if (message) setErrorMessage(message);
        cancelledRef.current = false; // cancel failed — let polling resume
        return { ok: false, error: message };
      }

      if (data?.status === 'cancelled' || data?.status === 'expired') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setStatus('cancelled');
        return { ok: true };
      }
      if (data?.status === 'paid') {
        // Lost the race — payment actually went through moments ago.
        setStatus('paid');
        return { ok: false, error: 'This payment already went through.' };
      }
      cancelledRef.current = false; // unexpected response — let polling resume
      return { ok: false };
    } catch {
      const message = 'Could not cancel the payment. Please try again.';
      setErrorMessage(message);
      cancelledRef.current = false; // cancel failed — let polling resume
      return { ok: false, error: message };
    } finally {
      setCancelling(false);
    }
  }

  return { source, status, errorMessage, cancelPayment, cancelling };
}
