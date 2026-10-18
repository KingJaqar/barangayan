import { useEffect, useRef, useState } from 'react';

import { isNoAnswer } from '@/lib/service-feedback';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { beginAttempt, type OperationId } from '@/lib/notify';

export type PaymentStatus = 'idle' | 'loading' | 'pending' | 'paid' | 'expired' | 'cancelled' | 'error';

export interface PaymongoSource {
  paymentId: string;
  paymentIntentId: string;
  qrImageUrl: string;
  expiresAt: number;
  documentFeeCentavos: number;
  amountCentavos: number;
}

const POLL_INTERVAL_MS = 5000;

/**
 * How a cancel attempt ended, for the screen that owns the notification:
 * - `cancelled`: the server confirmed the attempt is cancelled (or already expired).
 * - `paid`: the payment completed first — follow the paid outcome, never announce a cancellation.
 * - `rejected`: the server answered with a refusal; polling resumed.
 * - `unconfirmed`: no answer arrived; the cancel may or may not have applied. Polling resumed
 *   and will observe whichever state the server holds.
 * - `ignored`: nothing to cancel (not pending, or a cancel is already running).
 */
export type CancelOutcome = 'cancelled' | 'paid' | 'rejected' | 'unconfirmed' | 'ignored';

/**
 * Creates a PayMongo QR PH charge for a service request (via the create-payment-source
 * Edge Function, which holds the secret key — never in this app) and watches for
 * settlement until paid or expired.
 *
 * QR PH is a PaymentIntent flow, not a Source — see migration 0065 and the Edge
 * Function's own comment. The hook name is kept for continuity with its mobile
 * counterpart.
 *
 * Only `requestId` is sent; the server derives the confirmed request amount.
 */
export function usePaymongoSource(requestId: string) {
  const [source, setSource] = useState<PaymongoSource | null>(null);
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // True while the most recent status check could not reach the server. A display
  // condition only — never evidence that the payment failed or was not received.
  const [statusCheckFailed, setStatusCheckFailed] = useState(false);
  const [setupResult, setSetupResult] = useState<{ id: OperationId; uncertain: boolean } | null>(null);
  // Unique per hook instance — the resume check in create-payment-source deliberately
  // hands back the SAME paymentId across screen opens, so a `payment-${paymentId}` topic
  // collides whenever two QR screens are alive at once (e.g. back/forward navigation).
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards the polling callback against a race with cancelPayment(). clearInterval
  // prevents future polls but an already-in-flight async poll callback can still
  // complete after cancel — without this ref it could overwrite 'cancelled' with
  // 'expired' (since check-payment-status maps a voided PayMongo intent to 'expired').
  const cancelledRef = useRef(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    let cancelled = false;
    let preparationChecks = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const setupId = beginAttempt('qrph-setup');
    async function prepare() {
      if (cancelled) return;
      try {
        const { data, error } = await supabase.functions.invoke('create-payment-source', { body: { requestId } });
        if (cancelled) return;

        if (error) {
          // The Edge Function returns { error: "<reason>" } with a non-2xx status, which
          // supabase-js surfaces as a FunctionsHttpError whose context is the Response.
          // Read it so the resident sees PayMongo's actual reason instead of a generic
          // failure (e.g. "QR PH is not activated on this account").
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
          if (!cancelled) {
            const response = error.context;
            const uncertain = isNoAnswer(error) || !(response instanceof Response) || response.status >= 500;
            setSetupResult({ id: setupId, uncertain });
            setStatus('error');
          }
          return;
        }

        // Another caller owns the reservation. Retry only this explicit response;
        // transport errors must never blindly start another charge.
        if (data?.status === 'preparing') {
          if (++preparationChecks < 30) {
            retryTimer = setTimeout(() => { void prepare(); }, 1000);
          } else {
            setErrorMessage('Your QR payment is still being prepared. Reopen this request to check it before starting another payment.');
            setSetupResult({ id: setupId, uncertain: true });
            setStatus('error');
          }
          return;
        }

        // Setup may lose a race to an already-settled request. This response has no
        // payment identity/receipt, so keep it quiet instead of replaying settlement
        // or reporting an uncertain new payment setup.
        if (data?.status === 'paid') {
          setErrorMessage('This request is already paid. Open My Requests to view its receipt.');
          setStatus('error');
          return;
        }
        if (typeof data?.paymentId !== 'string' || !data.paymentId || typeof data?.qrImageUrl !== 'string' || !data.qrImageUrl) {
          setSetupResult({ id: setupId, uncertain: true });
          setErrorMessage('PayMongo did not return a QR code.');
          setStatus('error');
          return;
        }

        setSource({
          paymentId: data.paymentId as string,
          paymentIntentId: data.paymentIntentId as string,
          qrImageUrl: data.qrImageUrl as string,
          // Expiry comes from the Edge Function (30 minutes, PayMongo's dynamic QR PH
          // window) rather than being guessed client-side.
          expiresAt: (data.expiresAt as number) ?? Date.now() + 30 * 60 * 1000,
          documentFeeCentavos: (data.documentFeeCentavos as number) ?? 0,
          amountCentavos: (data.amountCentavos as number) ?? 0,
        });
        setStatus('pending');
        setSetupResult({ id: setupId, uncertain: false });
      } catch {
        // Network-level failure (e.g. unreachable Edge Function) — the destructured
        // {error} above only covers HTTP-level errors, so a thrown rejection needs its
        // own catch or the UI hangs on "Generating…" forever.
        if (!cancelled) { setSetupResult({ id: setupId, uncertain: true }); setStatus('error'); }
      }
    }

    // Strict Mode cleans up its replayed effect before this microtask runs. Keep
    // the network write behind the guard as well as the state updates.
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setStatus('loading');
      setSource(null);
      setErrorMessage(null);
      setSetupResult(null);
      void prepare();
    });

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      let data: { status?: string } | null = null;
      let failed = false;
      try {
        const result = await supabase.functions.invoke('check-payment-status', {
          body: { paymentId: source.paymentId },
        });
        data = result.data;
        failed = !!result.error;
      } catch {
        failed = true;
      }

      if (cancelledRef.current) return;
      setStatusCheckFailed(failed);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, status, instanceId]);

  /**
   * Cancels the in-flight QR PH attempt via the cancel-payment Edge Function (which also
   * voids the PaymentIntent on PayMongo's side). No-ops outside 'pending' — nothing to
   * cancel once it's settled, expired, or already cancelled.
   */
  async function cancelPayment(): Promise<{ ok: boolean; error?: string; outcome: CancelOutcome }> {
    if (!source || status !== 'pending' || cancelling) return { ok: false, outcome: 'ignored' };

    const UNCONFIRMED =
      "We couldn't confirm whether the payment was cancelled. The QR code may still be valid, and we're still checking its status.";

    // Set immediately — before the async call — so any in-flight poll or Realtime
    // callback that resolves during the cancel request knows not to override status.
    cancelledRef.current = true;
    setCancelling(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-payment', {
        body: { paymentId: source.paymentId },
      });

      if (error) {
        if (isNoAnswer(error)) {
          // The request may have reached PayMongo. Keep watching: the next poll or
          // Realtime event reports whichever state the server holds.
          setErrorMessage(UNCONFIRMED);
          cancelledRef.current = false;
          return { ok: false, error: UNCONFIRMED, outcome: 'unconfirmed' };
        }
        let message: string | undefined;
        const context = (error as { context?: Response }).context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            const parsed = (body as { error?: unknown })?.error;
            if (typeof parsed === 'string') message = parsed;
          } catch {
            // Body wasn't JSON — fall through to the generic message.
          }
        }
        message ??= 'Could not cancel the payment. Please try again.';
        setErrorMessage(message);
        cancelledRef.current = false; // cancel failed — let polling resume
        return { ok: false, error: message, outcome: 'rejected' };
      }

      if (data?.status === 'cancelled' || data?.status === 'expired') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setStatus('cancelled');
        return { ok: true, outcome: 'cancelled' };
      }
      if (data?.status === 'paid') {
        // Lost the race — payment actually went through moments ago.
        setStatus('paid');
        return { ok: false, error: 'This payment already went through.', outcome: 'paid' };
      }
      setErrorMessage(UNCONFIRMED);
      cancelledRef.current = false; // unexpected response — let polling resume
      return { ok: false, error: UNCONFIRMED, outcome: 'unconfirmed' };
    } catch {
      setErrorMessage(UNCONFIRMED);
      cancelledRef.current = false; // cancel failed — let polling resume
      return { ok: false, error: UNCONFIRMED, outcome: 'unconfirmed' };
    } finally {
      setCancelling(false);
    }
  }

  return { source, status, errorMessage, cancelPayment, cancelling, statusCheckFailed, setupResult };
}
