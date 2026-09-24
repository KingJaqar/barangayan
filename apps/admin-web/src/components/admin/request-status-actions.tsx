'use client';

import { BanknoteArrowDown, Ban, Check, PackageCheck, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { useToast } from '@/components/ui/toast';
import { markPaymentCollected as markPaymentCollectedRequest } from '@/lib/payments';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface RequestStatusActionsProps {
  requestId: string;
  /** Threaded down purely so the audit log entries these actions write have a
   * meaningful `entityLabel` — this component otherwise only deals in ids. */
  referenceNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  /** 'compact' renders icon-free small buttons for a table row; 'full' renders the
   * larger buttons used on the request detail page. Same actions either way. */
  variant?: 'compact' | 'full';
}

/** The buttons that drive the request FSM the 0002 migration deferred to "admin/backend
 * concern" — Active -> Processing -> Ready, Cancel (with a required note via the
 * cancel_service_request RPC), and Ready -> Payment Collected for Pay at Pickup. */
export function RequestStatusActions({
  requestId,
  referenceNumber,
  status,
  paymentStatus,
  paymentMethod,
  variant = 'full',
}: RequestStatusActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);

  const btnClass =
    variant === 'compact'
      ? 'inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900'
      : 'rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50';

  function actionLabel(label: string, icon: React.ReactNode) {
    return variant === 'compact' ? <>{icon}<span className="sr-only">{label}</span></> : label;
  }

  function actionTitle(label: string) {
    return variant === 'compact' ? label : undefined;
  }

  async function beginProcessing() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    // S0-4: validated submitted -> in_progress transition (barangay + status checked
    // server-side), replacing the previous unguarded raw update.
    const { error } = await supabase.rpc('begin_processing_request', { request_id: requestId });
    setBusy(false);
    if (error) {
      toast.showError(`Failed to update status: ${error.message}`);
      return;
    }

    const { data: updated, error: readError } = await supabase
      .from('service_requests')
      .select('id, status')
      .eq('id', requestId)
      .maybeSingle();
    if (readError || !updated || updated.status !== 'in_progress') {
      toast.showError(readError?.message ?? 'The request status could not be confirmed.');
      return;
    }

    logAdminAction({
      action: 'status_change',
      entityType: 'service_request',
      entityId: updated.id,
      entityLabel: referenceNumber,
      changes: { before: { status }, after: { status: 'in_progress' } },
    }).catch(() => {});

    router.refresh();
  }

  async function completeRequest() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc('complete_service_request', { p_request_id: requestId });
    setBusy(false);
    if (error) {
      toast.showError(`Failed to complete request: ${error.message}`);
      return;
    }

    const { data: updated, error: readError } = await supabase
      .from('service_requests')
      .select('id, status')
      .eq('id', requestId)
      .maybeSingle();
    if (readError || !updated || updated.status !== 'completed') {
      toast.showError(readError?.message ?? 'The request status could not be confirmed.');
      return;
    }

    logAdminAction({
      action: 'status_change',
      entityType: 'service_request',
      entityId: updated.id,
      entityLabel: referenceNumber,
      changes: { before: { status }, after: { status: 'completed' } },
    }).catch(() => {});

    toast.showSuccess('Request marked as completed.');
    router.refresh();
  }

  async function markReadyForPickup() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc('mark_request_ready_for_pickup', { p_request_id: requestId });
    setBusy(false);
    if (error) {
      toast.showError(`Failed to mark request ready for pickup: ${error.message}`);
      return;
    }

    const { data: updated, error: readError } = await supabase
      .from('service_requests')
      .select('id, status')
      .eq('id', requestId)
      .maybeSingle();
    if (readError || !updated || updated.status !== 'ready_for_pickup') {
      toast.showError(readError?.message ?? 'The request status could not be confirmed.');
      return;
    }

    logAdminAction({
      action: 'status_change',
      entityType: 'service_request',
      entityId: updated.id,
      entityLabel: referenceNumber,
      changes: { before: { status }, after: { status: 'ready_for_pickup' } },
    }).catch(() => {});

    toast.showSuccess('Request marked ready for pickup.');
    router.refresh();
  }

  async function handleCancel() {
    if (!cancelNote.trim()) return;
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc('cancel_service_request', { p_request_id: requestId, p_note: cancelNote.trim() });
    setBusy(false);
    if (error) {
      toast.showError(`Failed to cancel request: ${error.message}`);
      return;
    }

    const { data: updated, error: readError } = await supabase
      .from('service_requests')
      .select('id, status')
      .eq('id', requestId)
      .maybeSingle();
    if (readError || !updated || updated.status !== 'cancelled') {
      toast.showError(readError?.message ?? 'The request status could not be confirmed.');
      return;
    }

    logAdminAction({
      action: 'status_change',
      entityType: 'service_request',
      entityId: updated.id,
      entityLabel: referenceNumber,
      changes: { before: { status }, after: { status: 'cancelled' } },
      metadata: { cancelNote: cancelNote.trim() },
    }).catch(() => {});

    setShowCancelForm(false);
    setCancelNote('');
    toast.showSuccess('Request cancelled.');
    router.refresh();
  }

  async function markPaymentCollected() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error, paymentId, wasCreate } = await markPaymentCollectedRequest(supabase, requestId);
    setBusy(false);
    if (error) {
      toast.showError(`Failed to mark payment collected: ${error}`);
      return;
    }

    const { data: updated, error: readError } = await supabase
      .from('service_requests')
      .select('id, payment_status')
      .eq('id', requestId)
      .maybeSingle();
    if (readError || !updated || updated.payment_status !== 'paid') {
      toast.showError(readError?.message ?? 'The payment status could not be confirmed.');
      return;
    }

    logAdminAction({
      action: 'status_change',
      entityType: 'service_request',
      entityId: updated.id,
      entityLabel: referenceNumber,
      changes: { before: { payment_status: paymentStatus }, after: { payment_status: 'paid' } },
    }).catch(() => {});

    logAdminAction({
      action: wasCreate ? 'create' : 'status_change',
      entityType: 'payment',
      entityId: paymentId ?? undefined,
      entityLabel: referenceNumber,
      changes: wasCreate ? undefined : { before: { status: paymentStatus }, after: { status: 'paid' } },
      metadata: { method: paymentMethod, reference_number: referenceNumber },
    }).catch(() => {});

    toast.showSuccess('Payment marked as collected.');
    router.refresh();
  }

  if (status === 'cancelled' || status === 'completed') {
    if (status === 'completed' && paymentStatus !== 'paid' && paymentMethod === 'pickup') {
      return (
        <button
          onClick={markPaymentCollected}
          disabled={busy}
          title={actionTitle('Mark payment collected')}
          aria-label={variant === 'compact' ? `Mark payment collected for request ${referenceNumber}` : undefined}
          className={`${btnClass} bg-[var(--accent)] text-white`}>
          {actionLabel('Mark Payment Collected', <BanknoteArrowDown aria-hidden="true" className="h-4 w-4" />)}
        </button>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'submitted' ? (
        <button
          onClick={beginProcessing}
          disabled={busy}
          title={actionTitle('Move to processing')}
          aria-label={variant === 'compact' ? `Move request ${referenceNumber} to processing` : undefined}
          className={`${btnClass} bg-blue-600 text-white`}>
          {actionLabel('Move to Processing', <Play aria-hidden="true" className="h-4 w-4" />)}
        </button>
      ) : null}

      {status === 'in_progress' ? (
        <button
          onClick={markReadyForPickup}
          disabled={busy}
          title={actionTitle('Mark ready for pickup')}
          aria-label={variant === 'compact' ? `Mark request ${referenceNumber} ready for pickup` : undefined}
          className={`${btnClass} bg-blue-600 text-white`}>
          {actionLabel('Mark Ready for Pickup', <PackageCheck aria-hidden="true" className="h-4 w-4" />)}
        </button>
      ) : null}

      {status === 'ready_for_pickup' ? (
        <button
          onClick={completeRequest}
          disabled={busy}
          title={actionTitle('Mark as completed')}
          aria-label={variant === 'compact' ? `Mark request ${referenceNumber} as completed` : undefined}
          className={`${btnClass} bg-[var(--accent)] text-white`}>
          {actionLabel('Mark as Completed', <Check aria-hidden="true" className="h-4 w-4" />)}
        </button>
      ) : null}

      {!showCancelForm ? (
        <button
          onClick={() => setShowCancelForm(true)}
          disabled={busy}
          title={actionTitle('Cancel request')}
          aria-label={variant === 'compact' ? `Cancel request ${referenceNumber}` : undefined}
          className={`${btnClass} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300`}>
          {actionLabel('Cancel', <Ban aria-hidden="true" className="h-4 w-4" />)}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            value={cancelNote}
            onChange={(e) => setCancelNote(e.target.value)}
            placeholder="Reason for cancellation…"
            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button onClick={handleCancel} disabled={busy || !cancelNote.trim()} className={`${btnClass} bg-red-600 text-white`}>
            Confirm
          </button>
          <button onClick={() => setShowCancelForm(false)} className={`${btnClass} bg-zinc-200 dark:bg-zinc-700`}>
            Back
          </button>
        </div>
      )}
    </div>
  );
}
