'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { markPaymentCollected as markPaymentCollectedRequest } from '@/lib/payments';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface RequestStatusActionsProps {
  requestId: string;
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
export function RequestStatusActions({ requestId, status, paymentStatus, paymentMethod, variant = 'full' }: RequestStatusActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);

  const btnClass =
    variant === 'compact'
      ? 'rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50'
      : 'rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50';

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
    setShowCancelForm(false);
    setCancelNote('');
    toast.showSuccess('Request cancelled.');
    router.refresh();
  }

  async function markPaymentCollected() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await markPaymentCollectedRequest(supabase, requestId);
    setBusy(false);
    if (error) {
      toast.showError(`Failed to mark payment collected: ${error}`);
      return;
    }
    toast.showSuccess('Payment marked as collected.');
    router.refresh();
  }

  if (status === 'cancelled' || status === 'completed') {
    if (status === 'completed' && paymentStatus !== 'paid' && paymentMethod === 'pickup') {
      return (
        <button onClick={markPaymentCollected} disabled={busy} className={`${btnClass} bg-[var(--accent)] text-white`}>
          Mark Payment Collected
        </button>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'submitted' ? (
        <button onClick={beginProcessing} disabled={busy} className={`${btnClass} bg-blue-600 text-white`}>
          Move to Processing
        </button>
      ) : null}

      {status === 'in_progress' ? (
        <button onClick={markReadyForPickup} disabled={busy} className={`${btnClass} bg-blue-600 text-white`}>
          Mark Ready for Pickup
        </button>
      ) : null}

      {status === 'ready_for_pickup' ? (
        <button onClick={completeRequest} disabled={busy} className={`${btnClass} bg-[var(--accent)] text-white`}>
          Mark as Completed
        </button>
      ) : null}

      {!showCancelForm ? (
        <button
          onClick={() => setShowCancelForm(true)}
          disabled={busy}
          className={`${btnClass} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300`}>
          Cancel
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
