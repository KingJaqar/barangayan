'use client';

import { estimateLabel, formatCentavosAsPHP, formatDateTime, progressFraction, type Tables } from '@barangayan/shared';
import { Banknote, CheckCircle2, HelpCircle, QrCode, RefreshCw, Store, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { StatusPill } from '@/components/shared/status-pill';
import { Button } from '@/components/ui/button';
import { PAYMENT_SETTLEMENT_READY } from '@/constants/payment';
import { useCountdown } from '@/hooks/use-countdown';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'processing_target_hours' | 'fee_centavos'> | null;
};

interface StatusHistoryEntry {
  status: string;
  at: string;
  note?: string | null;
}

const STEP_ORDER = ['submitted', 'in_progress', 'ready_for_pickup', 'completed'];
const STEP_LABEL: Record<string, string> = {
  submitted: 'Request Submitted',
  in_progress: 'Processing',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
};
const STEP_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  submitted: CheckCircle2,
  in_progress: RefreshCw,
  ready_for_pickup: Store,
  completed: CheckCircle2,
};

// Amber, distinct from the theme accent — matches mobile's in-progress percentage color.
const PROGRESS_AMBER = '#F59E0B';

/** "12:34" — mm:ss is enough for a button label. */
function formatButtonCountdown(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Ported from apps/resident-android-mobile/src/app/(app)/services/requests/[requestId].tsx
 * — realtime status/payment updates, pending-QR countdown, cancel request/payment.
 */
export function RequestTracking({ requestId, initialRequest }: { requestId: string; initialRequest: ServiceRequest }) {
  const router = useRouter();
  const [request, setRequest] = useState<ServiceRequest>(initialRequest);
  const [pendingPayment, setPendingPayment] = useState<{ id: string; expiresAt: number } | null | undefined>(undefined);
  const [cancellingPayment, setCancellingPayment] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);
  const pendingRemaining = useCountdown(pendingPayment?.expiresAt ?? null);
  // Unique per mounted instance — supabase.channel() returns the EXISTING channel when
  // one with the same topic is already registered, and a plain remount (e.g. React
  // Strict Mode, or navigating away and back) can race removeChannel()'s async teardown.
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    function load() {
      supabase
        .from('service_requests')
        .select('*, document_types(name, processing_target_hours, fee_centavos)')
        .eq('id', requestId)
        .single()
        .then(({ data }) => {
          if (!cancelled && data) setRequest(data as ServiceRequest);
        });
    }

    function loadPendingPayment() {
      supabase
        .from('payments')
        .select('id, expires_at')
        .eq('service_request_id', requestId)
        .eq('method', 'qrph')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          setPendingPayment(data ? { id: data.id, expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : Date.now() } : null);
        });
    }

    loadPendingPayment();

    const channel = supabase
      .channel(`service-request-${requestId}-${instanceId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'service_requests', filter: `id=eq.${requestId}` }, load)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `service_request_id=eq.${requestId}` },
        loadPendingPayment,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [requestId, instanceId]);

  async function handleCancelPendingPayment() {
    if (!pendingPayment) return;
    setCancellingPayment(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke('cancel-payment', { body: { paymentId: pendingPayment.id } });

      if (error) {
        let message = 'Please try again.';
        const context = (error as { context?: Response }).context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            const parsed = (body as { error?: unknown })?.error;
            if (typeof parsed === 'string') message = parsed;
          } catch {
            // Body wasn't JSON — keep generic message.
          }
        }
        toast.error(message);
        return;
      }

      if (data?.status === 'cancelled' || data?.status === 'expired') {
        setPendingPayment(null);
        toast.success('Your QR PH payment attempt has been cancelled. You can start a new payment at any time.');
      } else if (data?.status === 'paid') {
        toast.info('This payment was already completed.');
      } else {
        toast.error('Could not cancel. Please try again.');
      }
    } catch {
      toast.error('Could not cancel. Please try again.');
    } finally {
      setCancellingPayment(false);
    }
  }

  async function handleCancelRequest() {
    setCancellingRequest(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc('cancel_own_service_request', { p_request_id: requestId, p_note: null });

      if (error) {
        toast.error(error.message);
        return;
      }
      // No local state patch needed — the realtime subscription above will pick up the
      // resulting status: 'cancelled' update.
      toast.success('Your service request has been cancelled.');
      router.refresh();
    } catch {
      toast.error('Could not cancel. Please try again.');
    } finally {
      setCancellingRequest(false);
    }
  }

  const history = (request.status_history as unknown as StatusHistoryEntry[]) ?? [];
  const currentStepIndex = STEP_ORDER.indexOf(request.status);
  const targetHours = request.document_types?.processing_target_hours ?? 24;
  const isCancelled = request.status === 'cancelled';
  const fraction = isCancelled ? 0 : progressFraction(request.status, request.created_at, targetHours);
  const progressColor = request.status === 'completed' ? 'var(--primary)' : PROGRESS_AMBER;

  const fee = request.document_types?.fee_centavos ?? 0;
  const paymentMethodLabel = request.payment_method === 'pickup' ? 'Pay at Pickup' : request.payment_method === 'qrph' ? 'QR PH' : 'Not yet selected';
  const PaymentMethodIcon = request.payment_method === 'pickup' ? Banknote : request.payment_method === 'qrph' ? QrCode : HelpCircle;
  const isPaid = request.payment_status === 'paid';
  const isRefunded = request.payment_status === 'refunded';
  const canPayNow = request.status !== 'cancelled' && request.status !== 'completed';
  const showQrPayNow = request.payment_method === 'qrph' && !isPaid && !isRefunded && canPayNow && fee >= 100 && PAYMENT_SETTLEMENT_READY;
  const hasActivePendingPayment = !!pendingPayment && (pendingRemaining ?? 0) > 0;
  const showCancelSlot =
    request.status !== 'ready_for_pickup' && request.status !== 'completed' && request.status !== 'cancelled' && request.payment_status !== 'paid';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">{request.document_types?.name ?? 'Document Request'}</h1>
        <p className="text-sm text-muted-foreground">Ref #{request.reference_number}</p>
      </div>

      {!isCancelled ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <p className="font-semibold">Processing Time</p>
              <p className="text-sm text-muted-foreground">
                {request.status === 'completed' ? 'Completed' : `Estimated completion — ${estimateLabel(request.created_at, targetHours)}`}
              </p>
            </div>
            <p className="font-semibold" style={{ color: progressColor }}>
              {Math.round(fraction * 100)}%
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(fraction * 100)}%`, backgroundColor: progressColor }} />
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Wallet size={18} className="text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 text-sm">
            <PaymentMethodIcon size={16} className="text-muted-foreground" /> {paymentMethodLabel}
          </span>
          <StatusPill status={isRefunded ? 'refunded' : isPaid ? 'paid' : 'pending'} />
        </div>
        <div className="flex items-center justify-between px-4 pb-4">
          <span className="text-sm text-muted-foreground">Total Amount Due</span>
          <span className="font-semibold">{fee === 0 ? 'Free' : formatCentavosAsPHP(fee)}</span>
        </div>

        {showQrPayNow || showCancelSlot ? (
          <div className="flex flex-col gap-2 border-t border-border p-4">
            {showQrPayNow ? (
              <Button onClick={() => router.push(`/services/payment/qrph/${requestId}`)}>
                {hasActivePendingPayment ? `Continue Payment ${formatButtonCountdown(pendingRemaining ?? 0)}` : 'Pay Now with QR PH'}
              </Button>
            ) : null}
            {showCancelSlot ? (
              pendingPayment ? (
                <Button variant="destructive" loading={cancellingPayment} onClick={handleCancelPendingPayment}>
                  Cancel Payment
                </Button>
              ) : (
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive" loading={cancellingRequest}>
                      Cancel Request
                    </Button>
                  }
                  title="Cancel Request"
                  description="This cannot be undone."
                  confirmLabel="Yes, Cancel"
                  onConfirm={handleCancelRequest}
                />
              )
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status History</p>
        <ol className="flex flex-col">
          {STEP_ORDER.map((step, index) => {
            const entry = history.find((h) => h.status === step);
            const isDone = index <= currentStepIndex && !isCancelled;
            const isCurrent = step === request.status;
            const isLast = index === STEP_ORDER.length - 1;
            const StepIcon = STEP_ICON[step];

            return (
              <li key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isDone ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground text-transparent'
                    }`}>
                    {isDone ? <StepIcon size={14} /> : null}
                  </div>
                  {!isLast ? <div className={`w-0.5 flex-1 ${index < currentStepIndex && !isCancelled ? 'bg-primary' : 'bg-muted'}`} /> : null}
                </div>
                <div className="flex-1 pb-4">
                  <p className={`text-sm ${isCurrent ? 'font-semibold text-primary' : isDone ? 'font-medium' : 'text-muted-foreground'}`}>
                    {STEP_LABEL[step]}
                  </p>
                  {entry ? (
                    <>
                      <p className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</p>
                      {entry.note ? <p className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{entry.note}</p> : null}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Pending</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {isCancelled ? (
          <p className="mt-1 text-sm text-status-error">
            This request was cancelled.
            {(() => {
              const cancelEntry = history.find((h) => h.status === 'cancelled');
              return cancelEntry?.note ? ` ${cancelEntry.note}` : '';
            })()}
          </p>
        ) : null}
      </div>

      {request.requester_notes ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-1 font-semibold">Purpose</p>
          <p className="text-sm text-muted-foreground">{request.requester_notes}</p>
        </div>
      ) : null}
    </div>
  );
}
